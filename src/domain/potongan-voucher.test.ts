import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/potongan-voucher.json";
import type { JenisPotongan } from "./isian-voucher";
import { potonganVoucher } from "./potongan-voucher";

// PRD §8.2, §8.3: persen dibulatkan ke bawah lalu dibatasi batas maksimum, dan Harga jual dikurangi potongan
// voucher tidak pernah kurang dari Rp 1.000.
describe("potonganVoucher", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const hasil = potonganVoucher({
      hargaJual: input.hargaJual,
      voucher: {
        jenisPotongan: input.jenisPotongan as JenisPotongan,
        nilai: input.nilai,
        batasMaksimum: input.batasMaksimum,
      },
    });

    expect({
      potonganVoucher: hasil.potonganVoucher,
      hargaSetelahPotongan: hasil.hargaSetelahPotongan,
    }).toEqual(output);
  });

  it("membawa potongan dasar sebagai bahan hitungnya (PRD §8.3, contoh Rp 135.000)", () => {
    const hasil = potonganVoucher({
      hargaJual: 135000,
      voucher: { jenisPotongan: "persen", nilai: 10, batasMaksimum: 10000 },
    });

    expect(hasil).toEqual({
      hargaJual: 135000,
      potonganDasar: 10000,
      potonganVoucher: 10000,
      hargaSetelahPotongan: 125000,
    });
  });
});
