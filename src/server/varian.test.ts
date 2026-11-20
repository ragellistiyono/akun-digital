import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db, koneksi } from "./db";
import { itemStok, pesanan, varian } from "./db/schema";
import { tempelItemStokVarian } from "./item-stok";
import { buatPesanan } from "./pesanan";
import { qrispyTiruan } from "./qrispy-tiruan";
import { sisipkanProduk } from "./uji-katalog";
import { checkoutTertahan, selesaiDalam, sisipkanPesanan } from "./uji-pesanan";
import { daftarVarian, hapusVarian, tambahVarian, ubahVarian } from "./varian";

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
    // Penghapusan menunggu kunci Varian yang dipegang checkout.
    expect(await selesaiDalam(hapus, 300)).toBe(false);
    checkout.lanjutkan();
    await checkout.selesai;

    expect(await hapus).toEqual({ hasil: "pernah-dipesan", jumlahPesanan: 1 });
    expect(await sisaVarian(produkId)).toEqual(SEMUA_VARIAN);
  });
});

/** Isian form Varian 1 Bulan Netflix Premium dari PRD §3.2 dengan Harga modal itu. */
const isianSatuBulan = (hargaModal: number) => ({
  nama: "1 Bulan",
  hargaJual: 50000,
  hargaNormal: 75000,
  hargaModal,
  aktif: true,
});

/** Harga modal yang tercatat di Pesanan-Pesanan itu, menurut urutan id-nya. */
async function hargaModalPesanan(...id: string[]) {
  return Promise.all(
    id.map(async (satu) => {
      const [baris] = await db
        .select({ hargaModal: pesanan.hargaModal })
        .from(pesanan)
        .where(eq(pesanan.id, satu));
      return baris.hargaModal;
    }),
  );
}

/** Checkout Varian itu lewat buatPesanan dengan Qrispy tiruan. Hasilnya id Pesanan barunya. */
async function checkout(varianId: string) {
  const email = `budi-${randomUUID()}@example.test`;
  const hasil = await buatPesanan(
    { varianId, email },
    { qrispy: qrispyTiruan },
  );
  expect(hasil.hasil).toBe("dibuat");
  const [{ id }] = await db
    .select({ id: pesanan.id })
    .from(pesanan)
    .where(eq(pesanan.email, email));
  return id;
}

// Issue T67 (PRD §14.1 "Varian dan Pesanan tanpa Harga modal"): Varian lama tanpa Harga modal tetap bisa
// di-checkout, dan isi pertama Harga modal ikut dicatat di Pesanan lamanya.
describe("Harga modal Varian dan Pesanan", () => {
  it("checkout Varian tanpa Harga modal tetap membuat Pesanan, yang tercatat tanpa Harga modal", async () => {
    const { satuBulan } = await netflixPremium();

    const id = await checkout(satuBulan);

    expect(await hargaModalPesanan(id)).toEqual([null]);
  });

  it("contoh PRD §14.1: isi pertama Rp 35.000 dipakai Pesanan lama, lalu Rp 37.000 hanya untuk Pesanan baru", async () => {
    const { produkId, satuBulan } = await netflixPremium();
    const p1 = await checkout(satuBulan);
    const p2 = await checkout(satuBulan);

    expect(
      await ubahVarian({ id: satuBulan, produkId, ...isianSatuBulan(35000) }),
    ).toEqual({ hasil: "diubah" });
    const p3 = await checkout(satuBulan);
    expect(await hargaModalPesanan(p1, p2, p3)).toEqual([35000, 35000, 35000]);

    await ubahVarian({ id: satuBulan, produkId, ...isianSatuBulan(37000) });
    const p4 = await checkout(satuBulan);
    expect(await hargaModalPesanan(p1, p2, p3, p4)).toEqual([
      35000, 35000, 35000, 37000,
    ]);
  });

  it("isi pertama juga mengisi Pesanan Dibatalkan dan Bermasalah tanpa Harga modal, tetapi tidak Pesanan Varian lain", async () => {
    const { produkId, satuBulan, tigaBulan } = await netflixPremium();
    const dibatalkan = await sisipkanPesanan({
      varianId: satuBulan,
      status: "Dibatalkan",
    });
    const bermasalah = await sisipkanPesanan({
      varianId: satuBulan,
      status: "Bermasalah",
    });
    const varianLain = await sisipkanPesanan({
      varianId: tigaBulan,
      status: "Selesai",
    });

    await ubahVarian({ id: satuBulan, produkId, ...isianSatuBulan(800) });

    expect(
      await hargaModalPesanan(dibatalkan.id, bermasalah.id, varianLain.id),
    ).toEqual([800, 800, null]);
  });

  it("isi pertama yang disimpan saat checkout sedang berjalan menunggu checkout itu, lalu ikut mengisi Pesanan barunya", async () => {
    const { produkId, satuBulan } = await netflixPremium();
    const tertahan = checkoutTertahan(satuBulan);
    await tertahan.sudahMenahan;

    const ubah = ubahVarian({
      id: satuBulan,
      produkId,
      ...isianSatuBulan(35000),
    });
    // Penyimpanan Varian menunggu kunci Varian yang dipegang checkout.
    expect(await selesaiDalam(ubah, 300)).toBe(false);
    tertahan.lanjutkan();
    await tertahan.selesai;
    expect(await ubah).toEqual({ hasil: "diubah" });

    const semua = await db
      .select({ hargaModal: pesanan.hargaModal })
      .from(pesanan)
      .where(eq(pesanan.varianId, satuBulan));
    expect(semua).toEqual([{ hargaModal: 35000 }]);
  });

  it("Varian yang dibuat dengan Harga modal Rp 14.000 mencatatnya di Pesanan barunya", async () => {
    const produkId = await sisipkanProduk({
      nama: `YouTube Premium ${randomUUID().slice(0, 8)}`,
      varian: [],
    });
    await tambahVarian({
      produkId,
      nama: "1 Bulan",
      hargaJual: 20000,
      hargaNormal: null,
      hargaModal: 14000,
      aktif: true,
    });
    const [{ id: varianId }] = await daftarVarian(produkId);
    await tempelItemStokVarian({ produkId, varianId, teks: "kode-uji-1" });

    expect(await hargaModalPesanan(await checkout(varianId))).toEqual([14000]);
  });
});
