import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/persen-hemat.json";
import { varianHalamanProduk } from "./varian-halaman-produk";

// UAT persiapan bersama [CONTOH]: Netflix Premium.
const SATU_BULAN = {
  id: "1-bulan",
  nama: "1 Bulan",
  hargaJual: 50000,
  hargaNormal: 75000,
  stokVarian: 10,
  aktif: true,
};
const TIGA_BULAN = {
  id: "3-bulan",
  nama: "3 Bulan",
  hargaJual: 135000,
  hargaNormal: null,
  stokVarian: 4,
  aktif: true,
};

describe("varianHalamanProduk", () => {
  // PRD §3.2, §3.4, §3.5, UAT-C2–C4.
  it("Netflix Premium menampilkan pilihan kedua Variannya beserta Stok Varian dan Persen hemat", () => {
    expect(varianHalamanProduk({ varian: [SATU_BULAN, TIGA_BULAN] })).toEqual({
      pilihanVarian: true,
      varian: [
        { ...SATU_BULAN, habis: false, persenHemat: 33 },
        { ...TIGA_BULAN, habis: false, persenHemat: null },
      ],
    });
  });

  // PRD §3.2: Produk yang hanya punya satu Varian tidak menampilkan pilihan Varian.
  it("Produk dengan satu Varian aktif tidak menampilkan pilihan Varian", () => {
    const ujiBayar = {
      id: "uji",
      nama: "Uji",
      hargaJual: 1000,
      hargaNormal: null,
      stokVarian: 10,
      aktif: true,
    };
    expect(varianHalamanProduk({ varian: [ujiBayar] })).toEqual({
      pilihanVarian: false,
      varian: [{ ...ujiBayar, habis: false, persenHemat: null }],
    });
  });

  // PRD §3.7: Varian nonaktif hilang dari katalog, jadi tidak ikut dihitung.
  it("Varian nonaktif tidak tampil dan tidak ikut dihitung sebagai pilihan", () => {
    const promo = {
      id: "promo",
      nama: "Promo",
      hargaJual: 10000,
      hargaNormal: null,
      stokVarian: 9,
      aktif: false,
    };
    expect(varianHalamanProduk({ varian: [promo, SATU_BULAN] })).toEqual({
      pilihanVarian: false,
      varian: [{ ...SATU_BULAN, habis: false, persenHemat: 33 }],
    });
  });

  // PRD §3.2 ▶ Keputusan 2026-11-11 (#53): Produk tanpa Varian aktif tidak tampil di toko.
  it("Produk tanpa Varian aktif tidak punya Halaman Produk", () => {
    expect(varianHalamanProduk({ varian: [] })).toBeNull();
    expect(
      varianHalamanProduk({ varian: [{ ...SATU_BULAN, aktif: false }] }),
    ).toBeNull();
  });

  // PRD §3.4 dan UAT persiapan bersama [CONTOH]: YouTube Premium 1 Bulan tanpa Item stok.
  it("Varian dengan Stok Varian 0 habis", () => {
    const hasil = varianHalamanProduk({
      varian: [
        {
          id: "1-bulan",
          nama: "1 Bulan",
          hargaJual: 20000,
          hargaNormal: null,
          stokVarian: 0,
          aktif: true,
        },
        {
          id: "3-bulan",
          nama: "3 Bulan",
          hargaJual: 55000,
          hargaNormal: null,
          stokVarian: 3,
          aktif: true,
        },
      ],
    });
    expect(hasil?.varian).toMatchObject([
      { nama: "1 Bulan", stokVarian: 0, habis: true },
      { nama: "3 Bulan", stokVarian: 3, habis: false },
    ]);
  });

  // PRD §3.5: Harga normal yang diisi tampil dicoret bersama "Hemat N%". Di Halaman Produk, "Habis"
  // menggantikan "Stok N", bukan label Hemat, jadi Varian habis tetap membawa Persen hemat.
  it.each(golden.kasus)("Persen hemat: $nama", ({ input, output }) => {
    for (const stokVarian of [10, 0]) {
      const hasil = varianHalamanProduk({
        varian: [{ id: "v", nama: "V", aktif: true, stokVarian, ...input }],
      });
      expect(hasil?.varian[0].persenHemat).toBe(output.persenHemat);
    }
  });
});
