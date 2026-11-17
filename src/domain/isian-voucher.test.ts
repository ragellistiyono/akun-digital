import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/isian-voucher.json";
import { periksaIsianVoucher, type IsianVoucher } from "./isian-voucher";

/** Isian dari fixture, dengan waktu mulai dan berakhir sebagai instan. */
const dariFixture = (
  input: (typeof golden.kasus)[number]["input"],
): IsianVoucher => ({
  ...input,
  jenisPotongan: input.jenisPotongan as IsianVoucher["jenisPotongan"],
  cakupan: input.cakupan as IsianVoucher["cakupan"],
  mulai: input.mulai === null ? null : new Date(input.mulai),
  berakhir: input.berakhir === null ? null : new Date(input.berakhir),
});

// PRD §8.2 dan §8.4 (▶ Keputusan 2026-11-17): isian Voucher selain kode di form dasbor admin.
describe("periksaIsianVoucher", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(periksaIsianVoucher(dariFixture(input))).toEqual(output);
  });

  // PRD §8.4 ▶ Keputusan 2026-11-17: batas maksimum dan minimal Harga jual berupa rupiah bulat.
  it("batas maksimum dan minimal Harga jual dengan sen ditolak", () => {
    expect(
      periksaIsianVoucher({
        jenisPotongan: "persen",
        nilai: 10,
        batasMaksimum: 10000.5,
        kuotaVoucher: null,
        batasPerEmail: 1,
        minimalHargaJual: 50000.5,
        mulai: null,
        berakhir: null,
        cakupan: { jenis: "semua" },
      }),
    ).toEqual({
      sah: false,
      galat: [
        "batas-maksimum-bukan-bilangan-bulat",
        "minimal-harga-jual-bukan-bilangan-bulat",
      ],
    });
  });
});
