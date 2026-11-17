import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { StatusPesanan } from "@/domain/status-pesanan";

import { db, koneksi } from "./db";
import { pesanan, varian, voucher } from "./db/schema";
import { sisipkanProduk } from "./uji-katalog";
import { sisipkanPesanan } from "./uji-pesanan";
import {
  bacaVoucher,
  buatVoucher,
  daftarVoucher,
  hapusVoucher,
} from "./voucher";

// Test integrasi dengan database app_test dari .env.ci, dengan Pesanan yang dibuat langsung di database.
// Database itu dipakai bersama test lain, jadi setiap test hanya memeriksa Voucher miliknya sendiri, yang
// kodenya unik per test. PRD §8.5, §8.8 (▶ Keputusan 2026-11-17), UAT-H4, UAT-H5.

let varianId = "";

beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
});

afterAll(async () => {
  await koneksi.end();
});

/** Kode Voucher unik untuk satu test, huruf besar dan angka saja. */
const kodeBaru = () =>
  `V${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;

/** Membuat Voucher nominal Rp 5.000 dengan Kuota voucher itu, lalu mengembalikan id dan kodenya. */
async function voucherBaru(kuotaVoucher: number | null) {
  const kode = kodeBaru();
  await buatVoucher({
    kode,
    jenisPotongan: "nominal",
    nilai: 5000,
    batasMaksimum: null,
    kuotaVoucher,
    batasPerEmail: 1,
    minimalHargaJual: null,
    mulai: null,
    berakhir: null,
    cakupan: { jenis: "semua" },
    khususMember: false,
    aktif: true,
  });
  const [{ id }] = await db
    .select({ id: voucher.id })
    .from(voucher)
    .where(eq(voucher.kode, kode));
  return { id, kode };
}

/** Pemakaian Voucher itu menurut daftar Voucher di dasbor admin. */
async function pemakaianDiDaftar(id: string) {
  const semua = await daftarVoucher();
  return semua.find((v) => v.id === id)?.pemakaian;
}

const ubahStatus = (id: string, status: StatusPesanan) =>
  db.update(pesanan).set({ status }).where(eq(pesanan.id, id));

describe("daftarVoucher: pemakaian (PRD §8.5, §8.8 ▶ Keputusan 2026-11-17)", () => {
  it("SATUKALI dengan Kuota voucher 1 terpakai 1 selama Pesanan Email B Menunggu Pembayaran, lalu 0 setelah Pesanan itu Dibatalkan (UAT-H4 langkah 4)", async () => {
    const satukali = await voucherBaru(1);
    const emailB = await sisipkanPesanan({
      varianId,
      status: "Menunggu Pembayaran",
      voucher: satukali,
    });

    expect(await pemakaianDiDaftar(satukali.id)).toBe(1);

    await ubahStatus(emailB.id, "Dibatalkan");

    expect(await pemakaianDiDaftar(satukali.id)).toBe(0);
  });

  it("menghitung Pesanan Menunggu Pembayaran, Selesai, dan Bermasalah, tetapi tidak Kedaluwarsa, Dibatalkan, dan Dana Dikembalikan", async () => {
    const hemat5 = await voucherBaru(null);
    for (const status of [
      "Menunggu Pembayaran",
      "Selesai",
      "Bermasalah",
      "Kedaluwarsa",
      "Dibatalkan",
      "Dana Dikembalikan",
    ] as const) {
      await sisipkanPesanan({ varianId, status, voucher: hemat5 });
    }
    // Pesanan tanpa Voucher tidak dihitung untuk Voucher mana pun.
    await sisipkanPesanan({ varianId, status: "Selesai" });

    expect(await pemakaianDiDaftar(hemat5.id)).toBe(3);
  });

  it("Voucher yang belum pernah dipakai terpakai 0", async () => {
    const baru = await voucherBaru(10);

    expect(await pemakaianDiDaftar(baru.id)).toBe(0);
  });
});

describe("hapusVoucher (PRD §8.8)", () => {
  it("COBA yang tercatat di Pesanan Dibatalkan tidak dihapus, dan hasilnya membawa jumlah Pesanan itu (UAT-H5 langkah 4)", async () => {
    const coba = await voucherBaru(null);
    await sisipkanPesanan({ varianId, status: "Dibatalkan", voucher: coba });

    expect(await hapusVoucher(coba.id)).toEqual({
      hasil: "pernah-dipakai",
      jumlahPesanan: 1,
    });
    expect(await bacaVoucher(coba.id)).not.toBeNull();
  });

  it("Voucher yang tercatat di Pesanan Selesai dan Kedaluwarsa menghitung semua Pesanannya", async () => {
    const hemat5 = await voucherBaru(null);
    await sisipkanPesanan({ varianId, status: "Selesai", voucher: hemat5 });
    await sisipkanPesanan({ varianId, status: "Kedaluwarsa", voucher: hemat5 });

    expect(await hapusVoucher(hemat5.id)).toEqual({
      hasil: "pernah-dipakai",
      jumlahPesanan: 2,
    });
  });

  it("HAPUS yang belum pernah tercatat di Pesanan terhapus (UAT-H5 langkah 5)", async () => {
    const hapus = await voucherBaru(null);

    expect(await hapusVoucher(hapus.id)).toEqual({ hasil: "dihapus" });
    expect(await bacaVoucher(hapus.id)).toBeNull();
  });

  it("Voucher yang tidak ada menghasilkan tidak-ada", async () => {
    expect(await hapusVoucher(randomUUID())).toEqual({ hasil: "tidak-ada" });
  });
});
