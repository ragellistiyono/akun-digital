"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  JENIS_POTONGAN,
  periksaIsianVoucher,
  type GalatIsianVoucher,
  type JenisPotongan,
} from "@/domain/isian-voucher";
import {
  periksaKodeVoucher,
  type AlasanKodeVoucherDitolak,
} from "@/domain/kode-voucher";
import { rupiahDariTeks } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import {
  buatVoucher,
  ubahStatusVoucher,
  ubahVoucher,
  type SyaratVoucher,
} from "@/server/voucher";
import { instanDariIsianWib } from "@/server/zona-waktu-toko";

const ALAMAT_DAFTAR = "/admin/voucher";

/** Isian form Voucher apa adanya, untuk divalidasi dan dikembalikan ke form. */
type IsianFormVoucher = {
  kode: string;
  jenisPotongan: JenisPotongan;
  nilai: string;
  batasMaksimum: string;
  mulai: string;
  berakhir: string;
  kuotaVoucher: string;
  batasPerEmail: string;
  minimalHargaJual: string;
  khususMember: boolean;
  aktif: boolean;
};

type NamaIsianTeks = Exclude<keyof IsianFormVoucher, "khususMember" | "aktif">;

type GalatFormVoucher = Partial<Record<NamaIsianTeks, string>>;

/** Isian form Voucher beserta pesan galatnya, yang dikembalikan ke form bila Voucher tidak disimpan. */
export type KeadaanFormVoucher = {
  isian: IsianFormVoucher;
  galat?: GalatFormVoucher;
};

function bacaIsian(formData: FormData): IsianFormVoucher {
  const teks = (nama: string) => {
    const nilai = formData.get(nama);
    return typeof nilai === "string" ? nilai : "";
  };
  const jenis = z.enum(JENIS_POTONGAN).safeParse(formData.get("jenisPotongan"));
  return {
    kode: teks("kode"),
    // Form selalu mengirim salah satu jenis, karena pilihan Nominal tetap sudah terpilih sejak awal.
    jenisPotongan: jenis.success ? jenis.data : "nominal",
    nilai: teks("nilai"),
    batasMaksimum: teks("batasMaksimum"),
    mulai: teks("mulai"),
    berakhir: teks("berakhir"),
    kuotaVoucher: teks("kuotaVoucher"),
    batasPerEmail: teks("batasPerEmail"),
    minimalHargaJual: teks("minimalHargaJual"),
    // Kotak centang hanya terkirim bila dicentang.
    khususMember: formData.get("khususMember") === "on",
    aktif: formData.get("aktif") === "on",
  };
}

/** Id Voucher dari form. Voucher dengan id yang tidak sah pasti tidak ada. */
function bacaId(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) notFound();
  return id.data;
}

/** Bilangan terbesar yang muat di kolom integer PostgreSQL. */
const ANGKA_TERBESAR = 2_147_483_647;

/**
 * Angka dari teks isian: rupiah ditulis seperti "5000", "5.000", atau "Rp 5.000", dan persen boleh diakhiri
 * "%". Hasilnya null untuk isian kosong, atau pesan galat bila teksnya tidak terbaca sebagai angka.
 */
function angkaDariTeks(
  teks: string,
  label: string,
): { angka: number | null } | { galat: string } {
  const bersih = teks.trim().replace(/\s*%$/, "");
  if (bersih === "") return { angka: null };
  const angka = rupiahDariTeks(bersih);
  if (angka === null) {
    return {
      galat: `${label} tidak terbaca sebagai angka. Ketik angkanya saja, misalnya 5000 atau 5.000.`,
    };
  }
  if (angka > ANGKA_TERBESAR) {
    return {
      galat: `${label} terlalu besar untuk disimpan. Periksa lagi angkanya.`,
    };
  }
  return { angka };
}

/** Instan dari isian tanggal-dan-jam WIB, null untuk isian kosong, atau pesan galat. */
function waktuDariTeks(
  teks: string,
  label: string,
): { waktu: Date | null } | { galat: string } {
  if (teks.trim() === "") return { waktu: null };
  const waktu = instanDariIsianWib(teks.trim());
  if (waktu === null) {
    return {
      galat: `${label} tidak terbaca. Pilih tanggal dan jamnya dari isian, sampai menit, atau kosongkan.`,
    };
  }
  return { waktu };
}

