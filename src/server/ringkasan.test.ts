import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, koneksi } from "./db";
import { varian } from "./db/schema";
import { selesaikanPesananBermasalah } from "./penyelesaian-bermasalah";
import { angkaRingkasan } from "./ringkasan";
import { sisipkanProduk } from "./uji-katalog";
import { sisipkanPesanan } from "./uji-pesanan";

// Test integrasi dengan database app_test (.env.ci), yang dipakai bersama test lain. Test lain membuat
// Pesanan yang dibayar sekitar waktu nyata atau November 2026, jadi setiap test di sini memakai "sekarang"
// pada bulan tersendiri di tahun 2031, supaya hari ini dan bulan ini hanya memuat Pesanan test itu.
let varianId = "";

beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: `Ringkasan ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 1 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
});

afterAll(async () => {
  await koneksi.end();
});

/** Rincian nominal Pesanan uji: Harga jual itu tanpa potongan voucher, ditambah Kode unik itu (PRD §5.5). */
const rincian = (hargaJual: number, kodeUnik: number) => ({
  hargaJual,
  potonganVoucher: 0,
  kodeUnik,
  totalBayar: hargaJual + kodeUnik,
});

describe("angkaRingkasan (PRD §9.2, §9.3)", () => {
  it("Pendapatan hari ini adalah jumlah Total bayar Pesanan Selesai yang dibayar hari ini menurut WIB, termasuk Kode unik, tanpa Pesanan Bermasalah dan Dana Dikembalikan", async () => {
    // Contoh PRD §9.3: Total bayar Rp 45.123, Rp 50.010, dan Rp 135.499, ditambah Pesanan Bermasalah Rp 50.200.
    for (const [status, harga, kodeUnik, dibayar] of [
      ["Selesai", 45000, 123, "2031-07-15T09:00:00+07:00"],
      ["Selesai", 50000, 10, "2031-07-15T13:30:00+07:00"],
      ["Selesai", 135000, 499, "2031-07-15T20:45:00+07:00"],
      ["Bermasalah", 50000, 200, "2031-07-15T21:00:00+07:00"],
      ["Dana Dikembalikan", 40000, 0, "2031-07-15T08:00:00+07:00"],
      // Kemarin pukul 23.59.59 WIB: bulan ini, bukan hari ini.
      ["Selesai", 10000, 0, "2031-07-14T23:59:59+07:00"],
      // Bulan lalu: tidak masuk bulan ini.
      ["Selesai", 20000, 0, "2031-06-30T23:59:59+07:00"],
    ] as const) {
      await sisipkanPesanan({
        varianId,
        status,
        rincian: rincian(harga, kodeUnik),
        waktuBayar: new Date(dibayar),
      });
    }

    const angka = await angkaRingkasan({
      sekarang: new Date("2031-07-15T22:00:00+07:00"),
    });

    expect(angka.hariIni.pendapatan.pendapatan).toBe(230632);
    expect(angka.hariIni.pesananSelesai.jumlah).toBe(3);
    expect(angka.bulanIni.pendapatan.pendapatan).toBe(240632);
    expect(angka.bulanIni.pesananSelesai.jumlah).toBe(4);
  });

  it("Pesanan yang dibuat kemarin pukul 23.58 WIB dan dibayar hari ini pukul 00.01 WIB terhitung hari ini", async () => {
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      rincian: rincian(45000, 123),
      dibuatPada: new Date("2031-08-19T23:58:00+07:00"),
      waktuBayar: new Date("2031-08-20T00:01:00+07:00"),
    });

    const angka = await angkaRingkasan({
      sekarang: new Date("2031-08-20T08:00:00+07:00"),
    });

    expect(angka.hariIni.pendapatan.pendapatan).toBe(45123);
    expect(angka.hariIni.pesananSelesai.jumlah).toBe(1);
  });

  it("Pesanan Bermasalah yang diselesaikan Admin dihitung pada tanggal pembayarannya, bukan tanggal Admin menyelesaikannya", async () => {
    const { id } = await sisipkanPesanan({
      varianId,
      status: "Bermasalah",
      rincian: rincian(45000, 123),
      waktuBayar: new Date("2031-09-09T22:00:00+07:00"),
    });
    expect(
      await selesaikanPesananBermasalah(
        { pesananId: id, cara: "kirim-item-stok" },
        { sekarang: new Date("2031-09-10T09:00:00+07:00") },
      ),
    ).toEqual({ hasil: "diselesaikan" });

    const tanggalBayar = await angkaRingkasan({
      sekarang: new Date("2031-09-09T23:00:00+07:00"),
    });
    const tanggalDiselesaikan = await angkaRingkasan({
      sekarang: new Date("2031-09-10T12:00:00+07:00"),
    });

    expect(tanggalBayar.hariIni.pendapatan.pendapatan).toBe(45123);
    expect(tanggalBayar.hariIni.pesananSelesai.jumlah).toBe(1);
    expect(tanggalDiselesaikan.hariIni.pendapatan.pendapatan).toBe(0);
    expect(tanggalDiselesaikan.hariIni.pesananSelesai.jumlah).toBe(0);
  });
});
