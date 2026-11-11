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
