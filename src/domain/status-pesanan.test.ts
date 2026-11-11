import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/transisi-status-pesanan.json";
import {
  perpindahanStatusPesanan,
  STATUS_PESANAN,
  type StatusPesanan,
} from "./status-pesanan";

/** Status dari fixture golden, yang harus salah satu status Pesanan (PRD §5.7). */
function status(teks: string): StatusPesanan {
  const dikenal = STATUS_PESANAN.find((s) => s === teks);
  if (!dikenal) throw new Error(`Status "${teks}" tidak dikenal.`);
  return dikenal;
}

// PRD §5.7: perpindahan status yang boleh terjadi.
describe("perpindahanStatusPesanan", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      perpindahanStatusPesanan({
        dari: status(input.dari),
        ke: status(input.ke),
      }),
    ).toEqual(output);
  });

  it("fixture memuat semua pasangan status yang berbeda", () => {
    expect(golden.kasus).toHaveLength(
      STATUS_PESANAN.length * (STATUS_PESANAN.length - 1),
    );
  });
});
