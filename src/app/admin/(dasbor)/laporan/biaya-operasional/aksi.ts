"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  NOMINAL_MINIMUM,
  PANJANG_KETERANGAN_MAKSIMUM,
  periksaIsianBiayaOperasional,
  type AlasanKeteranganDitolak,
  type AlasanNominalDitolak,
  type AlasanTanggalDitolak,
} from "@/domain/biaya-operasional";
import { rupiah, rupiahDariTeks } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import {
  hapusBiayaOperasional,
  tambahBiayaOperasional,
  ubahBiayaOperasional,
  type IsianBiayaOperasional,
} from "@/server/biaya-operasional";
import { tanggalIsianWib } from "@/server/zona-waktu-toko";

import { alamatBulan } from "./alamat";

/** Isian form Biaya operasional apa adanya, untuk divalidasi dan dikembalikan ke form. */
type IsianFormBiayaOperasional = {
  tanggal: string;
  keterangan: string;
  nominal: string;
};

type GalatFormBiayaOperasional = Partial<
  Record<keyof IsianFormBiayaOperasional, string>
>;

/** Isian form Biaya operasional beserta pesan galatnya, yang dikembalikan ke form bila biaya tidak disimpan. */
export type KeadaanFormBiayaOperasional = {
  isian: IsianFormBiayaOperasional;
  galat?: GalatFormBiayaOperasional;
};

function bacaIsian(formData: FormData): IsianFormBiayaOperasional {
  const teks = (nama: string) => {
    const nilai = formData.get(nama);
    return typeof nilai === "string" ? nilai : "";
  };
  return {
    tanggal: teks("tanggal"),
    keterangan: teks("keterangan"),
    nominal: teks("nominal"),
  };
}

/** Id Biaya operasional dari form. Biaya dengan id yang tidak sah pasti tidak ada. */
function bacaId(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) notFound();
  return id.data;
}

/** Tanggal "YYYY-MM-DD" dari isian tanggal browser: null bila kosong, supaya domain menolaknya sebagai kosong. */
const Tanggal = z
  .string()
  .trim()
  .transform((teks, ctx) => {
    if (teks === "") return null;
    if (!z.iso.date().safeParse(teks).success) {
      ctx.addIssue({
        code: "custom",
        message:
          "Tanggal tidak terbaca. Pilih tanggalnya dari isian, paling lambat hari ini.",
      });
      return z.NEVER;
    }
    return teks;
  });

/**
 * Nominal dari isian: null bila kosong, supaya domain menolaknya sebagai kosong. Tanda minus di depan angka ikut
 * dibaca, supaya nominal negatif ditolak domain dengan pesan minimal Rp 1, bukan sebagai teks yang tidak terbaca.
 */
const Nominal = z
  .string()
  .trim()
  .transform((teks, ctx) => {
    if (teks === "") return null;
    const negatif = /^[-−]/.test(teks);
    const nilai = rupiahDariTeks(negatif ? teks.slice(1).trimStart() : teks);
    if (nilai === null) {
      ctx.addIssue({
        code: "custom",
        message:
          "Nominal tidak terbaca sebagai rupiah. Ketik angkanya saja, misalnya 150000 atau 150.000.",
      });
      return z.NEVER;
    }
    // Nominal tidak dibatasi maksimum (PRD §14.4), tetapi angka di atas batas ini tidak bisa disimpan persis
    // sampai rupiah terakhir.
    if (nilai > Number.MAX_SAFE_INTEGER) {
      ctx.addIssue({
        code: "custom",
        message: "Nominal terlalu besar untuk disimpan. Periksa lagi angkanya.",
      });
      return z.NEVER;
    }
    return negatif ? -nilai : nilai;
  });

const PESAN_TANGGAL: Record<AlasanTanggalDitolak, string> = {
  "tanggal-kosong":
    "Tanggal belum diisi. Pilih tanggal biayanya, paling lambat hari ini.",
  "tanggal-setelah-hari-ini":
    "Tanggal ini belum terjadi. Pilih tanggal paling lambat hari ini, dan periksa juga tahunnya.",
};

const PESAN_KETERANGAN: Record<AlasanKeteranganDitolak, string> = {
  "keterangan-kosong":
    "Keterangan belum diisi. Ketik untuk apa biaya ini, misalnya Sewa server November.",
  "keterangan-terlalu-panjang": `Keterangan lebih dari ${PANJANG_KETERANGAN_MAKSIMUM} karakter. Persingkat menjadi paling banyak ${PANJANG_KETERANGAN_MAKSIMUM} karakter.`,
};

