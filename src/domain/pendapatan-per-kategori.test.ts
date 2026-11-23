import { describe, expect, it } from "vitest";

import { pendapatanPerKategori } from "./pendapatan-per-kategori";

// PRD §14.7 grafik 5: Pendapatan dan jumlah Pesanan Selesai setiap Kategori, Pendapatan terbesar di atas. Kategori
// tanpa Pesanan Selesai tidak tampil. Pendapatan tanpa Kode unik (§9.3 ▶ Keputusan 2026-11-23).
describe("pendapatanPerKategori", () => {
  it("menjumlahkan (Harga jual − potongan voucher) dan Pesanan Selesai per Kategori tanpa Kode unik, dengan Pendapatan terbesar di atas", () => {
    // Pesanan contoh PRD §9.3: Total bayar Rp 45.123, Rp 50.010, dan Rp 135.499 menjadi Pendapatan Rp 45.000,
    // Rp 50.000, dan Rp 135.000.
    const hasil = pendapatanPerKategori({
      pesananSelesai: [
        {
          kategoriId: "s",
          namaKategori: "Streaming",
          hargaJual: 50000,
          potonganVoucher: 5000,
        },
        {
          kategoriId: "m",
          namaKategori: "Musik",
          hargaJual: 135000,
          potonganVoucher: 0,
        },
        {
          kategoriId: "s",
          namaKategori: "Streaming",
          hargaJual: 50000,
          potonganVoucher: 0,
        },
        {
          kategoriId: "d",
          namaKategori: "Desain",
          hargaJual: 30000,
          potonganVoucher: 0,
        },
      ],
    });

    expect(
      hasil.kategori.map(({ namaKategori, pendapatan, pesananSelesai }) => ({
        namaKategori,
        pendapatan,
        pesananSelesai,
      })),
    ).toEqual([
      { namaKategori: "Musik", pendapatan: 135000, pesananSelesai: 1 },
      { namaKategori: "Streaming", pendapatan: 95000, pesananSelesai: 2 },
      { namaKategori: "Desain", pendapatan: 30000, pesananSelesai: 1 },
    ]);
  });

  it("Pendapatan yang sama diurutkan menurut nama Kategori A sampai Z, dan tanpa Pesanan Selesai tidak ada Kategori", () => {
    const hasil = pendapatanPerKategori({
      pesananSelesai: [
        {
          kategoriId: "s",
          namaKategori: "Streaming",
          hargaJual: 20000,
          potonganVoucher: 0,
        },
        {
          kategoriId: "g",
          namaKategori: "game",
          hargaJual: 20000,
          potonganVoucher: 0,
        },
      ],
    });

    expect(hasil.kategori.map((k) => k.namaKategori)).toEqual([
      "game",
      "Streaming",
    ]);
    expect(pendapatanPerKategori({ pesananSelesai: [] }).kategori).toEqual([]);
  });
});
