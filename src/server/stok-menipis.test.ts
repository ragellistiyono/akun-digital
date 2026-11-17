import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { koneksi } from "./db";
import { daftarStokMenipis } from "./stok-menipis";
import { sisipkanProduk } from "./uji-katalog";

// Test integrasi dengan database app_test (.env.ci). Database test dipakai bersama oleh semua test, jadi
// Produk di sini diberi akhiran unik, dan hasilnya hanya diperiksa untuk Produk-Produk itu.
const akhiran = randomUUID().slice(0, 8);
const idProduk: string[] = [];

/** Varian dari Produk test ini saja, sebagai "nama Produk / nama Varian (Stok Varian)". */
async function stokMenipisDiTestIni(ambang: number) {
  const hasil = await daftarStokMenipis({ ambang });
  return {
    ambang: hasil.ambang,
    varian: hasil.varian
      .filter((v) => idProduk.includes(v.produkId))
      .map(
        (v) =>
          `${v.namaProduk.replace(` ${akhiran}`, "")} / ${v.namaVarian} (${v.stokVarian})`,
      ),
  };
}

beforeAll(async () => {
  idProduk.push(
    await sisipkanProduk({
      nama: `Netflix Premium ${akhiran}`,
      varian: [
        // Stok Varian 5, tepat di ambang 5 (PRD §9.4).
        { nama: "1 Bulan", hargaJual: 50000, Tersedia: 5 },
        // Stok Varian 6, di atas ambang 5.
        { nama: "3 Bulan", hargaJual: 135000, Tersedia: 6 },
        // Item stok Ditahan dan Terkirim tidak dihitung (PRD §5.3): Stok Varian 4, bukan 9.
        {
          nama: "6 Bulan",
          hargaJual: 250000,
          Tersedia: 4,
          Ditahan: 3,
          Terkirim: 2,
        },
        // Varian nonaktif tidak masuk, walaupun Stok Varian-nya 1.
        { nama: "1 Minggu", hargaJual: 20000, Tersedia: 1, aktif: false },
      ],
    }),
    await sisipkanProduk({
      nama: `YouTube Premium ${akhiran}`,
      // Varian tanpa Item stok: Stok Varian 0.
      varian: [{ nama: "1 Bulan", hargaJual: 20000 }],
    }),
    await sisipkanProduk({
      nama: `Game Lama ${akhiran}`,
      aktif: false,
      // Varian dari Produk nonaktif tidak masuk, walaupun Stok Varian-nya 2.
      varian: [{ nama: "Paket", hargaJual: 30000, Tersedia: 2 }],
    }),
  );
});

afterAll(async () => {
  await koneksi.end();
});

describe("daftarStokMenipis (PRD §9.4)", () => {
  it("dengan ambang 5, Varian aktif dari Produk aktif dengan Stok Varian 5 atau kurang masuk daftar, Stok Varian terkecil di atas", async () => {
    expect(await stokMenipisDiTestIni(5)).toEqual({
      ambang: 5,
      varian: [
        "YouTube Premium / 1 Bulan (0)",
        "Netflix Premium / 6 Bulan (4)",
        "Netflix Premium / 1 Bulan (5)",
      ],
    });
  });

  it("dengan ambang 3, hanya Varian dengan Stok Varian 3 atau kurang yang masuk daftar", async () => {
    expect(await stokMenipisDiTestIni(3)).toEqual({
      ambang: 3,
      varian: ["YouTube Premium / 1 Bulan (0)"],
    });
  });

  it("dengan ambang 6, Varian dengan Stok Varian 6 ikut masuk daftar", async () => {
    expect((await stokMenipisDiTestIni(6)).varian).toContain(
      "Netflix Premium / 3 Bulan (6)",
    );
  });
});
