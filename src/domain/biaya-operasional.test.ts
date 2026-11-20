import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/isian-biaya-operasional.json";
import {
  periksaIsianBiayaOperasional,
  totalBiayaOperasional,
} from "./biaya-operasional";

// PRD §14.4: tanggal paling lambat hari ini (WIB), keterangan wajib dan paling banyak 100 karakter setelah spasi
// di tepi dibuang, dan nominal rupiah bulat minimal Rp 1. Setiap isian diperiksa sendiri.
describe("periksaIsianBiayaOperasional", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(periksaIsianBiayaOperasional(input)).toEqual(output);
  });
});

// PRD §14.4 dan UAT-N5: total Biaya operasional sebulan. Contoh dari seed (Sewa server Rp 150.000) dan UAT-N5
// (Uji biaya Rp 10.000).
describe("totalBiayaOperasional", () => {
  it("menjumlahkan nominal setiap biaya dan membawa biaya yang dijumlahkan", () => {
    const biaya = [{ nominal: 10000 }, { nominal: 150000 }];
    expect(totalBiayaOperasional(biaya)).toEqual({ total: 160000, biaya });
  });

  it("bulan tanpa biaya bertotal Rp 0", () => {
    expect(totalBiayaOperasional([])).toEqual({ total: 0, biaya: [] });
  });
});