const PESAN_NOMINAL: Record<AlasanNominalDitolak, string> = {
  "nominal-kosong":
    "Nominal belum diisi. Ketik nominalnya dalam rupiah, misalnya 150.000.",
  "nominal-kurang-dari-minimum": `Nominal kurang dari ${rupiah(NOMINAL_MINIMUM)}. Isi nominal minimal ${rupiah(NOMINAL_MINIMUM)}.`,
  "nominal-bukan-rupiah-bulat":
    "Nominal harus rupiah bulat, tanpa sen. Hapus angka di belakang koma.",
};

/**
 * Memeriksa isian form Biaya operasional. Tanggal dan nominal yang tidak terbaca ditolak di sini; selebihnya
 * diperiksa periksaIsianBiayaOperasional di domain dengan "hari ini" menurut zona waktu toko (PRD §9.1, §14.4).
 * Setiap isian diperiksa sendiri, jadi semua galat tampil sekaligus.
 */
function periksaIsian(
  isian: IsianFormBiayaOperasional,
):
  | { sah: true; biaya: IsianBiayaOperasional }
  | { sah: false; galat: GalatFormBiayaOperasional } {
  const tanggal = Tanggal.safeParse(isian.tanggal);
  const nominal = Nominal.safeParse(isian.nominal);
  const periksa = periksaIsianBiayaOperasional({
    hariIni: tanggalIsianWib(new Date()),
    tanggal: tanggal.success ? tanggal.data : null,
    keterangan: isian.keterangan,
    nominal: nominal.success ? nominal.data : null,
  });

  const galat: GalatFormBiayaOperasional = {};
  if (!tanggal.success) galat.tanggal = tanggal.error.issues[0].message;
  else if (periksa.alasanTanggal) {
    galat.tanggal = PESAN_TANGGAL[periksa.alasanTanggal];
  }
  if (periksa.alasanKeterangan) {
    galat.keterangan = PESAN_KETERANGAN[periksa.alasanKeterangan];
  }
  if (!nominal.success) galat.nominal = nominal.error.issues[0].message;
  else if (periksa.alasanNominal) {
    galat.nominal = PESAN_NOMINAL[periksa.alasanNominal];
  }

  if (
    !periksa.valid ||
    !tanggal.success ||
    !nominal.success ||
    tanggal.data === null ||
    nominal.data === null ||
    periksa.keteranganTersimpan === null
  ) {
    return { sah: false, galat };
  }
  return {
    sah: true,
    biaya: {
      tanggal: tanggal.data,
      keterangan: periksa.keteranganTersimpan,
      nominal: nominal.data,
    },
  };
}

/**
 * Mencatat Biaya operasional (PRD §14.4). Setelah tersimpan, dasbor kembali ke daftar bulan biaya itu tanpa pesan
 * "tersimpan", supaya biaya barunya langsung terlihat (DESIGN.md Navigation).
 */
export async function aksiTambahBiayaOperasional(
  _sebelumnya: KeadaanFormBiayaOperasional,
  formData: FormData,
): Promise<KeadaanFormBiayaOperasional> {
  await wajibSesiAdmin(await headers());

  const isian = bacaIsian(formData);
  const periksa = periksaIsian(isian);
  if (!periksa.sah) return { isian, galat: periksa.galat };

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mencatat.
  await tambahBiayaOperasional(periksa.biaya);
  redirect(alamatBulan(periksa.biaya.tanggal.slice(0, 7)));
}

/** Mengubah tanggal, keterangan, atau nominal Biaya operasional (PRD §14.4), lalu kembali ke daftar bulannya. */
export async function aksiUbahBiayaOperasional(
  _sebelumnya: KeadaanFormBiayaOperasional,
  formData: FormData,
): Promise<KeadaanFormBiayaOperasional> {
  await wajibSesiAdmin(await headers());

  const id = bacaId(formData);
  const isian = bacaIsian(formData);
  const periksa = periksaIsian(isian);
  if (!periksa.sah) return { isian, galat: periksa.galat };

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengubah.
  const hasil = await ubahBiayaOperasional({ id, ...periksa.biaya });
  if (hasil.hasil === "tidak-ada") notFound();
  redirect(alamatBulan(periksa.biaya.tanggal.slice(0, 7)));
}

/**
 * Menghapus Biaya operasional (PRD §14.4). Penegasannya lewat Modal penegasan dari panel Hapus di halaman ubah
 * biaya, seperti panel hapus Voucher (PRD §8.8, §9.10). Setelah terhapus, dasbor kembali ke daftar bulan biaya itu.
 */
export async function aksiHapusBiayaOperasional(
  _sebelumnya: { galat?: string },
  formData: FormData,
): Promise<{ galat?: string }> {
  await wajibSesiAdmin(await headers());

  const id = bacaId(formData);

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk menghapus.
  const hasil = await hapusBiayaOperasional(id);
  if (hasil.hasil === "tidak-ada") notFound();
  redirect(alamatBulan(hasil.tanggal.slice(0, 7)));
}
