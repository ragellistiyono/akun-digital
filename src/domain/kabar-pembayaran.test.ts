import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/hasil-kabar-pembayaran.json";
import { hasilKabarPembayaran } from "./kabar-pembayaran";
import { STATUS_PESANAN, type StatusPesanan } from "./status-pesanan";

/** Status dari fixture golden, yang harus salah satu status Pesanan (PRD §5.7). */
function status(teks: string): StatusPesanan {
  const dikenal = STATUS_PESANAN.find((s) => s === teks);
  if (!dikenal) throw new Error(`Status "${teks}" tidak dikenal.`);
  return dikenal;
}

// PRD §5.7 dan §5.9: hasil kabar pembayaran dari Qrispy, yaitu status baru Pesanan dan perubahan Item
// stok-nya. Kabar berulang tidak mengubah apa pun.
describe("hasilKabarPembayaran", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      hasilKabarPembayaran({
        ...input,
        statusPesanan: status(input.statusPesanan),
      }),
    ).toEqual(output);
  });
});