const PESAN_KODE: Record<AlasanKodeVoucherDitolak, string> = {
  kosong:
    "Kode belum diisi. Ketik kode 3 sampai 20 huruf atau angka, misalnya HEMAT5.",
  "terlalu-pendek":
    "Kode kurang dari 3 karakter. Ketik kode 3 sampai 20 huruf atau angka, misalnya HEMAT5.",
  "terlalu-panjang":
    "Kode lebih dari 20 karakter. Persingkat kodenya menjadi paling banyak 20 huruf atau angka.",
  "karakter-tidak-sah":
    "Kode hanya boleh berisi huruf A–Z dan angka 0–9, tanpa spasi atau tanda baca. Hapus karakter lainnya, misalnya HEMAT-10 menjadi HEMAT10.",
  kembar:
    "Kode ini sudah dipakai Voucher lain, tanpa membedakan huruf besar dan kecil. Ganti kodenya supaya setiap Voucher berbeda.",
};

const PESAN_TANPA_BATAS = "atau kosongkan bila tanpa batas.";

/** Isian dan pesan untuk setiap galat dari periksaIsianVoucher (PRD §8.2, §8.4 ▶ Keputusan 2026-11-17). */
function galatIsian(
  galat: GalatIsianVoucher,
  jenisPotongan: JenisPotongan,
): GalatFormVoucher {
  switch (galat) {
    case "nilai-bukan-bilangan-bulat":
      return {
        nilai:
          jenisPotongan === "persen"
            ? "Persen harus bilangan bulat, tanpa koma. Ketik 1 sampai 100, misalnya 10."
            : "Nominal tetap harus rupiah bulat, tanpa sen. Hapus angka di belakang koma.",
      };
    case "nilai-kurang-dari-minimum":
      return {
        nilai:
          "Nominal tetap kurang dari Rp 1. Isi nominal tetap minimal Rp 1, misalnya 5.000.",
      };
    case "persen-di-luar-rentang":
      return {
        nilai: "Persen harus 1 sampai 100. Ketik persennya, misalnya 10.",
      };
    case "batas-maksimum-bukan-bilangan-bulat":
    case "batas-maksimum-kurang-dari-minimum":
      return {
        batasMaksimum: `Batas maksimum harus rupiah bulat minimal Rp 1, misalnya 10.000, ${PESAN_TANPA_BATAS}`,
      };
    case "kuota-voucher-bukan-bilangan-bulat":
    case "kuota-voucher-kurang-dari-1":
      return {
        kuotaVoucher: `Kuota voucher harus bilangan bulat minimal 1, misalnya 100, ${PESAN_TANPA_BATAS}`,
      };
    case "batas-per-email-bukan-bilangan-bulat":
    case "batas-per-email-kurang-dari-1":
      return {
        batasPerEmail: `Batas per email harus bilangan bulat minimal 1, misalnya 1, ${PESAN_TANPA_BATAS}`,
      };
    case "minimal-harga-jual-bukan-bilangan-bulat":
    case "minimal-harga-jual-kurang-dari-minimum":
      return {
        minimalHargaJual:
          "Minimal Harga jual harus rupiah bulat minimal Rp 1, misalnya 50.000, atau kosongkan bila tanpa syarat.",
      };
    case "berakhir-tidak-setelah-mulai":
      return {
        berakhir:
          "Waktu berakhir harus setelah waktu mulai. Ubah waktu berakhirnya, atau kosongkan salah satu waktu.",
      };
    case "cakupan-kosong":
      // Cakupan voucher untuk sementara selalu semua Produk (T53), jadi daftarnya tidak pernah kosong.
      throw new Error("Cakupan voucher di form ini selalu semua Produk.");
  }
}

/**
 * Memeriksa isian form Voucher selain kode. Isian yang kosong padahal wajib, atau yang tidak terbaca, disebut
 * sekaligus. Begitu semua angka dan waktu terbaca, aturannya diperiksa periksaIsianVoucher di domain. Batas
 * maksimum hanya dibaca untuk jenis persen.
 */
