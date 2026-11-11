import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/validasi-harga.json";
import { periksaHarga } from "./validasi-harga";

// PRD §3.2 (▶ Keputusan 2026-11-11) dan §3.5: Harga jual minimal Rp 1.000, maksimal Rp 499.000, dan
// rupiah bulat. Harga normal opsional, harus lebih besar dari Harga jual, dan tidak dibatasi maksimum.
describe("periksaHarga", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(periksaHarga(input)).toEqual(output);
  });
});
