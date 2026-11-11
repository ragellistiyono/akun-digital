import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/total-bayar.json";
import {
  nominalTagihanQris,
  periksaTagihanQris,
  totalBayar,
} from "./total-bayar";

// PRD §5.5: Total bayar = Harga jual − potongan voucher + Kode unik.
describe("totalBayar", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(totalBayar(input)).toMatchObject(output);
  });

  it("membawa Harga jual, potongan voucher, dan Kode unik sebagai bahan hitungnya", () => {
    // Contoh PRD §5.5.
    expect(
      totalBayar({ hargaJual: 50000, potonganVoucher: 5000, kodeUnik: 123 }),
    ).toEqual({
      totalBayar: 45123,
      hargaJual: 50000,
      potonganVoucher: 5000,
      kodeUnik: 123,
    });
  });
});

// ADR-0004: toko mengirim Harga jual − potongan voucher sebagai `amount`. Contoh PRD §5.5: Total bayar
// Rp 45.123 dengan Kode unik Rp 123, jadi nominal yang dikirim Rp 45.000.
describe("nominalTagihanQris", () => {
  it("Harga jual dikurangi potongan voucher", () => {
    expect(
      nominalTagihanQris({ hargaJual: 50000, potonganVoucher: 5000 }),
    ).toEqual({ nominal: 45000, hargaJual: 50000, potonganVoucher: 5000 });
  });

  it("tanpa voucher, nominalnya Harga jual", () => {
    expect(
      nominalTagihanQris({ hargaJual: 50000, potonganVoucher: 0 }),
    ).toMatchObject({ nominal: 50000 });
  });
});

// ADR-0004: Total bayar adalah `amount` dan Kode unik adalah `unique_id` dari Qrispy. QRIS ditolak bila
// `requested_amount` tidak sama dengan nominal yang dikirim toko, atau `amount` tidak sama dengan
// `requested_amount + unique_id`. Angka contohnya dari docs/referensi/qrispy-api.md bagian 3.
describe("periksaTagihanQris", () => {
  it("QRIS contoh Qrispy cocok: Total bayar Rp 50.123 dengan Kode unik Rp 123", () => {
    expect(
      periksaTagihanQris({
        hargaJual: 50000,
        potonganVoucher: 0,
        requestedAmount: 50000,
        uniqueId: 123,
        amount: 50123,
      }),
    ).toEqual({
      cocok: true,
      rincian: {
        hargaJual: 50000,
        potonganVoucher: 0,
        kodeUnik: 123,
        totalBayar: 50123,
      },
    });
  });

  it("dengan potongan voucher, contoh PRD §5.5 cocok", () => {
    expect(
      periksaTagihanQris({
        hargaJual: 50000,
        potonganVoucher: 5000,
        requestedAmount: 45000,
        uniqueId: 123,
        amount: 45123,
      }),
    ).toMatchObject({ cocok: true, rincian: { totalBayar: 45123 } });
  });

  it("amount tanpa Kode unik, seperti di draf awal, ditolak", () => {
    expect(
      periksaTagihanQris({
        hargaJual: 50000,
        potonganVoucher: 0,
        requestedAmount: 50000,
        uniqueId: 123,
        amount: 50000,
      }),
    ).toEqual({ cocok: false, alasan: "amount-tidak-cocok" });
  });

  it("requested_amount yang berbeda dari nominal yang dikirim toko ditolak", () => {
    expect(
      periksaTagihanQris({
        hargaJual: 50000,
        potonganVoucher: 0,
        requestedAmount: 49000,
        uniqueId: 123,
        amount: 49123,
      }),
    ).toEqual({ cocok: false, alasan: "requested-amount-tidak-cocok" });
  });
});
