"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { BATAS_UKURAN_GAMBAR_MB } from "@/server/berkas-unggahan";
import { buatKategori, hapusKategori, ubahKategori } from "@/server/kategori";

export type KeadaanFormKategori = {
  nama: string;
  galat?: { nama?: string; ikon?: string };
};

/** Pesan galat bila Kategori tidak dihapus. */
export type KeadaanHapusKategori = { galat?: string };

const PESAN_IKON_KOSONG =
  "Gambar ikon belum dipilih. Pilih berkas gambar PNG, JPEG, atau WebP untuk ikon Kategori.";

const PESAN_IKON_DITOLAK = {
  "bukan-gambar":
    "Berkas ini bukan gambar PNG, JPEG, atau WebP. Pilih berkas gambar dengan salah satu jenis itu.",
  "terlalu-besar": `Gambar ini lebih besar dari ${BATAS_UKURAN_GAMBAR_MB} MB. Perkecil gambarnya, lalu pilih lagi.`,
};

const PESAN_NAMA_DIPAKAI =
  "Nama ini sudah dipakai Kategori lain, tanpa membedakan huruf besar dan kecil. Ganti namanya supaya setiap Kategori berbeda.";

const Nama = z
  .string()
  .trim()
  .min(
    1,
    "Nama Kategori belum diisi. Ketik nama Kategori, misalnya Streaming.",
  );

// Browser mengirim berkas kosong tanpa nama bila Admin tidak memilih berkas.
const Ikon = z
  .instanceof(File, { error: PESAN_IKON_KOSONG })
  .refine((berkas) => berkas.size > 0, PESAN_IKON_KOSONG);

const MasukanBuatKategori = z.object({ nama: Nama, ikon: Ikon });

// Saat mengubah Kategori, ikon baru boleh tidak dipilih; ikon lama tetap dipakai.
const MasukanUbahKategori = z.object({
  nama: Nama,
  ikon: z
    .instanceof(File, { error: PESAN_IKON_KOSONG })
    .optional()
    .transform((berkas) => (berkas && berkas.size > 0 ? berkas : undefined)),
});

function galatIsian(galat: z.ZodError<{ nama: string; ikon?: File }>) {
  const isian = z.flattenError(galat).fieldErrors;
  return { nama: isian.nama?.[0], ikon: isian.ikon?.[0] };
}

export async function aksiBuatKategori(
  _sebelumnya: KeadaanFormKategori,
  formData: FormData,
): Promise<KeadaanFormKategori> {
  await wajibSesiAdmin(await headers());

  const nama = String(formData.get("nama") ?? "");
  const masukan = MasukanBuatKategori.safeParse({
    nama,
    ikon: formData.get("ikon"),
  });
  if (!masukan.success) return { nama, galat: galatIsian(masukan.error) };

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk membuat.
  const hasil = await buatKategori(masukan.data);
  if (hasil.hasil === "nama-dipakai") {
    return { nama, galat: { nama: PESAN_NAMA_DIPAKAI } };
  }
  if (hasil.hasil === "ditolak") {
    return { nama, galat: { ikon: PESAN_IKON_DITOLAK[hasil.alasan] } };
  }
  redirect("/admin/kategori");
}

export async function aksiUbahKategori(
  _sebelumnya: KeadaanFormKategori,
  formData: FormData,
): Promise<KeadaanFormKategori> {
  await wajibSesiAdmin(await headers());

  // Kategori dengan id yang tidak sah pasti tidak ada.
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) notFound();

  const nama = String(formData.get("nama") ?? "");
  const masukan = MasukanUbahKategori.safeParse({
    nama,
    ikon: formData.get("ikon") ?? undefined,
  });
  if (!masukan.success) return { nama, galat: galatIsian(masukan.error) };

  const hasil = await ubahKategori({ id: id.data, ...masukan.data });
  if (hasil.hasil === "tidak-ada") notFound();
  if (hasil.hasil === "nama-dipakai") {
    return { nama, galat: { nama: PESAN_NAMA_DIPAKAI } };
  }
  if (hasil.hasil === "ditolak") {
    return { nama, galat: { ikon: PESAN_IKON_DITOLAK[hasil.alasan] } };
  }
  redirect("/admin/kategori");
}

/**
 * Menghapus Kategori yang tidak berisi Produk (PRD §3.1). Kategori yang masih berisi Produk, termasuk Produk
 * nonaktif, ditolak dengan pesan untuk memindahkan Produknya ke Kategori lain dulu. Setelah terhapus, dasbor
 * kembali ke daftar Kategori.
 */
export async function aksiHapusKategori(
  _sebelumnya: KeadaanHapusKategori,
  formData: FormData,
): Promise<KeadaanHapusKategori> {
  await wajibSesiAdmin(await headers());

  // Kategori dengan id yang tidak sah pasti tidak ada.
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) notFound();

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk menghapus.
  const hasil = await hapusKategori(id.data);
  switch (hasil.hasil) {
    case "tidak-ada":
      notFound();
    case "berisi-produk":
      return {
        galat: `Kategori ini tidak bisa dihapus, karena masih berisi ${hasil.jumlahProduk} Produk. Produk nonaktif juga dihitung. Pindahkan Produknya ke Kategori lain dulu di halaman Ubah Produk, lalu hapus Kategori ini lagi.`,
      };
    case "dihapus":
      redirect("/admin/kategori");
  }
}
