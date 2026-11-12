"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import type { MasalahItemStok, StatusItemStok } from "@/domain/item-stok";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import {
  hapusItemStok,
  tambahItemStok,
  tempelItemStokVarian,
  ubahItemStok,
} from "@/server/item-stok";

/**
 * Isian form satu Item stok yang dikembalikan ke form, apa adanya, beserta pesan galatnya. `galat.kolom`
 * mengikuti urutan isian, dengan null untuk kolom yang tidak bermasalah. `tersimpan` menandai Item
 * stok yang berhasil disimpan.
 */
export type KeadaanFormItemStok = {
  nilai: string[];
  galat?: { kolom?: (string | null)[]; umum?: string };
  tersimpan?: true;
};

/** Pesan galat bila Item stok tidak dihapus. */
export type KeadaanHapusItemStok = { galat?: string };

/**
 * Teks tempelan yang dikembalikan ke form beserta pesan galatnya, atau hasil tempelan: ringkasan dan
 * baris yang ditolak beserta keterangannya.
 */
export type KeadaanTempelItemStok = {
  teks: string;
  galat?: string;
  hasil?: {
    ringkasan: string;
    ditolak: { baris: number; teks: string; keterangan: string }[];
  };
};

/** Produk dan Varian yang diisi, dari form. Id yang tidak sah pasti tidak ada. */
function bacaVarianDipilih(formData: FormData) {
  const varianDipilih = z
    .object({ produkId: z.uuid(), varianId: z.uuid() })
    .safeParse({
      produkId: formData.get("produkId"),
      varianId: formData.get("varianId"),
    });
  if (!varianDipilih.success) notFound();
  return varianDipilih.data;
}

/** Pesan bila ITEM_STOK_KEY belum diisi atau tidak sah (PRD §12). */
function pesanKunci(masalah: "belum-diisi" | "tidak-sah") {
  return masalah === "belum-diisi"
    ? "ITEM_STOK_KEY belum diisi, jadi Item stok tidak bisa disimpan terenkripsi dan tidak disimpan. Isi ITEM_STOK_KEY di berkas .env server seperti contoh di .env.example, lalu jalankan ulang aplikasinya."
    : "ITEM_STOK_KEY tidak berisi 32 byte acak dalam base64, jadi Item stok tidak disimpan. Isi ITEM_STOK_KEY di berkas .env server dengan hasil `openssl rand -base64 32`, lalu jalankan ulang aplikasinya.";
}

/** Nama kolom-kolom dari nomornya (dihitung dari 1), misalnya "Email dan Profil". */
function namaKolom(kolom: string[], nomor: number[]) {
  const nama = nomor.map((n) => kolom[n - 1]);
  return nama.length === 1
    ? nama[0]
    : `${nama.slice(0, -1).join(", ")} dan ${nama[nama.length - 1]}`;
}

const NilaiItemStok = z.array(z.string());

export async function aksiTambahItemStok(
  _sebelumnya: KeadaanFormItemStok,
  formData: FormData,
): Promise<KeadaanFormItemStok> {
  await wajibSesiAdmin(await headers());

  const varianDipilih = bacaVarianDipilih(formData);
  // Isian kolom dikirim berurutan dengan nama yang sama, menurut urutan Format Item stok.
  const nilai = NilaiItemStok.safeParse(formData.getAll("nilai"));
  if (!nilai.success) notFound();

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengisi.
  const hasil = await tambahItemStok({ ...varianDipilih, nilai: nilai.data });
  switch (hasil.hasil) {
    case "varian-tidak-ada":
      notFound();
    case "kunci-bermasalah":
      return { nilai: nilai.data, galat: { umum: pesanKunci(hasil.masalah) } };
    case "ditolak":
      return {
        nilai: nilai.data,
        galat: galatItemStok(hasil.kolom, hasil.masalah),
      };
    case "disimpan":
      refresh();
      return { nilai: nilai.data.map(() => ""), tersimpan: true };
  }
}

/** Pesan galat form satu Item stok yang ditolak (PRD §4.2). */
function galatItemStok(
  kolom: string[],
  masalah: MasalahItemStok,
): NonNullable<KeadaanFormItemStok["galat"]> {
  switch (masalah.alasan) {
    case "kolom-kosong":
      return {
        kolom: kolom.map((nama, i) =>
          masalah.nomorKolom.includes(i + 1)
            ? `${nama} belum diisi. Ketik ${nama} untuk Item stok ini.`
            : null,
        ),
      };
    case "sudah-ada":
      return {
        umum: "Item stok ini sama persis dengan Item stok yang sudah ada di Varian ini, jadi tidak disimpan. Periksa lagi isinya, lalu simpan Item stok yang belum ada.",
      };
    case "jumlah-kolom-salah":
      // Form selalu memuat satu isian untuk setiap kolom, jadi jumlahnya hanya berbeda bila Format
      // Item stok berubah setelah halaman dibuka.
      return {
        umum: "Format Item stok Produk ini berubah sejak halaman dibuka. Muat ulang halaman, lalu isi Item stok lagi.",
      };
  }
}

const TeksTempelan = z.string();

