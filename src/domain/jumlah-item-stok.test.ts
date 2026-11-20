import { describe, expect, it } from "vitest";

import {
  jumlahItemStokTerkirim,
  jumlahItemStokTersedia,
} from "./jumlah-item-stok";

// PRD §9.2 ▶ Keputusan 2026-11-20, kartu 9 dan 10. Setiap kelompok adalah jumlah Item stok satu Varian dengan
// satu status. Data sintetis.
const kelompok = [
  {
    varian: "Netflix 1 Bulan",
    varianAktif: true,
    produkAktif: true,
    status: "Tersedia",
    jumlah: 7,
  },
  {
    varian: "Netflix 1 Bulan",
    varianAktif: true,
    produkAktif: true,
    status: "Ditahan",
    jumlah: 2,
  },
  {
    varian: "Netflix 1 Bulan",
    varianAktif: true,
    produkAktif: true,
    status: "Terkirim",
    jumlah: 40,
  },
  {
    varian: "Netflix 3 Bulan",
    varianAktif: false,
    produkAktif: true,
    status: "Tersedia",
    jumlah: 4,
  },
  {
    varian: "Netflix 3 Bulan",
    varianAktif: false,
    produkAktif: true,
    status: "Terkirim",
    jumlah: 3,
  },
  {
    varian: "Spotify 1 Bulan",
    varianAktif: true,
    produkAktif: false,
    status: "Tersedia",
    jumlah: 5,
  },
  {
    varian: "Spotify 1 Bulan",
    varianAktif: true,
    produkAktif: false,
    status: "Terkirim",
    jumlah: 1,
  },
  {
    varian: "YouTube 1 Bulan",
    varianAktif: true,
    produkAktif: true,
    status: "Tersedia",
    jumlah: 3,
  },
] as const;

describe("jumlahItemStokTersedia", () => {
  it("menghitung Item stok Tersedia di Varian aktif dari Produk aktif, tanpa Item stok Ditahan, Varian nonaktif, maupun Produk nonaktif", () => {
    const hasil = jumlahItemStokTersedia({ kelompok });

    expect(hasil.jumlah).toBe(10);
    expect(hasil.dihitung.map((k) => k.varian)).toEqual([
      "Netflix 1 Bulan",
      "YouTube 1 Bulan",
    ]);
  });
});

describe("jumlahItemStokTerkirim", () => {
  it("menghitung semua Item stok Terkirim sepanjang waktu, juga di Varian dan Produk nonaktif", () => {
    expect(jumlahItemStokTerkirim({ kelompok }).jumlah).toBe(44);
  });
});
