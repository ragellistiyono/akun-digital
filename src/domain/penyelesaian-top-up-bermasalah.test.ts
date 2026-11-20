import { describe, expect, it } from "vitest";

import {
  hasilPenyelesaianTopUpBermasalah,
  penyelesaianTopUpBermasalahTersedia,
} from "./penyelesaian-top-up-bermasalah";

/** Status selain Bermasalah, yang kedua aksinya tidak tersedia (PRD §15.4, §15.9). */
const BUKAN_BERMASALAH = [
  "Menunggu Pembayaran",
  "Berhasil",
  "Kedaluwarsa",
  "Dibatalkan",
  "Dana Dikembalikan",
] as const;

// PRD §15.4 dan §15.9, issue T79. Contoh nominalnya dari Top up Bermasalah seed di issue dan docs/UAT.md Persiapan M5:
// Nominal top up Rp 50.000, Total bayar Rp 50.123, nominal diterima Rp 50.000.
describe("penyelesaianTopUpBermasalahTersedia", () => {
  it("Admin bisa menyelesaikan Top up Bermasalah", () => {
    expect(penyelesaianTopUpBermasalahTersedia("Bermasalah")).toBe(true);
  });

  it.each(BUKAN_BERMASALAH)(
    "kedua aksi tidak tersedia untuk Top up %s",
    (status) => {
      expect(penyelesaianTopUpBermasalahTersedia(status)).toBe(false);
    },
  );
});

describe("hasilPenyelesaianTopUpBermasalah", () => {
  it('"Tambahkan ke saldo": Top up menjadi Berhasil, dan saldo bertambah sebesar Nominal top up Rp 50.000', () => {
    expect(
      hasilPenyelesaianTopUpBermasalah({
        statusTopUp: "Bermasalah",
        cara: "tambahkan-ke-saldo",
        nominalTopUp: 50000,
      }),
    ).toEqual({
      hasil: "diselesaikan",
      statusBaru: "Berhasil",
      saldoBertambah: 50000,
    });
  });

  it('"Dana Dikembalikan": Top up menjadi Dana Dikembalikan, dan saldo tidak berubah', () => {
    expect(
      hasilPenyelesaianTopUpBermasalah({
        statusTopUp: "Bermasalah",
        cara: "dana-dikembalikan",
        nominalTopUp: 50000,
      }),
    ).toEqual({
      hasil: "diselesaikan",
      statusBaru: "Dana Dikembalikan",
      saldoBertambah: 0,
    });
  });

  it.each(
    BUKAN_BERMASALAH.flatMap((status) =>
      (["tambahkan-ke-saldo", "dana-dikembalikan"] as const).map(
        (cara) => [status, cara] as const,
      ),
    ),
  )("Top up %s tidak bisa diselesaikan dengan %s", (status, cara) => {
    expect(
      hasilPenyelesaianTopUpBermasalah({
        statusTopUp: status,
        cara,
        nominalTopUp: 50000,
      }),
    ).toEqual({ hasil: "tidak-tersedia" });
  });
});
