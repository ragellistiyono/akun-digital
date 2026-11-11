import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/batas-pesanan-menunggu.json";
import { batasPesananMenunggu } from "./batas-pesanan-menunggu";
import { STATUS_PESANAN, type StatusPesanan } from "./status-pesanan";

/** Status dari fixture golden, yang harus salah satu status Pesanan (PRD §5.7). */
function status(teks: string): StatusPesanan {
  const dikenal = STATUS_PESANAN.find((s) => s === teks);
  if (!dikenal) throw new Error(`Status "${teks}" tidak dikenal.`);
  return dikenal;
}

// PRD §5.4: satu email paling banyak punya 1 Pesanan Menunggu Pembayaran, dengan email dibandingkan
// menurut §7.4.
describe("batasPesananMenunggu", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const hasil = batasPesananMenunggu({
      email: input.email,
      pesananLain: input.pesananLain.map((p) => ({
        ...p,
        status: status(p.status),
      })),
    });

    expect(hasil.boleh).toBe(output.boleh);
  });

  it("bila tidak boleh, hasilnya membawa Pesanan Menunggu Pembayaran milik email itu", () => {
    const menunggu = {
      email: "budi@mail.com",
      status: "Menunggu Pembayaran",
      tautan: "tautan-budi",
    } as const;

    const hasil = batasPesananMenunggu({
      email: "  BUDI@mail.com ",
      pesananLain: [
        { email: "budi@mail.com", status: "Selesai", tautan: "tautan-lama" },
        {
          email: "sinta@mail.com",
          status: "Menunggu Pembayaran",
          tautan: "tautan-sinta",
        },
        menunggu,
      ],
    });

    expect(hasil).toEqual({ boleh: false, pesananMenunggu: menunggu });
  });
});