function periksaSyarat(
  isian: IsianFormVoucher,
):
  | { sah: true; syarat: SyaratVoucher }
  | { sah: false; galat: GalatFormVoucher } {
  const galat: GalatFormVoucher = {};
  const persen = isian.jenisPotongan === "persen";
  const angka = (nama: NamaIsianTeks, label: string) => {
    const hasil = angkaDariTeks(isian[nama], label);
    if ("galat" in hasil) {
      galat[nama] = hasil.galat;
      return null;
    }
    return hasil.angka;
  };
  const waktu = (nama: "mulai" | "berakhir", label: string) => {
    const hasil = waktuDariTeks(isian[nama], label);
    if ("galat" in hasil) {
      galat[nama] = hasil.galat;
      return null;
    }
    return hasil.waktu;
  };

  const nilai = angka("nilai", persen ? "Persen" : "Nominal tetap");
  if (isian.nilai.trim() === "") {
    galat.nilai = persen
      ? "Persen belum diisi. Ketik persennya, misalnya 10."
      : "Nominal tetap belum diisi. Ketik potongannya dalam rupiah, misalnya 5.000.";
  }
  const syarat = {
    jenisPotongan: isian.jenisPotongan,
    nilai: nilai ?? 0,
    batasMaksimum: persen ? angka("batasMaksimum", "Batas maksimum") : null,
    kuotaVoucher: angka("kuotaVoucher", "Kuota voucher"),
    batasPerEmail: angka("batasPerEmail", "Batas per email"),
    minimalHargaJual: angka("minimalHargaJual", "Minimal Harga jual"),
    mulai: waktu("mulai", "Waktu mulai"),
    berakhir: waktu("berakhir", "Waktu berakhir"),
    khususMember: isian.khususMember,
    aktif: isian.aktif,
  };
  if (Object.keys(galat).length > 0) return { sah: false, galat };

  const periksa = periksaIsianVoucher({
    ...syarat,
    cakupan: { jenis: "semua" },
  });
  if (!periksa.sah) {
    return {
      sah: false,
      galat: Object.assign(
        {},
        ...periksa.galat.map((g) => galatIsian(g, isian.jenisPotongan)),
      ),
    };
  }
  return { sah: true, syarat };
}

/**
 * Membuat Voucher baru (PRD §8.8). Kode diperiksa bersama isian lain, supaya semua galat tampil sekaligus;
 * kode yang sudah dipakai Voucher lain diperiksa saat menyimpan. Setelah tersimpan, dasbor kembali ke daftar
 * Voucher tanpa pesan "tersimpan" (DESIGN.md Navigation).
 */
export async function aksiBuatVoucher(
  _sebelumnya: KeadaanFormVoucher,
  formData: FormData,
): Promise<KeadaanFormVoucher> {
  await wajibSesiAdmin(await headers());

  const isian = bacaIsian(formData);
  const kode = periksaKodeVoucher({ kode: isian.kode, kodeLain: [] });
  const syarat = periksaSyarat(isian);
  if (!kode.sah || !syarat.sah) {
    return {
      isian,
      galat: {
        ...(kode.sah ? {} : { kode: PESAN_KODE[kode.alasan] }),
        ...(syarat.sah ? {} : syarat.galat),
      },
    };
  }

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk membuat.
  const hasil = await buatVoucher({ kode: isian.kode, ...syarat.syarat });
  if (hasil.hasil === "kode-ditolak") {
    return { isian, galat: { kode: PESAN_KODE[hasil.alasan] } };
  }
  redirect(ALAMAT_DAFTAR);
}

/**
 * Mengubah syarat Voucher (PRD §8.8). Kode tidak bisa diubah setelah Voucher dibuat (PRD §8.4 ▶ Keputusan
 * 2026-11-17), jadi kode dari form tidak dibaca. Setelah tersimpan, dasbor kembali ke daftar Voucher.
 */
export async function aksiUbahVoucher(
  sebelumnya: KeadaanFormVoucher,
  formData: FormData,
): Promise<KeadaanFormVoucher> {
  await wajibSesiAdmin(await headers());

  const id = bacaId(formData);
  const isian = { ...bacaIsian(formData), kode: sebelumnya.isian.kode };
  const syarat = periksaSyarat(isian);
  if (!syarat.sah) return { isian, galat: syarat.galat };

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengubah.
  const hasil = await ubahVoucher({ id, ...syarat.syarat });
  if (hasil.hasil === "tidak-ada") notFound();
  redirect(ALAMAT_DAFTAR);
}

/** Voucher yang dipilih dan status barunya, dari tombol di daftar Voucher. */
const MasukanStatusVoucher = z.object({
  id: z.uuid(),
  status: z.enum(["nonaktif", "aktif"]),
});

/**
 * Menonaktifkan Voucher atau mengaktifkannya kembali dari daftar Voucher (PRD §8.8). Aksi ini bisa dibalik,
 * jadi tidak perlu penegasan (DESIGN.md Navigation). Tanpa sesi Admin yang berlaku, pengunjung diarahkan ke
 * halaman login `/admin`.
 */
export async function aksiUbahStatusVoucher(formData: FormData) {
  await wajibSesiAdmin(await headers());

  const masukan = MasukanStatusVoucher.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!masukan.success) notFound();

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengubah status.
  const hasil = await ubahStatusVoucher({
    id: masukan.data.id,
    aktif: masukan.data.status === "aktif",
  });
  if (hasil.hasil === "tidak-ada") notFound();

  // Daftar Voucher dibuat ulang dengan status barunya, tanpa pesan "tersimpan" (DESIGN.md Navigation).
  revalidatePath(ALAMAT_DAFTAR);
}
