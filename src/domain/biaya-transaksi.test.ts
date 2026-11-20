import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/biaya-transaksi.json";
import goldenIsian from "../../tests/golden/isian-biaya-transaksi.json";
import { biayaTransaksi, periksaIsianBiayaTransaksi } from "./biaya-transaksi";

// PRD §14.3: bila Total bayar sama dengan atau lebih dari minimal, Total bayar × persen ÷ 100 dibulatkan ke atas
// ke rupiah; bila kurang, Rp 0. Hasilnya membawa bahan hitungnya.
describe("biayaTransaksi", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(biayaTransaksi(input)).toEqual({ ...input, ...output });
  });
});

// PRD §9.8, §14.3: persen 0 sampai 10 dengan paling banyak 2 angka di belakang koma, dan minimal Total bayar
// rupiah bulat minimal Rp 0. Setiap isian diperiksa sendiri.
describe("periksaIsianBiayaTransaksi", () => {
  it.each(goldenIsian.kasus)("$nama", ({ input, output }) => {
    expect(periksaIsianBiayaTransaksi(input)).toEqual(output);
  });
});
