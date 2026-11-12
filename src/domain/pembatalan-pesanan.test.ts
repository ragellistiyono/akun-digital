import { describe, expect, it } from "vitest";

import {
  hasilPembatalanPesanan,
  pesanSudahDibayarTampil,
} from "./pembatalan-pesanan";

// PRD §5.8 dan ADR-0004 bagian "Pembatalan": toko meminta pembatalan QRIS ke Qrispy. Bila permintaan itu
// gagal, status QRIS-nya menentukan akibatnya. Belum ada fixture golden untuk aturan ini, jadi ekspektasinya
// diambil langsung dari daftar di ADR-0004.
describe("hasilPembatalanPesanan", () => {
  it("Qrispy menerima pembatalan QRIS: Pesanan menjadi Dibatalkan", () => {
    expect(hasilPembatalanPesanan({ pembatalanQris: "diterima" })).toEqual({
      akibat: "dibatalkan",
    });
  });

  it("pembatalan ditolak dan status QRIS paid: Pesanan diproses sebagai sudah dibayar", () => {
    expect(
      hasilPembatalanPesanan({ pembatalanQris: "ditolak", statusQris: "paid" }),
    ).toEqual({ akibat: "diproses-sebagai-dibayar" });
  });

  it.each(["cancelled", "expired"] as const)(
    "pembatalan ditolak dan status QRIS %s: Pesanan menjadi Dibatalkan",
    (statusQris) => {
      expect(
        hasilPembatalanPesanan({ pembatalanQris: "ditolak", statusQris }),
      ).toEqual({ akibat: "dibatalkan" });
    },
  );

  it("pembatalan ditolak dan status QRIS pending: pembatalan gagal, Pesanan tetap Menunggu Pembayaran", () => {
    expect(
      hasilPembatalanPesanan({
        pembatalanQris: "ditolak",
        statusQris: "pending",
      }),
    ).toEqual({ akibat: "gagal" });
  });

  it("pembatalan ditolak dan status QRIS tidak bisa ditanyakan: pembatalan gagal", () => {
    expect(
      hasilPembatalanPesanan({ pembatalanQris: "ditolak", statusQris: null }),
    ).toEqual({ akibat: "gagal" });
  });
});

// PRD §5.8 ▶ Keputusan 2026-11-12 (#87 dan #99): pesan "Pembayaran Anda sudah masuk, jadi Pesanan tidak
// dibatalkan." tampil tepat setelah "Batalkan" bila Qrispy menolak pembatalan karena tagihannya sudah
// dibayar, atau bila Pesanan sudah Selesai saat "Batalkan" diproses. Pesanan Bermasalah dan Pesanan yang
// Dibatalkan tampil tanpa pesan itu. Belum ada fixture golden untuk aturan ini, jadi ekspektasinya diambil
// langsung dari PRD §5.8.
describe("pesanSudahDibayarTampil", () => {
  it("Pesanan sudah Selesai saat Batalkan diproses: pesan tampil", () => {
    expect(
      pesanSudahDibayarTampil({
        hasil: "tidak-bisa-dibatalkan",
        status: "Selesai",
      }),
    ).toBe(true);
  });

  it("pembatalan ditolak Qrispy karena tagihannya sudah dibayar, lalu diproses sebagai sudah dibayar: pesan tampil", () => {
    expect(pesanSudahDibayarTampil({ hasil: "diproses-sebagai-dibayar" })).toBe(
      true,
    );
  });

  it.each([
    "Bermasalah",
    "Kedaluwarsa",
    "Dibatalkan",
    "Dana Dikembalikan",
  ] as const)(
    "Pesanan sudah %s saat Batalkan diproses: pesan tidak tampil",
    (status) => {
      expect(
        pesanSudahDibayarTampil({ hasil: "tidak-bisa-dibatalkan", status }),
      ).toBe(false);
    },
  );

  it("Pesanan Menunggu Pembayaran yang menjadi Dibatalkan: pesan tidak tampil", () => {
    expect(pesanSudahDibayarTampil({ hasil: "dibatalkan" })).toBe(false);
  });
});
