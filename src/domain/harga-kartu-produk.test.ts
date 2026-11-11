import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/harga-kartu-produk.json";
import { hargaKartuProduk } from "./harga-kartu-produk";

// PRD §3.8: "Mulai" bila Varian aktif lebih dari satu. Harga = Harga jual termurah di antara Varian aktif
// yang Stok Varian-nya > 0; bila semua habis, termurah di antara semua Varian aktif dan label Habis.
describe("hargaKartuProduk", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(hargaKartuProduk(input)).toMatchObject(output);
  });

  // docs/DESIGN.md, keputusan teknis "Mulai Rp X": Harga normal yang dicoret dan Hemat diambil dari
  // Varian yang menjadi sumber harga.
  it("Varian sumber harga adalah Varian aktif ber-stok yang termurah (contoh YouTube Premium di DESIGN.md)", () => {
    const satuBulan = {
      nama: "1 Bulan",
      hargaJual: 20000,
      hargaNormal: null,
      stokVarian: 0,
      aktif: true,
    };
    const tigaBulan = {
      nama: "3 Bulan",
      hargaJual: 55000,
      hargaNormal: 65000,
      stokVarian: 3,
      aktif: true,
    };

    expect(hargaKartuProduk({ varian: [satuBulan, tigaBulan] })).toEqual({
      mulai: true,
      harga: 55000,
      habis: false,
      sumber: tigaBulan,
      varianAktif: [satuBulan, tigaBulan],
    });
  });

  it("bila semua Varian aktif habis, sumber harga adalah Varian aktif termurah", () => {
    const murah = { hargaJual: 20000, stokVarian: 0, aktif: true };
    const mahal = { hargaJual: 55000, stokVarian: 0, aktif: true };

    expect(hargaKartuProduk({ varian: [mahal, murah] })?.sumber).toBe(murah);
  });

  it("Varian nonaktif tidak menjadi bahan hitung", () => {
    const nonaktif = { hargaJual: 10000, stokVarian: 9, aktif: false };
    const aktif = { hargaJual: 50000, stokVarian: 2, aktif: true };

    expect(hargaKartuProduk({ varian: [nonaktif, aktif] })).toMatchObject({
      sumber: aktif,
      varianAktif: [aktif],
    });
  });

  it("Produk tanpa Varian aktif tidak punya harga kartu, jadi tidak tampil di katalog", () => {
    expect(hargaKartuProduk({ varian: [] })).toBeNull();
    expect(
      hargaKartuProduk({
        varian: [{ hargaJual: 20000, stokVarian: 3, aktif: false }],
      }),
    ).toBeNull();
  });

  it("bila Harga jual termurah sama, Varian yang lebih dulu di daftar menjadi sumber harga", () => {
    const pertama = { nama: "A", hargaJual: 30000, stokVarian: 1, aktif: true };
    const kedua = { nama: "B", hargaJual: 30000, stokVarian: 1, aktif: true };

    expect(hargaKartuProduk({ varian: [pertama, kedua] })?.sumber).toBe(
      pertama,
    );
  });
});
