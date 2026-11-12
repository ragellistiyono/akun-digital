import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { db, koneksi } from "./db";
import { itemStok, pesanan, produk, varian } from "./db/schema";
import { unggahFotoProduk } from "./foto-produk";
import { buatPesanan } from "./pesanan";
import { hapusProduk } from "./produk";
import type { Qrispy } from "./qrispy";
import { qrispyTiruan } from "./qrispy-tiruan";
import { sisipkanProduk } from "./uji-katalog";
import { checkoutTertahan, selesaiDalam, sisipkanPesanan } from "./uji-pesanan";
import { adaBerkasBerisi, pngUnik } from "./uji-unggahan";

// Test integrasi dengan database app_test dan folder unggahan dari .env.ci.
afterAll(async () => {
  await koneksi.end();
});

const namaUnik = (nama: string) => `${nama} ${randomUUID().slice(0, 8)}`;

/**
 * Netflix Premium baru dengan Varian "1 Bulan" (10 Item stok Tersedia) dan "3 Bulan" (4 Item stok Tersedia),
 * seperti persiapan bersama docs/UAT.md. Hasilnya id Produk dan id kedua Variannya.
 */
async function netflixPremium() {
  const produkId = await sisipkanProduk({
    nama: namaUnik("Netflix Premium"),
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

/** Jumlah baris Produk itu, Variannya, dan Item stok Variannya yang masih ada di database. */
async function sisa(produkId: string, semuaVarianId: string[]) {
  const [produkAda, varianAda, itemAda] = await Promise.all([
    db.select({ id: produk.id }).from(produk).where(eq(produk.id, produkId)),
    db
      .select({ id: varian.id })
      .from(varian)
      .where(eq(varian.produkId, produkId)),
    db
      .select({ id: itemStok.id })
      .from(itemStok)
      .where(inArray(itemStok.varianId, semuaVarianId)),
  ]);
  return {
    produk: produkAda.length,
    varian: varianAda.length,
    itemStok: itemAda.length,
  };
}

// Issue T29 (PRD §3.7): Produk yang sudah pernah dipesan, di Pesanan berstatus apa pun, tidak bisa dihapus.
describe("hapusProduk", () => {
  it("Netflix Premium yang Pesanannya Kedaluwarsa ditolak, dan Produk, Varian, serta Item stok-nya tetap ada (UAT-C6 langkah 3)", async () => {
    const { produkId, satuBulan, tigaBulan } = await netflixPremium();
    await sisipkanPesanan({ varianId: satuBulan, status: "Kedaluwarsa" });

    expect(await hapusProduk(produkId)).toEqual({
      hasil: "pernah-dipesan",
      jumlahPesanan: 1,
    });

    expect(await sisa(produkId, [satuBulan, tigaBulan])).toEqual({
      produk: 1,
      varian: 2,
      itemStok: 14,
    });
  });

  it("Netflix Premium yang Pesanannya Dibatalkan ditolak", async () => {
    const { produkId, satuBulan, tigaBulan } = await netflixPremium();
    await sisipkanPesanan({ varianId: tigaBulan, status: "Dibatalkan" });

    expect(await hapusProduk(produkId)).toEqual({
      hasil: "pernah-dipesan",
      jumlahPesanan: 1,
    });
    expect(await sisa(produkId, [satuBulan, tigaBulan])).toEqual({
      produk: 1,
      varian: 2,
      itemStok: 14,
    });
  });

  it("Pesanan semua Varian dihitung: Selesai di 1 Bulan dan Kedaluwarsa di 3 Bulan menjadi 2 Pesanan", async () => {
    const { produkId, satuBulan, tigaBulan } = await netflixPremium();
    await sisipkanPesanan({ varianId: satuBulan, status: "Selesai" });
    await sisipkanPesanan({ varianId: tigaBulan, status: "Kedaluwarsa" });

    expect(await hapusProduk(produkId)).toEqual({
      hasil: "pernah-dipesan",
      jumlahPesanan: 2,
    });
  });

  it("Produk yang belum pernah dipesan dihapus beserta Varian, Item stok, dan berkas fotonya", async () => {
    const { produkId, satuBulan, tigaBulan } = await netflixPremium();
    const isiFoto = [pngUnik(), pngUnik()];
    for (const isi of isiFoto) {
      await unggahFotoProduk({
        produkId,
        foto: new File([isi], "foto.png", { type: "image/png" }),
      });
    }
    expect(await Promise.all(isiFoto.map(adaBerkasBerisi))).toEqual([
      true,
      true,
    ]);

    expect(await hapusProduk(produkId)).toEqual({ hasil: "dihapus" });

    expect(await sisa(produkId, [satuBulan, tigaBulan])).toEqual({
      produk: 0,
      varian: 0,
      itemStok: 0,
    });
    expect(await Promise.all(isiFoto.map(adaBerkasBerisi))).toEqual([
      false,
      false,
    ]);
  });

  it("Produk yang tidak ada tidak menghapus apa pun", async () => {
    expect(await hapusProduk(randomUUID())).toEqual({ hasil: "tidak-ada" });
  });

  it("checkout yang sedang menahan Item stok saat Produk dihapus: penghapusan menunggu, lalu ditolak karena Pesanan barunya", async () => {
    const { produkId, satuBulan, tigaBulan } = await netflixPremium();
    const checkout = checkoutTertahan(satuBulan);
    await checkout.sudahMenahan;

    const hapus = hapusProduk(produkId);
    // Penghapusan menunggu kunci Item stok yang dipegang checkout.
    expect(await selesaiDalam(hapus, 300)).toBe(false);
    checkout.lanjutkan();
    await checkout.selesai;

    expect(await hapus).toEqual({ hasil: "pernah-dipesan", jumlahPesanan: 1 });
    expect(await sisa(produkId, [satuBulan, tigaBulan])).toEqual({
      produk: 1,
      varian: 2,
      itemStok: 14,
    });
  });

  it("Produk dihapus saat checkout sudah lolos pemeriksaan stok dan menunggu QRIS: checkout ditolak karena stok habis, tanpa Pesanan, dan QRIS-nya dibatalkan", async () => {
    const { produkId, satuBulan, tigaBulan } = await netflixPremium();
    const email = `budi-${randomUUID()}@example.test`;
    let hapus: ReturnType<typeof hapusProduk> | undefined;
    const qrispy: Qrispy = {
      buatQris: async ({ amount }) => {
        hapus = hapusProduk(produkId);
        await hapus;
        return {
          qrisId: randomUUID(),
          amount: amount + 123,
          requestedAmount: amount,
          uniqueId: 123,
          expiredAt: new Date(Date.now() + 15 * 60 * 1000),
          gambarQr: "data:image/png;base64,iVBORw0KGgo=",
        };
      },
      batalkanQris: vi.fn(async () => {}),
      cekStatusQris: qrispyTiruan.cekStatusQris,
    };

    expect(
      await buatPesanan({ varianId: satuBulan, email }, { qrispy }),
    ).toEqual({ hasil: "stok-habis" });

    expect(await hapus).toEqual({ hasil: "dihapus" });
    expect(qrispy.batalkanQris).toHaveBeenCalledOnce();
    expect(
      await db.select().from(pesanan).where(eq(pesanan.email, email)),
    ).toEqual([]);
    expect(await sisa(produkId, [satuBulan, tigaBulan])).toEqual({
      produk: 0,
      varian: 0,
      itemStok: 0,
    });
  });
});
