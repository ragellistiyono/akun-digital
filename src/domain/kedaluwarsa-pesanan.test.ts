import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/kedaluwarsa-pesanan.json";
import { kedaluwarsaPesanan } from "./kedaluwarsa-pesanan";

// PRD §5.8: Pesanan Menunggu Pembayaran menjadi Kedaluwarsa begitu waktu kedaluwarsa QRIS dari Qrispy
// tercapai, termasuk bila kedua waktunya ditulis dalam zona waktu yang berbeda.
describe("kedaluwarsaPesanan", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      kedaluwarsaPesanan({
        kedaluwarsaPada: new Date(input.kedaluwarsaPada),
        sekarang: new Date(input.sekarang),
      }),
    ).toEqual(output);
  });
});
