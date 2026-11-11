"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import {
  BATAS_UKURAN_GAMBAR_MB,
  NamaBerkasUnggahan,
} from "@/server/berkas-unggahan";
import {
  hapusFotoProduk,
  pindahkanFotoProduk,
  unggahFotoProduk,
} from "@/server/foto-produk";

/** Pesan galat unggahan foto yang dikembalikan ke bagian Foto di halaman Ubah Produk. */
export type KeadaanFotoProduk = { galat?: string };

const PESAN_FOTO_KOSONG =
  "Foto belum dipilih. Pilih berkas gambar PNG, JPEG, atau WebP, lalu pilih Unggah foto.";

const PESAN_FOTO_DITOLAK = {
  "bukan-gambar":
    "Berkas ini bukan gambar PNG, JPEG, atau WebP. Pilih foto dengan salah satu jenis itu.",
  "terlalu-besar": `Foto ini lebih besar dari ${BATAS_UKURAN_GAMBAR_MB} MB. Perkecil fotonya, lalu pilih lagi.`,
};

const pesanMelebihiBatas = (batas: number) =>
  `Produk ini sudah punya ${batas} foto, jumlah paling banyak untuk satu Produk. Hapus salah satu foto dulu, lalu unggah foto baru.`;

// Browser mengirim berkas kosong tanpa nama bila Admin tidak memilih berkas.
const Foto = z
  .instanceof(File, { error: PESAN_FOTO_KOSONG })
  .refine((berkas) => berkas.size > 0, PESAN_FOTO_KOSONG);

/** Id Produk dari form. Produk dengan id yang tidak sah pasti tidak ada. */
function idProduk(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) notFound();
  return id.data;
}

export async function aksiUnggahFotoProduk(
  _sebelumnya: KeadaanFotoProduk,
  formData: FormData,
): Promise<KeadaanFotoProduk> {
  await wajibSesiAdmin(await headers());

  const id = idProduk(formData);
  const foto = Foto.safeParse(formData.get("foto"));
  if (!foto.success) return { galat: foto.error.issues[0].message };

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengubah.
  const hasil = await unggahFotoProduk({ produkId: id, foto: foto.data });
  switch (hasil.hasil) {
    case "tidak-ada":
      notFound();
    case "ditolak":
      return { galat: PESAN_FOTO_DITOLAK[hasil.alasan] };
    case "melebihi-batas":
      return { galat: pesanMelebihiBatas(hasil.batas) };
    case "diunggah":
      refresh();
      return {};
  }
}

const MasukanPindahkan = z.object({
  nama: NamaBerkasUnggahan,
  urutan: z.coerce.number().int().min(1),
});

/**
 * Memindahkan satu foto ke urutan lain. Foto atau urutan yang tidak cocok dengan foto Produk saat ini,
 * misalnya karena Admin lain baru saja mengubahnya, tidak mengubah apa pun; halaman dimuat ulang
 * supaya Admin melihat urutan terbaru.
 */
export async function aksiPindahkanFotoProduk(formData: FormData) {
  await wajibSesiAdmin(await headers());

  const id = idProduk(formData);
  const masukan = MasukanPindahkan.safeParse({
    nama: formData.get("foto"),
    urutan: formData.get("urutan"),
  });
  if (masukan.success) {
    const produkAda = await pindahkanFotoProduk({
      produkId: id,
      ...masukan.data,
    });
    if (!produkAda) notFound();
  }
  refresh();
}

/**
 * Menghapus satu foto. Foto yang sudah tidak ada di Produk itu tidak mengubah apa pun; halaman dimuat
 * ulang supaya Admin melihat foto terbaru.
 */
export async function aksiHapusFotoProduk(formData: FormData) {
  await wajibSesiAdmin(await headers());

  const id = idProduk(formData);
  const nama = NamaBerkasUnggahan.safeParse(formData.get("foto"));
  if (nama.success) {
    const produkAda = await hapusFotoProduk({ produkId: id, nama: nama.data });
    if (!produkAda) notFound();
  }
  refresh();
}
