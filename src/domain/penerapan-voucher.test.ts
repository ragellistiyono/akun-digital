import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/penerapan-voucher.json";
import type { JenisPotongan } from "./isian-voucher";
import type { PenolakanVoucher } from "./kelayakan-voucher";
import { penerapanVoucher } from "./penerapan-voucher";

type KasusGolden = (typeof golden.kasus)[number];

/**
 * Penolakan untuk pesan kelayakan di fixture, menurut daftar pesan PRD §8.7. Fixture hanya mencatat pesannya,
 * jadi alasannya diambil dari daftar ini.
 */
const PENOLAKAN_GOLDEN: Record<string, PenolakanVoucher> = {
  "Minimal pembelian Rp 50.000": {
    diterima: false,
    alasan: "di-bawah-minimal-harga-jual",
    minimalHargaJual: 50000,
    pesan: "Minimal pembelian Rp 50.000",
  },
  "Kuota voucher habis": {
    diterima: false,
    alasan: "kuota-habis",
    pesan: "Kuota voucher habis",
  },
};

const kelayakanGolden = ({
  diterima,
  pesan,
}: KasusGolden["input"]["kelayakan"]) => {
  if (diterima) return { diterima, alasan: null, pesan: null };
  const penolakan = pesan === null ? undefined : PENOLAKAN_GOLDEN[pesan];
  if (!penolakan) throw new Error(`Pesan golden belum dipetakan: ${pesan}`);
  return penolakan;
};

const inputGolden = ({
  hargaJual,
  voucher,
  kelayakan,
}: KasusGolden["input"]) => ({
  hargaJual,
  voucher: {
    ...voucher,
    jenisPotongan: voucher.jenisPotongan as JenisPotongan,
  },
  kelayakan: kelayakanGolden(kelayakan),
});

// PRD §8.3 dan §8.7 (▶ Keputusan 2026-11-17): Voucher yang potongan vouchernya Rp 0 ditolak, dan pesan itu
// paling bawah dalam urutan §8.7.
describe("penerapanVoucher", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const hasil = penerapanVoucher(inputGolden(input));

    expect({
      dipakai: hasil.dipakai,
      potonganVoucher: hasil.potonganVoucher,
      pesan: hasil.pesan,
    }).toEqual(output);
  });

  it("Voucher yang dipakai membawa Harga jual dan Harga jual setelah potongan sebagai bahan hitungnya", () => {
    const hasil = penerapanVoucher(inputGolden(golden.kasus[0].input));

    expect(hasil).toEqual({
      dipakai: true,
      alasan: null,
      pesan: null,
      hargaJual: 50000,
      potonganVoucher: 5000,
      hargaSetelahPotongan: 45000,
    });
  });

  it("Voucher tanpa potongan ditolak dengan alasannya", () => {
    const kasus = golden.kasus.find(
      (k) => k.nama === "Nominal pada Harga jual Rp 1.000",
    );
    if (!kasus) throw new Error("Kasus golden tidak ditemukan.");

    expect(penerapanVoucher(inputGolden(kasus.input))).toMatchObject({
      dipakai: false,
      alasan: "tanpa-potongan",
    });
  });
});
