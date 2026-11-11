"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { BATAS_UKURAN_GAMBAR_MB } from "@/server/berkas-unggahan";
import { buatKategori, ubahKategori } from "@/server/kategori";

export type KeadaanFormKategori = {
  nama: string;
  galat?: { nama?: string; ikon?: string };
};

const PESAN_IKON_KOSONG =
  "Gambar ikon belum dipilih. Pilih berkas gambar PNG, JPEG, atau WebP untuk ikon Kategori.";

const PESAN_IKON_DITOLAK = {
  "bukan-gambar":
    "Berkas ini bukan gambar PNG, JPEG, atau WebP. Pilih berkas gambar dengan salah satu jenis itu.",
  "terlalu-besar": `Gambar ini lebih besar dari ${BATAS_UKURAN_GAMBAR_MB} MB. Perkecil gambarnya, lalu pilih lagi.`,
};

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
  if (hasil.hasil === "ditolak") {
    return { nama, galat: { ikon: PESAN_IKON_DITOLAK[hasil.alasan] } };
  }
  redirect("/admin/kategori");
}
