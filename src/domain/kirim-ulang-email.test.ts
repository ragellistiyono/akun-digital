import { describe, expect, it } from "vitest";

import {
  kirimUlangEmailTersedia,
  koreksiEmailTersedia,
} from "./kirim-ulang-email";

// PRD §6.4 dan issue T25: Admin bisa mengirim ulang email "Pesanan selesai", dan kirim ulang tidak tersedia
// untuk Pesanan selain Selesai. Belum ada fixture golden untuk aturan ini, jadi ekspektasinya diambil
// langsung dari kriteria penerimaan issue T25.
describe("kirimUlangEmailTersedia", () => {
  it("kirim ulang tersedia untuk Pesanan Selesai", () => {
    expect(kirimUlangEmailTersedia("Selesai")).toBe(true);
  });

  it.each([
    "Menunggu Pembayaran",
    "Kedaluwarsa",
    "Dibatalkan",
    "Bermasalah",
    "Dana Dikembalikan",
  ] as const)("kirim ulang tidak tersedia untuk Pesanan %s", (status) => {
    expect(kirimUlangEmailTersedia(status)).toBe(false);
  });
});

// PRD §6.4 (▶ Keputusan 2026-11-12) dan issue T25-b: email Pesanan Selesai dan Bermasalah bisa dikoreksi, dan
// koreksi ditolak untuk status lain. Belum ada fixture golden untuk aturan ini, jadi ekspektasinya diambil
// langsung dari kriteria penerimaan issue T25-b.
describe("koreksiEmailTersedia", () => {
  it.each(["Selesai", "Bermasalah"] as const)(
    "koreksi email tersedia untuk Pesanan %s",
    (status) => {
      expect(koreksiEmailTersedia(status)).toBe(true);
    },
  );

  it.each([
    "Menunggu Pembayaran",
    "Kedaluwarsa",
    "Dibatalkan",
    "Dana Dikembalikan",
  ] as const)("koreksi email tidak tersedia untuk Pesanan %s", (status) => {
    expect(koreksiEmailTersedia(status)).toBe(false);
  });
});
