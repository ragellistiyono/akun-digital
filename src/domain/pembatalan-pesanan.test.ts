import { describe, expect, it } from "vitest";

import { hasilPembatalanPesanan } from "./pembatalan-pesanan";

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
