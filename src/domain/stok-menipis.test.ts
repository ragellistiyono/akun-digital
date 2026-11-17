import { describe, expect, it } from "vitest";

import goldenAmbang from "../../tests/golden/ambang-stok-menipis.json";
import goldenStokMenipis from "../../tests/golden/stok-menipis.json";
import {
  AMBANG_STOK_MENIPIS_AWAL,
  periksaAmbangStokMenipis,
  stokMenipis,
  urutkanStokMenipis,
} from "./stok-menipis";

// PRD §9.4: Varian aktif dari Produk aktif yang Stok Varian-nya sama dengan atau kurang dari Ambang stok
// menipis masuk daftar "Stok menipis".
describe("stokMenipis", () => {
  it.each(goldenStokMenipis.kasus)("$nama", ({ input, output }) => {
    const hasil = stokMenipis(input);

    expect(hasil.menipis.map((v) => v.nama)).toEqual(output.menipis);
  });

  it("membawa Ambang stok menipis dan Stok Varian setiap Varian sebagai bahan hitungnya", () => {
    const hasil = stokMenipis({
      ambang: 5,
      varian: [
        { nama: "A", stokVarian: 5, aktif: true, produkAktif: true },
        { nama: "C", stokVarian: 6, aktif: true, produkAktif: true },
      ],
    });

    expect(hasil).toEqual({
      ambang: 5,
      menipis: [{ nama: "A", stokVarian: 5, aktif: true, produkAktif: true }],
    });
  });
});

// PRD §9.4 ▶ Keputusan 2026-11-17: Stok Varian terkecil di atas.
describe("urutkanStokMenipis", () => {
  it("menaruh Stok Varian terkecil di atas, dan Varian dengan Stok Varian sama tetap pada urutan asalnya", () => {
    const urut = urutkanStokMenipis([
      { nama: "A", stokVarian: 5 },
      { nama: "B", stokVarian: 0 },
      { nama: "F", stokVarian: 4 },
      { nama: "G", stokVarian: 0 },
    ]);

    expect(urut.map((v) => v.nama)).toEqual(["B", "G", "F", "A"]);
  });
});

// PRD §9.4 ▶ Keputusan 2026-11-17: bilangan bulat 0 sampai 999.
describe("periksaAmbangStokMenipis", () => {
  it.each(goldenAmbang.kasus)("$nama", ({ input, output }) => {
    expect(periksaAmbangStokMenipis(input)).toMatchObject(output);
  });

  it("isian yang bukan angka sama sekali bukan bilangan bulat", () => {
    expect(periksaAmbangStokMenipis({ ambang: Number.NaN })).toMatchObject({
      sah: false,
      alasan: "bukan-bilangan-bulat",
    });
  });
});

// PRD §9.4: Ambang stok menipis bernilai awal 5.
it("nilai awal Ambang stok menipis adalah 5", () => {
  expect(AMBANG_STOK_MENIPIS_AWAL).toBe(5);
});