export async function aksiTempelItemStok(
  _sebelumnya: KeadaanTempelItemStok,
  formData: FormData,
): Promise<KeadaanTempelItemStok> {
  await wajibSesiAdmin(await headers());

  const varianDipilih = bacaVarianDipilih(formData);
  const teks = TeksTempelan.safeParse(formData.get("teks"));
  if (!teks.success) notFound();
  if (teks.data.trim() === "") {
    return {
      teks: teks.data,
      galat:
        "Belum ada baris yang ditempel. Tempel satu baris untuk setiap Item stok, dengan kolom dipisah |.",
    };
  }

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengisi.
  const hasil = await tempelItemStokVarian({
    ...varianDipilih,
    teks: teks.data,
  });
  switch (hasil.hasil) {
    case "varian-tidak-ada":
      notFound();
    case "kunci-bermasalah":
      return { teks: teks.data, galat: pesanKunci(hasil.masalah) };
    case "ditempel": {
      const { kolom, tempel } = hasil;
      refresh();
      // Kotak tempel dikosongkan; baris yang ditolak tampil di daftar beserta isinya.
      return {
        teks: "",
        hasil: {
          ringkasan: tempel.ringkasan,
          ditolak: tempel.ditolak.map(({ baris, teks: isi, ...masalah }) => ({
            baris,
            teks: isi,
            keterangan:
              masalah.alasan === "kembar-dalam-tempelan"
                ? `Kembar dengan baris ${masalah.samaDenganBaris} di tempelan ini.`
                : keteranganDitolak(kolom, masalah),
          })),
        },
      };
    }
  }
}

/** Keterangan sebuah baris tempelan yang ditolak (PRD §4.2). */
function keteranganDitolak(kolom: string[], masalah: MasalahItemStok) {
  switch (masalah.alasan) {
    case "jumlah-kolom-salah":
      return `Jumlah kolomnya salah: ${masalah.jumlahKolom} kolom, padahal Format Item stok punya ${kolom.length} kolom (${kolom.join(", ")}).`;
    case "kolom-kosong":
      return `Kolom ${namaKolom(kolom, masalah.nomorKolom)} kosong.`;
    case "sudah-ada":
      return "Sama persis dengan Item stok yang sudah ada di Varian ini.";
  }
}

/** Item stok yang dipilih beserta Varian dan Produknya, dari form. Id yang tidak sah pasti tidak ada. */
function bacaItemStokDipilih(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("itemStokId"));
  if (!id.success) notFound();
  return { ...bacaVarianDipilih(formData), id: id.data };
}

const PESAN_ITEM_STOK_TIDAK_ADA =
  "Item stok ini tidak ada lagi di Varian ini, mungkin baru saja dihapus Admin lain. Muat ulang halaman untuk melihat daftar Item stok terbaru.";

/** Mengapa Item stok berstatus itu tidak bisa diubah atau dihapus (PRD §4.4). */
const SEBAB_TIDAK_BOLEH: Record<Exclude<StatusItemStok, "Tersedia">, string> = {
  Ditahan:
    "Item stok ini sedang disisihkan untuk Pesanan yang menunggu pembayaran",
  Terkirim: "Item stok ini sudah dikirim ke sebuah Pesanan",
};

/** Pesan bila Item stok tidak bisa diubah atau dihapus karena statusnya (itemStokBolehDiubah). */
function pesanTidakBoleh(
  perbuatan: "diubah" | "dihapus",
  status: Exclude<StatusItemStok, "Tersedia">,
) {
  return `Item stok ini tidak ${perbuatan}, karena berstatus ${status}: ${SEBAB_TIDAK_BOLEH[status]}. Hanya Item stok Tersedia yang bisa diubah atau dihapus. Muat ulang halaman untuk melihat status terbarunya.`;
}

export async function aksiUbahItemStok(
  _sebelumnya: KeadaanFormItemStok,
  formData: FormData,
): Promise<KeadaanFormItemStok> {
  await wajibSesiAdmin(await headers());

  const dipilih = bacaItemStokDipilih(formData);
  // Isian kolom dikirim berurutan dengan nama yang sama, menurut urutan Format Item stok.
  const nilai = NilaiItemStok.safeParse(formData.getAll("nilai"));
  if (!nilai.success) notFound();

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengubah.
  const hasil = await ubahItemStok({ ...dipilih, nilai: nilai.data });
  switch (hasil.hasil) {
    case "tidak-ada":
      return { nilai: nilai.data, galat: { umum: PESAN_ITEM_STOK_TIDAK_ADA } };
    case "tidak-boleh":
      return {
        nilai: nilai.data,
        galat: { umum: pesanTidakBoleh("diubah", hasil.status) },
      };
    case "kunci-bermasalah":
      return { nilai: nilai.data, galat: { umum: pesanKunci(hasil.masalah) } };
    case "ditolak":
      return {
        nilai: nilai.data,
        galat: galatItemStok(hasil.kolom, hasil.masalah),
      };
    case "diubah":
      refresh();
      return { nilai: hasil.nilai, tersimpan: true };
  }
}

export async function aksiHapusItemStok(
  _sebelumnya: KeadaanHapusItemStok,
  formData: FormData,
): Promise<KeadaanHapusItemStok> {
  await wajibSesiAdmin(await headers());

  const dipilih = bacaItemStokDipilih(formData);

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk menghapus.
  const hasil = await hapusItemStok(dipilih);
  switch (hasil.hasil) {
    case "tidak-ada":
      return { galat: PESAN_ITEM_STOK_TIDAK_ADA };
    case "tidak-boleh":
      return { galat: pesanTidakBoleh("dihapus", hasil.status) };
    case "dihapus":
      refresh();
      return {};
  }
}
