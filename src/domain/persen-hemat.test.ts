import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/persen-hemat.json";
import { persenHemat } from "./persen-hemat";

// PRD §3.5: N = (Harga normal − Harga jual) ÷ Harga normal × 100, dibulatkan ke bawah, dan hanya tampil
// bila Harga normal diisi.
describe("persenHemat", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(persenHemat(input)).toMatchObject(output);
  });

  it("membawa Harga normal dan Harga jual sebagai bahan hitungnya", () => {
    expect(persenHemat({ hargaNormal: 75000, hargaJual: 50000 })).toEqual({
      tampil: true,
      persenHemat: 33,
      hargaNormal: 75000,
      hargaJual: 50000,
    });
  });
});
