import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db, koneksi } from "./db";
import { itemStok, varian } from "./db/schema";
import { sisipkanProduk } from "./uji-katalog";
import { checkoutTertahan, selesaiDalam, sisipkanPesanan } from "./uji-pesanan";
import { hapusVarian } from "./varian";

// Test integrasi dengan database app_test dari .env.ci.
afterAll(async () => {
  await koneksi.end();
});

/**
 * Netflix Premium baru dengan Varian "1 Bulan" (10 Item stok Tersedia) dan "3 Bulan" (4 Item stok Tersedia),
 * seperti persiapan bersama docs/UAT.md. Hasilnya id Produk dan id kedua Variannya.
 */
async function netflixPremium() {
  const produkId = await sisipkanProduk({
    nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
    formatItemStok: ["Email", "Password", "Profil"],
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, hargaNormal: 75000, Tersedia: 10 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
    ],
  });
  const semuaVarian = await db
    .select({ id: varian.id, nama: varian.nama })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const idVarian = (nama: string) =>
    semuaVarian.find((v) => v.nama === nama)?.id ?? "";
  return {
    produkId,
    satuBulan: idVarian("1 Bulan"),
    tigaBulan: idVarian("3 Bulan"),
  };
}

/** Nama Varian Produk itu beserta jumlah Item stok-nya yang masih ada di database. */
async function sisaVarian(produkId: string) {
  const semuaVarian = await db
    .select({ id: varian.id, nama: varian.nama })
    .from(varian)
    .where(eq(varian.produkId, produkId))
    .orderBy(varian.nama);
  return Promise.all(
    semuaVarian.map(async ({ id, nama }) => ({
      nama,
      itemStok: (
        await db
          .select({ id: itemStok.id })
          .from(itemStok)
          .where(eq(itemStok.varianId, id))
      ).length,
    })),
  );
}

const SEMUA_VARIAN = [
  { nama: "1 Bulan", itemStok: 10 },
  { nama: "3 Bulan", itemStok: 4 },
];

// Issue T29 (PRD §3.7): Varian yang sudah pernah dipesan, di Pesanan berstatus apa pun, tidak bisa dihapus.
describe("hapusVarian", () => {
  it("Varian 1 Bulan yang Pesanannya Kedaluwarsa ditolak, dan Varian beserta Item stok-nya tetap ada", async () => {
    const { produkId, satuBulan } = await netflixPremium();
    await sisipkanPesanan({ varianId: satuBulan, status: "Kedaluwarsa" });

    expect(await hapusVarian({ produkId, id: satuBulan })).toEqual({
      hasil: "pernah-dipesan",
      jumlahPesanan: 1,
    });

    expect(await sisaVarian(produkId)).toEqual(SEMUA_VARIAN);
  });

  it("Varian 3 Bulan yang belum pernah dipesan dihapus beserta Item stok-nya, sedangkan Varian 1 Bulan yang pernah dipesan tetap ada", async () => {
    const { produkId, satuBulan, tigaBulan } = await netflixPremium();
    await sisipkanPesanan({ varianId: satuBulan, status: "Selesai" });

    expect(await hapusVarian({ produkId, id: tigaBulan })).toEqual({
      hasil: "dihapus",
    });

    expect(await sisaVarian(produkId)).toEqual([
      { nama: "1 Bulan", itemStok: 10 },
    ]);
    expect(
      await db.select().from(itemStok).where(eq(itemStok.varianId, tigaBulan)),
    ).toEqual([]);
  });

  it("Varian milik Produk lain, atau yang tidak ada, tidak menghapus apa pun", async () => {
    const netflix = await netflixPremium();
    const lain = await netflixPremium();

    expect(
      await hapusVarian({ produkId: lain.produkId, id: netflix.tigaBulan }),
    ).toEqual({ hasil: "tidak-ada" });
    expect(
      await hapusVarian({ produkId: netflix.produkId, id: randomUUID() }),
    ).toEqual({ hasil: "tidak-ada" });

    expect(await sisaVarian(netflix.produkId)).toEqual(SEMUA_VARIAN);
  });

  it("checkout yang sedang menahan Item stok saat Varian dihapus: penghapusan menunggu, lalu ditolak karena Pesanan barunya", async () => {
    const { produkId, tigaBulan } = await netflixPremium();
    const checkout = checkoutTertahan(tigaBulan);
    await checkout.sudahMenahan;

    const hapus = hapusVarian({ produkId, id: tigaBulan });
    // Penghapusan menunggu kunci Item stok yang dipegang checkout.
    expect(await selesaiDalam(hapus, 300)).toBe(false);
    checkout.lanjutkan();
    await checkout.selesai;

    expect(await hapus).toEqual({ hasil: "pernah-dipesan", jumlahPesanan: 1 });
    expect(await sisaVarian(produkId)).toEqual(SEMUA_VARIAN);
  });
});
