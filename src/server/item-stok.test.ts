import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db, koneksi } from "./db";
import { itemStok, varian } from "./db/schema";
import { daftarItemStokVarian } from "./item-stok";
import { isiItemStokUji, sisipkanProduk } from "./uji-katalog";
import { sisipkanPesanan } from "./uji-pesanan";

// Test integrasi dengan database app_test dari .env.ci, termasuk ITEM_STOK_KEY khusus test. Database itu
// dipakai bersama test lain yang berjalan bersamaan, jadi setiap test memakai Varian barunya sendiri.

afterAll(async () => {
  await koneksi.end();
});

const FORMAT = ["Email", "Password", "Profil"];

/**
 * Varian "1 Bulan" baru tanpa Item stok, milik Produk baru [CONTOH] dengan Format Item stok `Email`,
 * `Password`, `Profil` (PRD §4.1). Namanya bukan Netflix, supaya tidak mengubah hasil pencarian "netflix" di
 * test e2e yang memakai database yang sama.
 */
async function varianBaru() {
  const produkId = await sisipkanProduk({
    nama: `Daftar Item stok ${randomUUID().slice(0, 8)}`,
    formatItemStok: FORMAT,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return id;
}

/** Menyisipkan satu Item stok Tersedia dengan isi itu, terenkripsi seperti Item stok yang diisi Admin. */
async function sisipkanTersedia(varianId: string, nilai: string[]) {
  await db.insert(itemStok).values({ varianId, ...isiItemStokUji(nilai) });
}

/** Kolom Item stok dengan nama kolom Format Item stok itu, menurut urutannya. */
const kolom = (nilai: string[], nama = FORMAT) =>
  nama.map((satu, i) => ({ nama: satu, nilai: nilai[i] }));

// Contoh isi Item stok untuk format `Email`, `Password`, `Profil` seperti contoh baris PRD §4.2.
const SITI = ["siti@mail.com", "rahasia456", "Profil 3"];
const BUDI = ["budi@mail.com", "rahasia123", "Profil 2"];
const ANDI = ["andi@mail.com", "rahasia789", "Profil 1"];

/**
 * Varian dengan satu Item stok untuk setiap status: SITI Tersedia, BUDI Ditahan oleh Pesanan Menunggu
 * Pembayaran, dan ANDI Terkirim ke Pesanan Selesai dengan nama kolom lama yang dicatat saat Terkirim.
 */
async function varianTigaStatus() {
  const varianId = await varianBaru();
  await sisipkanTersedia(varianId, SITI);
  const menahan = await sisipkanPesanan({
    varianId,
    status: "Menunggu Pembayaran",
    itemStok: { status: "Ditahan", nilai: BUDI },
  });
  const menerima = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    itemStok: {
      status: "Terkirim",
      nilai: ANDI,
      formatSaatTerkirim: ["Email lama", "Password lama", "Profil lama"],
    },
  });
  return { varianId, menahan, menerima };
}

/** Isi daftar tanpa id Item stok, yang acak. */
const tanpaId = (daftar: Awaited<ReturnType<typeof daftarItemStokVarian>>) =>
  daftar.map(({ status, nomorPesanan, kolom }) => ({
    status,
    nomorPesanan,
    kolom,
  }));

describe("daftarItemStokVarian (PRD §9.7)", () => {
  it("memuat semua Item stok Varian itu beserta statusnya, Nomor Pesanan yang menahan atau menerimanya, dan isi lengkapnya", async () => {
    const { varianId, menahan, menerima } = await varianTigaStatus();

    expect(tanpaId(await daftarItemStokVarian({ varianId }))).toEqual([
      { status: "Tersedia", nomorPesanan: null, kolom: kolom(SITI) },
      {
        status: "Ditahan",
        nomorPesanan: menahan.nomorPesanan,
        kolom: kolom(BUDI),
      },
      {
        status: "Terkirim",
        nomorPesanan: menerima.nomorPesanan,
        // Item stok Terkirim tetap tampil dengan kolom lamanya (PRD §4.1).
        kolom: kolom(ANDI, ["Email lama", "Password lama", "Profil lama"]),
      },
    ]);
  });

  it.each(["Tersedia", "Ditahan", "Terkirim"] as const)(
    "saringan %s hanya memuat Item stok berstatus itu",
    async (status) => {
      const { varianId } = await varianTigaStatus();
      // Item stok Tersedia kedua, supaya saringan Tersedia memuat lebih dari satu Item stok.
      await sisipkanTersedia(varianId, [
        "dewi@mail.com",
        "rahasia000",
        "Profil 4",
      ]);

      const daftar = await daftarItemStokVarian({ varianId, status });

      expect(daftar.length).toBe(status === "Tersedia" ? 2 : 1);
      expect(daftar.every((satu) => satu.status === status)).toBe(true);
    },
  );

  it("tidak memuat Item stok Varian lain", async () => {
    const varianId = await varianBaru();
    const varianLain = await varianBaru();
    await sisipkanTersedia(varianLain, SITI);

    expect(await daftarItemStokVarian({ varianId })).toEqual([]);
  });

  it("Item stok berstatus sama urut menurut isinya, dengan angka dibandingkan sebagai angka", async () => {
    const varianId = await varianBaru();
    for (const profil of ["Profil 10", "Profil 2", "Profil 1"]) {
      await sisipkanTersedia(varianId, ["budi@mail.com", "rahasia123", profil]);
    }

    const daftar = await daftarItemStokVarian({ varianId });

    expect(daftar.map((satu) => satu.kolom[2].nilai)).toEqual([
      "Profil 1",
      "Profil 2",
      "Profil 10",
    ]);
  });
});
