import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db, koneksi } from "./db";
import { varian } from "./db/schema";
import { bacaDetailPesanan } from "./detail-pesanan";
import { bacaStokVarian } from "./item-stok";
import { pekerjaanEmailPesananSelesai } from "./pekerjaan-latar";
import { selesaikanPesananBermasalah } from "./penyelesaian-bermasalah";
import { sisipkanProduk } from "./uji-katalog";
import { sisipkanPesanan } from "./uji-pesanan";

// Test integrasi dengan database app_test dari .env.ci, yang dipakai bersama test lain. Setiap test
// menyiapkan Produk dan Pesanannya sendiri langsung di database, dengan Produk [CONTOH] berakhiran unik.
// Pekerja pg-boss tidak berjalan di proses test, jadi email "Pesanan selesai" diperiksa dari pekerjaan yang
// dijadwalkan.
afterAll(async () => {
  await koneksi.end();
});

const FORMAT = ["Email", "Password", "Profil"];
const SEKARANG = new Date("2026-11-12T10:00:00+07:00");

/**
 * Produk [CONTOH] dengan dua Varian: "1 Bulan" dengan Stok Varian `stok`, dan "3 Bulan" dengan 3 Item stok
 * Tersedia. Hasilnya id kedua Varian itu.
 */
async function siapkanVarian(stok: number) {
  const produkId = await sisipkanProduk({
    nama: `Selesaikan Bermasalah ${randomUUID().slice(0, 8)}`,
    formatItemStok: FORMAT,
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, Tersedia: stok },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 3 },
    ],
  });
  const semua = await db
    .select({ id: varian.id, nama: varian.nama })
    .from(varian)
    .where(eq(varian.produkId, produkId))
    .orderBy(asc(varian.hargaJual));
  return { varianId: semua[0].id, varianLainId: semua[1].id };
}

/** Status, Item stok, dan baris terakhir riwayat status Pesanan itu menurut detail Pesanan di dasbor admin. */
async function detail(nomorPesanan: string) {
  const dibaca = await bacaDetailPesanan(nomorPesanan);
  if (!dibaca) throw new Error(`Pesanan ${nomorPesanan} tidak ditemukan.`);
  return dibaca;
}

describe("Kirim Item stok (PRD §5.9)", () => {
  // Issue T26 dan UAT-E6: Pesanan pertama menjadi Selesai, mendapat satu Item stok dari Varian yang sama,
  // dan emailnya dikirim lewat T23.
  it("Pesanan Bermasalah menjadi Selesai, tepat satu Item stok Varian yang sama menjadi Terkirim, dan satu email dijadwalkan", async () => {
    const { varianId, varianLainId } = await siapkanVarian(2);
    const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });

    const hasil = await selesaikanPesananBermasalah(
      { pesananId: dipesan.id, cara: "kirim-item-stok" },
      { sekarang: SEKARANG },
    );

    expect(hasil).toEqual({ hasil: "diselesaikan" });
    const sesudah = await detail(dipesan.nomorPesanan);
    expect(sesudah.status).toBe("Selesai");
    expect(sesudah.itemStok?.map(({ nama }) => nama)).toEqual(FORMAT);
    expect(sesudah.riwayat.at(-1)).toEqual({
      waktu: SEKARANG,
      status: "Selesai",
      pelaku: "Admin",
    });
    expect(await bacaStokVarian(varianId)).toEqual({
      stokVarian: 1,
      jumlahPerStatus: { Tersedia: 1, Ditahan: 0, Terkirim: 1 },
    });
    expect((await bacaStokVarian(varianLainId)).stokVarian).toBe(3);
    expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toHaveLength(1);
  });
});

