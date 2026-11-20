import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/produk-terlaris.json";
import { produkTerlaris } from "./produk-terlaris";

type KasusGolden = (typeof golden.kasus)[number];

/** Pesanan Selesai golden, dengan nama Produk sekaligus sebagai id Produk-nya. */
const pesananSelesai = ({ input }: KasusGolden) =>
  input.pesananSelesai.map((p) => ({
    produkId: p.produk,
    namaProduk: p.produk,
    totalBayar: p.totalBayar,
  }));

// PRD §14.7 grafik 4: paling banyak 10 Produk, Pesanan dijumlahkan dari semua Varian, urut jumlah Pesanan Selesai,
// lalu Pendapatan, lalu nama Produk A sampai Z.
describe("produkTerlaris", () => {
  it.each(golden.kasus)("$nama", (kasus) => {
    const hasil = produkTerlaris({ pesananSelesai: pesananSelesai(kasus) });

    expect(
      hasil.terlaris.map(({ namaProduk, pesananSelesai, pendapatan }) => ({
        produk: namaProduk,
        pesananSelesai,
        pendapatan,
      })),
    ).toEqual(kasus.output.terlaris);
  });

  it("Produk berbeda dengan nama sama tidak digabung, dan setiap Produk membawa Pesanan yang dihitungnya", () => {
    const hasil = produkTerlaris({
      pesananSelesai: [
        { produkId: "a", namaProduk: "Netflix Premium", totalBayar: 50010 },
        { produkId: "b", namaProduk: "Netflix Premium", totalBayar: 45123 },
        { produkId: "a", namaProduk: "Netflix Premium", totalBayar: 50200 },
      ],
    });

    expect(
      hasil.terlaris.map(
        ({ produkId, pesananSelesai, pendapatan, dihitung }) => ({
          produkId,
          pesananSelesai,
          pendapatan,
          dihitung: dihitung.map((p) => p.totalBayar),
        }),
      ),
    ).toEqual([
      {
        produkId: "a",
        pesananSelesai: 2,
        pendapatan: 100210,
        dihitung: [50010, 50200],
      },
      {
        produkId: "b",
        pesananSelesai: 1,
        pendapatan: 45123,
        dihitung: [45123],
      },
    ]);
  });
});
