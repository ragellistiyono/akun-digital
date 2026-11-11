import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/stok-varian.json";
import { stokVarian } from "./stok-varian";

// PRD §5.3: Stok Varian = jumlah Item stok Varian yang belum terkirim dan tidak sedang ditahan, yaitu
// yang berstatus Tersedia.
describe("stokVarian", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(stokVarian(input)).toMatchObject(output);
  });

  it("membawa jumlah Item stok per status sebagai bahan hitungnya", () => {
    const jumlahPerStatus = { Tersedia: 8, Ditahan: 2, Terkirim: 5 };

    expect(stokVarian({ jumlahPerStatus })).toEqual({
      stokVarian: 8,
      jumlahPerStatus: { Tersedia: 8, Ditahan: 2, Terkirim: 5 },
    });
  });
});
