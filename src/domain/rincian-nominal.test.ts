import { describe, expect, it } from "vitest";

import { rincianNominal } from "./rincian-nominal";

// Baris rincian nominal sebuah Pesanan menurut Metode-nya (PRD §5.5, §15.7, §16.4).
describe("rincianNominal", () => {
  it("Pesanan QRIS: Harga jual, Potongan voucher, Kode unik, lalu Total bayar, tanpa tulisan di bawahnya (§5.5)", () => {
    expect(rincianNominal("QRIS")).toEqual({
      barisHargaDanPotongan: true,
      barisKodeUnik: true,
      keterangan: null,
    });
  });

  it('Pesanan saldo: tanpa baris Kode unik, lalu tulisan "Dibayar dengan saldo" (§15.7)', () => {
    expect(rincianNominal("Saldo")).toEqual({
      barisHargaDanPotongan: true,
      barisKodeUnik: false,
      keterangan: "Dibayar dengan saldo",
    });
  });

  it('Pesanan gratis: hanya baris Total bayar, lalu tulisan "Gratis" (§16.4)', () => {
    expect(rincianNominal("Gratis")).toEqual({
      barisHargaDanPotongan: false,
      barisKodeUnik: false,
      keterangan: "Gratis",
    });
  });
});
