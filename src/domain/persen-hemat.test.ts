import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/persen-hemat.json";
import { persenHemat, persenHematVarian } from "./persen-hemat";

// PRD §3.5: N = (Harga normal − Harga jual) ÷ Harga normal × 100, dibulatkan ke bawah, dan hanya tampil
// bila Harga normal diisi.
describe("persenHemat", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(persenHemat(input)).toMatchObject(output);
  });

  it("membawa Harga normal dan Harga jual sebagai bahan hitungnya", () => {
    expect(persenHemat({ hargaNormal: 75000, hargaJual: 50000 })).toEqual({
      tampil: true,
      persenHemat: 33,
      hargaNormal: 75000,
      hargaJual: 50000,
    });
  });
});

// docs/DESIGN.md "Cards / Containers", ▶ Keputusan 2026-11-11 (#53): daftar Varian di kartu Produk
// Unggulan menampilkan "Hemat N%" untuk setiap Varian yang punya Harga normal, dan Varian yang habis tetap
// menampilkan label Habis tanpa Hemat.
describe("persenHematVarian", () => {
  it.each(golden.kasus)("Varian ber-stok: $nama", ({ input, output }) => {
    expect(persenHematVarian({ ...input, stokVarian: 10 })).toMatchObject({
      habis: false,
      persenHemat: output.persenHemat,
    });
  });

  it.each(golden.kasus)("Varian habis tanpa Hemat: $nama", ({ input }) => {
    expect(persenHematVarian({ ...input, stokVarian: 0 })).toMatchObject({
      habis: true,
      persenHemat: null,
    });
  });

  it("membawa Stok Varian, Harga normal, dan Harga jual sebagai bahan hitungnya", () => {
    // UAT persiapan bersama [CONTOH]: Netflix Premium 1 Bulan.
    expect(
      persenHematVarian({
        hargaNormal: 75000,
        hargaJual: 50000,
        stokVarian: 10,
      }),
    ).toEqual({
      habis: false,
      persenHemat: 33,
      stokVarian: 10,
      hargaNormal: 75000,
      hargaJual: 50000,
    });
    expect(
      persenHematVarian({
        hargaNormal: 30000,
        hargaJual: 20000,
        stokVarian: 0,
      }),
    ).toEqual({
      habis: true,
      persenHemat: null,
      stokVarian: 0,
      hargaNormal: 30000,
      hargaJual: 20000,
    });
  });
});

// PRD §16.4, docs/DESIGN.md ▶ Keputusan 2026-11-22: Harga normal Produk gratis tetap dicoret, tanpa label "Hemat N%".
// UAT persiapan M6 [CONTOH]: Akun Uji Gratis "Akun Baru", Harga jual Rp 1.000 dan Harga normal Rp 15.000.
describe("Produk gratis tanpa label Hemat", () => {
  it("persenHemat Varian Produk gratis tidak tampil", () => {
    expect(
      persenHemat({ hargaNormal: 15000, hargaJual: 1000, gratis: true }),
    ).toMatchObject({ tampil: false, persenHemat: null });
  });

  it("persenHematVarian Varian Produk gratis yang ber-stok tidak punya Hemat", () => {
    expect(
      persenHematVarian({
        hargaNormal: 15000,
        hargaJual: 1000,
        stokVarian: 5,
        gratis: true,
      }),
    ).toMatchObject({ habis: false, persenHemat: null });
  });
});
