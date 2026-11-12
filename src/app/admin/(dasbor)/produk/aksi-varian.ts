"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  HARGA_JUAL_MAKSIMUM,
  HARGA_JUAL_MINIMUM,
  periksaHarga,
  type AlasanHargaDitolak,
} from "@/domain/validasi-harga";
import { rupiah } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { hapusVarian, tambahVarian, ubahVarian } from "@/server/varian";

type GalatVarian = { nama?: string; hargaJual?: string; hargaNormal?: string };

/**
 * Isian form Varian yang dikembalikan ke form, apa adanya, beserta pesan galatnya. `tersimpan` menandai
 * Varian yang berhasil disimpan, supaya form-nya ditutup.
 */
export type KeadaanFormVarian = {
  nama: string;
  hargaJual: string;
  hargaNormal: string;
  aktif: boolean;
  galat?: GalatVarian;
  tersimpan?: true;
};

/** Isian teks dan tanda dari form Varian, apa adanya, untuk divalidasi dan dikembalikan ke form. */
function bacaIsian(formData: FormData) {
  const teks = (nama: string) => {
    const nilai = formData.get(nama);
    return typeof nilai === "string" ? nilai : "";
  };
  return {
    nama: teks("nama"),
    hargaJual: teks("hargaJual"),
    hargaNormal: teks("hargaNormal"),
    // Kotak centang hanya terkirim bila dicentang.
    aktif: formData.get("aktif") === "on",
  };
}

/** Id dari form. Produk atau Varian dengan id yang tidak sah pasti tidak ada. */
function bacaId(formData: FormData, nama: string) {
  const id = z.uuid().safeParse(formData.get(nama));
  if (!id.success) notFound();
  return id.data;
}

// Harga ditulis seperti kebiasaan di Indonesia: titik memisahkan ribuan dan koma memisahkan sen,
// boleh diawali "Rp". Contohnya "50000", "50.000", "Rp 50.000", dan "1.500,5".
const POLA_RUPIAH = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/;

/** Nilai rupiah dari teks isian, atau null bila teksnya bukan angka rupiah. */
function rupiahDariTeks(teks: string) {
  const angka = teks.replace(/^rp\.?\s*/i, "");
  if (!POLA_RUPIAH.test(angka)) return null;
  return Number(angka.replaceAll(".", "").replace(",", "."));
}

const Nama = z
  .string()
  .trim()
  .min(1, "Nama Varian belum diisi. Ketik nama Varian, misalnya 1 Bulan.");

const HargaJual = z
  .string()
  .trim()
  .min(
    1,
    "Harga jual belum diisi. Ketik Harga jual dalam rupiah, misalnya 50.000.",
  )
  .transform((teks, ctx) => {
    const nilai = rupiahDariTeks(teks);
    if (nilai === null) {
      ctx.addIssue({
        code: "custom",
        message:
          "Harga jual tidak terbaca sebagai rupiah. Ketik angkanya saja, misalnya 50000 atau 50.000.",
      });
      return z.NEVER;
    }
    return nilai;
  });

/** Harga normal opsional: isian kosong berarti tanpa Harga normal (null). */
const HargaNormal = z
  .string()
  .trim()
  .transform((teks, ctx) => {
    if (teks === "") return null;
    const nilai = rupiahDariTeks(teks);
    if (nilai === null) {
      ctx.addIssue({
        code: "custom",
        message:
          "Harga normal tidak terbaca sebagai rupiah. Ketik angkanya saja, misalnya 75.000, atau kosongkan.",
      });
      return z.NEVER;
    }
    // Harga normal tidak dibatasi maksimum (PRD §3.2), tetapi angka di atas batas ini tidak bisa
    // disimpan persis sampai rupiah terakhir.
    if (nilai > Number.MAX_SAFE_INTEGER) {
      ctx.addIssue({
        code: "custom",
        message:
          "Harga normal terlalu besar untuk disimpan. Periksa lagi angkanya.",
      });
      return z.NEVER;
    }
    return nilai;
  });

const PESAN_BUKAN_RUPIAH_BULAT =
  "harus rupiah bulat, tanpa sen. Hapus angka di belakang koma.";

/** Pesan penolakan harga dari periksaHarga, di isian yang ditolak (PRD §3.2, §3.5). */
function galatHarga(
  alasan: AlasanHargaDitolak,
  hargaJual: number,
): GalatVarian {
  switch (alasan) {
    case "harga-jual-kurang-dari-minimum":
      return {
        hargaJual: `Harga jual kurang dari ${rupiah(HARGA_JUAL_MINIMUM)}. Isi Harga jual minimal ${rupiah(HARGA_JUAL_MINIMUM)}.`,
      };
    case "harga-jual-lebih-dari-maksimum":
      return {
        hargaJual: `Harga jual lebih dari ${rupiah(HARGA_JUAL_MAKSIMUM)}, batas tagihan QRIS. Isi Harga jual paling banyak ${rupiah(HARGA_JUAL_MAKSIMUM)}.`,
      };
    case "harga-jual-bukan-rupiah-bulat":
      return { hargaJual: `Harga jual ${PESAN_BUKAN_RUPIAH_BULAT}` };
    case "harga-normal-tidak-lebih-besar":
      return {
        hargaNormal: `Harga normal tidak lebih besar dari Harga jual ${rupiah(hargaJual)}. Isi Harga normal di atas Harga jual, atau kosongkan bila tidak ada harga pembanding.`,
      };
    case "harga-normal-bukan-rupiah-bulat":
      return { hargaNormal: `Harga normal ${PESAN_BUKAN_RUPIAH_BULAT}` };
  }
}