describe("Kirim Item stok saat Stok Varian 0 (PRD §5.9)", () => {
  // Issue T26: bila Stok Varian 0, aksi ditolak dan status tetap Bermasalah. Item stok dari Varian lain di
  // Produk yang sama tidak bisa dipakai.
  it("ditolak walaupun Varian lain masih punya Item stok: Pesanan tetap Bermasalah tanpa Item stok, dan tidak ada email yang dijadwalkan", async () => {
    const { varianId, varianLainId } = await siapkanVarian(0);
    const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });

    const hasil = await selesaikanPesananBermasalah(
      { pesananId: dipesan.id, cara: "kirim-item-stok" },
      { sekarang: SEKARANG },
    );

    expect(hasil).toEqual({ hasil: "stok-habis" });
    const sesudah = await detail(dipesan.nomorPesanan);
    expect(sesudah.status).toBe("Bermasalah");
    expect(sesudah.itemStok).toBeNull();
    expect(sesudah.riwayat).toEqual([]);
    expect(await bacaStokVarian(varianLainId)).toEqual({
      stokVarian: 3,
      jumlahPerStatus: { Tersedia: 3, Ditahan: 0, Terkirim: 0 },
    });
    expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);
  });

  it("Item stok Varian itu yang sedang Ditahan Pesanan lain tidak dipakai", async () => {
    const { varianId } = await siapkanVarian(0);
    await sisipkanPesanan({
      varianId,
      status: "Menunggu Pembayaran",
      itemStok: { status: "Ditahan", nilai: ["a@contoh.id", "Senja-1", "1"] },
    });
    const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });

    const hasil = await selesaikanPesananBermasalah(
      { pesananId: dipesan.id, cara: "kirim-item-stok" },
      { sekarang: SEKARANG },
    );

    expect(hasil).toEqual({ hasil: "stok-habis" });
    expect((await detail(dipesan.nomorPesanan)).status).toBe("Bermasalah");
    expect((await bacaStokVarian(varianId)).jumlahPerStatus).toEqual({
      Tersedia: 0,
      Ditahan: 1,
      Terkirim: 0,
    });
  });
});

describe("Tandai Dana Dikembalikan (PRD §5.9)", () => {
  // Issue T26 dan UAT-E6: Pesanan kedua menjadi Dana Dikembalikan tanpa Item stok.
  it("Pesanan Bermasalah menjadi Dana Dikembalikan tanpa Item stok, Stok Varian tidak berubah, dan tidak ada email yang dijadwalkan", async () => {
    const { varianId } = await siapkanVarian(2);
    const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });

    const hasil = await selesaikanPesananBermasalah(
      { pesananId: dipesan.id, cara: "dana-dikembalikan" },
      { sekarang: SEKARANG },
    );

    expect(hasil).toEqual({ hasil: "diselesaikan" });
    const sesudah = await detail(dipesan.nomorPesanan);
    expect(sesudah.status).toBe("Dana Dikembalikan");
    expect(sesudah.itemStok).toBeNull();
    expect(sesudah.riwayat).toEqual([
      { waktu: SEKARANG, status: "Dana Dikembalikan", pelaku: "Admin" },
    ]);
    expect((await bacaStokVarian(varianId)).jumlahPerStatus).toEqual({
      Tersedia: 2,
      Ditahan: 0,
      Terkirim: 0,
    });
    expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);
  });
});

describe("Pesanan selain Bermasalah (PRD §5.7)", () => {
  // Issue T26: kedua aksi tidak tersedia untuk Pesanan selain Bermasalah.
  for (const status of [
    "Menunggu Pembayaran",
    "Selesai",
    "Kedaluwarsa",
    "Dibatalkan",
    "Dana Dikembalikan",
  ] as const) {
    for (const cara of ["kirim-item-stok", "dana-dikembalikan"] as const) {
      it(`${cara} untuk Pesanan ${status} tidak mengubah Pesanan maupun Item stok`, async () => {
        const { varianId } = await siapkanVarian(2);
        const dipesan = await sisipkanPesanan({ varianId, status });

        const hasil = await selesaikanPesananBermasalah(
          { pesananId: dipesan.id, cara },
          { sekarang: SEKARANG },
        );

        expect(hasil).toEqual({ hasil: "tidak-tersedia", status });
        const sesudah = await detail(dipesan.nomorPesanan);
        expect(sesudah.status).toBe(status);
        expect(sesudah.riwayat).toEqual([]);
        expect((await bacaStokVarian(varianId)).stokVarian).toBe(2);
        expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);
      });
    }
  }

  it("Pesanan yang tidak ada tidak mengubah apa pun", async () => {
    expect(
      await selesaikanPesananBermasalah({
        pesananId: randomUUID(),
        cara: "kirim-item-stok",
      }),
    ).toEqual({ hasil: "tidak-ada" });
  });
});

