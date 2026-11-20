import { describe, expect, it } from "vitest";

import { pendapatanPerKategori } from "./pendapatan-per-kategori";

// PRD §14.7 grafik 5: Pendapatan dan jumlah Pesanan Selesai setiap Kategori, Pendapatan terbesar di atas. Kategori
// tanpa Pesanan Selesai tidak tampil.
describe("pendapatanPerKategori", () => {
  it("menjumlahkan Total bayar dan Pesanan Selesai per Kategori, dengan Pendapatan terbesar di atas", () => {
    const hasil = pendapatanPerKategori({
      pesananSelesai: [
        { kategoriId: "s", namaKategori: "Streaming", totalBayar: 45123 },
        { kategoriId: "m", namaKategori: "Musik", totalBayar: 135499 },
        { kategoriId: "s", namaKategori: "Streaming", totalBayar: 50010 },
        { kategoriId: "d", namaKategori: "Desain", totalBayar: 30100 },
      ],
    });

    expect(
      hasil.kategori.map(({ namaKategori, pendapatan, pesananSelesai }) => ({
        namaKategori,
        pendapatan,
        pesananSelesai,
      })),
    ).toEqual([
      { namaKategori: "Musik", pendapatan: 135499, pesananSelesai: 1 },
      { namaKategori: "Streaming", pendapatan: 95133, pesananSelesai: 2 },
      { namaKategori: "Desain", pendapatan: 30100, pesananSelesai: 1 },
    ]);
  });

  it("Pendapatan yang sama diurutkan menurut nama Kategori A sampai Z, dan tanpa Pesanan Selesai tidak ada Kategori", () => {
    const hasil = pendapatanPerKategori({
      pesananSelesai: [
        { kategoriId: "s", namaKategori: "Streaming", totalBayar: 20100 },
        { kategoriId: "g", namaKategori: "game", totalBayar: 20100 },
      ],
    });

    expect(hasil.kategori.map((k) => k.namaKategori)).toEqual([
      "game",
      "Streaming",
    ]);
    expect(pendapatanPerKategori({ pesananSelesai: [] }).kategori).toEqual([]);
  });
});