/**
 * Memeriksa isian form Varian. Nama dan harga yang kosong atau tidak terbaca disebut sekaligus. Aturan
 * harganya diperiksa periksaHarga di domain begitu Harga jual terbaca sebagai rupiah, dan periksaHarga
 * memberi satu alasan penolakan harga.
 */
function periksaIsian(isian: ReturnType<typeof bacaIsian>) {
  const nama = Nama.safeParse(isian.nama);
  const hargaJual = HargaJual.safeParse(isian.hargaJual);
  const hargaNormal = HargaNormal.safeParse(isian.hargaNormal);

  let galat: GalatVarian = {};
  if (!nama.success) galat.nama = nama.error.issues[0].message;
  if (!hargaJual.success) galat.hargaJual = hargaJual.error.issues[0].message;
  if (!hargaNormal.success) {
    galat.hargaNormal = hargaNormal.error.issues[0].message;
  }
  if (hargaJual.success) {
    const harga = periksaHarga({
      hargaJual: hargaJual.data,
      hargaNormal: hargaNormal.success ? hargaNormal.data : null,
    });
    if (!harga.valid) {
      galat = { ...galat, ...galatHarga(harga.alasan, hargaJual.data) };
    }
  }

  if (
    !nama.success ||
    !hargaJual.success ||
    !hargaNormal.success ||
    Object.keys(galat).length > 0
  ) {
    return { sah: false, galat } as const;
  }
  return {
    sah: true,
    varian: {
      nama: nama.data,
      hargaJual: hargaJual.data,
      hargaNormal: hargaNormal.data,
      aktif: isian.aktif,
    },
  } as const;
}

export async function aksiTambahVarian(
  _sebelumnya: KeadaanFormVarian,
  formData: FormData,
): Promise<KeadaanFormVarian> {
  await wajibSesiAdmin(await headers());

  const produkId = bacaId(formData, "produkId");
  const isian = bacaIsian(formData);
  const periksa = periksaIsian(isian);
  if (!periksa.sah) return { ...isian, galat: periksa.galat };

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk menambah.
  const hasil = await tambahVarian({ produkId, ...periksa.varian });
  if (hasil.hasil === "produk-tidak-ada") notFound();
  refresh();
  return {
    nama: "",
    hargaJual: "",
    hargaNormal: "",
    aktif: true,
    tersimpan: true,
  };
}

export async function aksiUbahVarian(
  _sebelumnya: KeadaanFormVarian,
  formData: FormData,
): Promise<KeadaanFormVarian> {
  await wajibSesiAdmin(await headers());

  const produkId = bacaId(formData, "produkId");
  const id = bacaId(formData, "id");
  const isian = bacaIsian(formData);
  const periksa = periksaIsian(isian);
  if (!periksa.sah) return { ...isian, galat: periksa.galat };

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengubah.
  const hasil = await ubahVarian({ id, produkId, ...periksa.varian });
  if (hasil.hasil === "tidak-ada") notFound();
  refresh();
  return { ...isian, tersimpan: true };
}

/** Pesan galat bila Varian tidak dihapus. */
export type KeadaanHapusVarian = { galat?: string };

/**
 * Menghapus Varian yang belum pernah dipesan, beserta Item stok-nya (PRD §3.7). Varian yang sudah tercatat di
 * Pesanan berstatus apa pun ditolak dengan pesan untuk menonaktifkannya. Setelah terhapus, daftar Varian yang
 * sudah diperbarui menjadi tandanya.
 */
export async function aksiHapusVarian(
  _sebelumnya: KeadaanHapusVarian,
  formData: FormData,
): Promise<KeadaanHapusVarian> {
  await wajibSesiAdmin(await headers());

  const produkId = bacaId(formData, "produkId");
  const id = bacaId(formData, "id");

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk menghapus.
  const hasil = await hapusVarian({ id, produkId });
  switch (hasil.hasil) {
    case "tidak-ada":
      notFound();
    case "pernah-dipesan":
      return {
        galat: `Varian ini tidak bisa dihapus, karena sudah tercatat di ${hasil.jumlahPesanan} Pesanan. Pesanan berstatus apa pun dihitung, termasuk Kedaluwarsa dan Dibatalkan. Nonaktifkan Varian ini saja: pilih Ubah, hapus centang Aktif, lalu simpan. Varian nonaktif hilang dari katalog dan tidak bisa dibeli, sedangkan Pesanan lamanya tetap tampil utuh.`,
      };
    case "dihapus":
      refresh();
      return {};
  }
}