describe("klik ganda dan klik bersamaan", () => {
  // Issue T26: dua permintaan Kirim Item stok yang bersamaan hanya memberi satu Item stok.
  it("tiga permintaan Kirim Item stok yang bersamaan untuk Pesanan yang sama hanya memberi satu Item stok dan satu email", async () => {
    const { varianId } = await siapkanVarian(3);
    const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });

    const hasil = await Promise.all(
      [1, 2, 3].map(() =>
        selesaikanPesananBermasalah(
          { pesananId: dipesan.id, cara: "kirim-item-stok" },
          { sekarang: SEKARANG },
        ),
      ),
    );

    expect(hasil.filter(({ hasil }) => hasil === "diselesaikan")).toHaveLength(
      1,
    );
    expect(hasil.filter(({ hasil }) => hasil === "tidak-tersedia")).toEqual([
      { hasil: "tidak-tersedia", status: "Selesai" },
      { hasil: "tidak-tersedia", status: "Selesai" },
    ]);
    const sesudah = await detail(dipesan.nomorPesanan);
    expect(sesudah.status).toBe("Selesai");
    expect(sesudah.riwayat).toHaveLength(1);
    expect((await bacaStokVarian(varianId)).jumlahPerStatus).toEqual({
      Tersedia: 2,
      Ditahan: 0,
      Terkirim: 1,
    });
    expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toHaveLength(1);
  });

  it("Kirim Item stok dan Tandai Dana Dikembalikan yang bersamaan hanya menjalankan salah satunya", async () => {
    const { varianId } = await siapkanVarian(2);
    const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });

    const hasil = await Promise.all(
      (["kirim-item-stok", "dana-dikembalikan"] as const).map((cara) =>
        selesaikanPesananBermasalah(
          { pesananId: dipesan.id, cara },
          { sekarang: SEKARANG },
        ),
      ),
    );

    expect(hasil.filter(({ hasil }) => hasil === "diselesaikan")).toHaveLength(
      1,
    );
    const sesudah = await detail(dipesan.nomorPesanan);
    expect(sesudah.riwayat).toHaveLength(1);
    const terkirim = (await bacaStokVarian(varianId)).jumlahPerStatus.Terkirim;
    if (sesudah.status === "Selesai") {
      expect(terkirim).toBe(1);
      expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toHaveLength(1);
    } else {
      expect(sesudah.status).toBe("Dana Dikembalikan");
      expect(terkirim).toBe(0);
      expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);
    }
  });

  it("dua Pesanan Bermasalah Varian yang sama dengan Stok Varian 1 yang diselesaikan bersamaan: hanya satu yang mendapat Item stok", async () => {
    const { varianId } = await siapkanVarian(1);
    const pertama = await sisipkanPesanan({ varianId, status: "Bermasalah" });
    const kedua = await sisipkanPesanan({ varianId, status: "Bermasalah" });

    const hasil = await Promise.all(
      [pertama, kedua].map(({ id }) =>
        selesaikanPesananBermasalah(
          { pesananId: id, cara: "kirim-item-stok" },
          { sekarang: SEKARANG },
        ),
      ),
    );

    expect(hasil.map(({ hasil }) => hasil).sort()).toEqual([
      "diselesaikan",
      "stok-habis",
    ]);
    const status = [
      (await detail(pertama.nomorPesanan)).status,
      (await detail(kedua.nomorPesanan)).status,
    ].sort();
    expect(status).toEqual(["Bermasalah", "Selesai"]);
    expect((await bacaStokVarian(varianId)).jumlahPerStatus).toEqual({
      Tersedia: 0,
      Ditahan: 0,
      Terkirim: 1,
    });
  });
});
