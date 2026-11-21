import { describe, expect, it } from "vitest";

import { pesanSudahDibayarTopUpTampil } from "./pembatalan-top-up";

// PRD §15.3 ▶ Keputusan 2026-11-21 (issue 240): bila Qrispy menolak "Batalkan" karena tagihan Top up sudah dibayar, pesan
// "Pembayaran Anda sudah masuk, jadi Top up tidak dibatalkan." tampil hanya bila Top up itu menjadi Berhasil. Pesan
// yang sama tampil bila Top up sudah Berhasil saat "Batalkan" diproses. Belum ada fixture golden untuk aturan ini, jadi
// ekspektasinya diambil langsung dari blok Keputusan itu.
describe("pesanSudahDibayarTopUpTampil", () => {
  it("pembatalan ditolak karena sudah dibayar dan Top up menjadi Berhasil: pesan tampil", () => {
    expect(
      pesanSudahDibayarTopUpTampil({
        hasil: "sudah-dibayar",
        status: "Berhasil",
      }),
    ).toBe(true);
  });

  it("pembatalan ditolak karena sudah dibayar dengan nominal kurang, jadi Top up menjadi Bermasalah: pesan tidak tampil", () => {
    expect(
      pesanSudahDibayarTopUpTampil({
        hasil: "sudah-dibayar",
        status: "Bermasalah",
      }),
    ).toBe(false);
  });

  it("Top up sudah Berhasil saat Batalkan diproses: pesan tampil", () => {
    expect(
      pesanSudahDibayarTopUpTampil({
        hasil: "tidak-bisa-dibatalkan",
        status: "Berhasil",
      }),
    ).toBe(true);
  });

  it.each([
    "Bermasalah",
    "Kedaluwarsa",
    "Dibatalkan",
    "Dana Dikembalikan",
  ] as const)(
    "Top up sudah %s saat Batalkan diproses: pesan tidak tampil",
    (status) => {
      expect(
        pesanSudahDibayarTopUpTampil({
          hasil: "tidak-bisa-dibatalkan",
          status,
        }),
      ).toBe(false);
    },
  );

  it("Top up Dibatalkan oleh Batalkan: pesan tidak tampil", () => {
    expect(pesanSudahDibayarTopUpTampil({ hasil: "dibatalkan" })).toBe(false);
  });
});
