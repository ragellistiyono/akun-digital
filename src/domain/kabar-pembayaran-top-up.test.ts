import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/kabar-pembayaran-top-up.json";
import { hasilKabarPembayaranTopUp } from "./kabar-pembayaran-top-up";
import { STATUS_TOP_UP, type StatusTopUp } from "./status-top-up";

/** Status dari fixture golden, yang harus salah satu status Top up (PRD §15.4). */
function status(teks: string): StatusTopUp {
  const dikenal = STATUS_TOP_UP.find((s) => s === teks);
  if (!dikenal) throw new Error(`Status "${teks}" tidak dikenal.`);
  return dikenal;
}

// PRD §15.4 dan §15.5: hasil kabar pembayaran untuk Top up, yaitu status baru, tambahan saldo, dan Biaya transaksi
// yang dicatat. Kabar berulang tidak mengubah apa pun.
describe("hasilKabarPembayaranTopUp", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      hasilKabarPembayaranTopUp({
        ...input,
        statusTopUp: status(input.statusTopUp),
      }),
    ).toEqual(output);
  });
});
