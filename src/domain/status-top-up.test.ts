import { describe, expect, it } from "vitest";

import { perpindahanStatusTopUp } from "./status-top-up";

// PRD §15.4: perpindahan status Top up yang boleh terjadi.
describe("perpindahanStatusTopUp", () => {
  it.each([
    ["Menunggu Pembayaran", "Berhasil"],
    ["Menunggu Pembayaran", "Kedaluwarsa"],
    ["Menunggu Pembayaran", "Dibatalkan"],
    ["Menunggu Pembayaran", "Bermasalah"],
    ["Kedaluwarsa", "Berhasil"],
    ["Kedaluwarsa", "Bermasalah"],
    ["Dibatalkan", "Berhasil"],
    ["Dibatalkan", "Bermasalah"],
    ["Bermasalah", "Berhasil"],
    ["Bermasalah", "Dana Dikembalikan"],
  ] as const)("%s → %s boleh", (dari, ke) => {
    expect(perpindahanStatusTopUp({ dari, ke })).toEqual({ boleh: true });
  });

  it.each([
    ["Kedaluwarsa", "Dibatalkan"],
    ["Dibatalkan", "Kedaluwarsa"],
    ["Berhasil", "Kedaluwarsa"],
    ["Berhasil", "Dibatalkan"],
    ["Bermasalah", "Kedaluwarsa"],
    ["Dana Dikembalikan", "Berhasil"],
    ["Kedaluwarsa", "Menunggu Pembayaran"],
  ] as const)("%s → %s tidak boleh", (dari, ke) => {
    expect(perpindahanStatusTopUp({ dari, ke })).toEqual({ boleh: false });
  });
});
