import { describe, expect, it } from "vitest";

import { batasPesananMenunggu } from "./batas-pesanan-menunggu";
import { hasilCheckout } from "./checkout";

// PRD §3.7, §5.2, dan §5.4 ▶ Keputusan 2026-11-12 (#87). Belum ada fixture golden untuk urutan ini, jadi
// ekspektasinya diambil dari contoh PRD §5.4: Item stok terakhir Netflix Premium 1 Bulan sedang ditahan
// Pesanan Andi, sehingga Stok Varian-nya 0. Data Produk dan Pesanan ini sintetis.
const netflixSatuBulan = { produk: "Netflix Premium", varian: "1 Bulan" };
const pesananAndi = {
  email: "andi@example.test",
  status: "Menunggu Pembayaran",
} as const;
const pesananLain = [pesananAndi];

describe("hasilCheckout", () => {
  it("Andi checkout lagi Netflix Premium 1 Bulan yang Stok Varian-nya 0: berlaku batas Pesanan menunggu dengan Pesanan Andi, bukan stok habis", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "andi@example.test",
          pesananLain,
        }),
        stokVarian: 0,
      }),
    ).toEqual({ hasil: "pesanan-menunggu", pesananMenunggu: pesananAndi });
  });

  it("email lain tanpa Pesanan menunggu yang checkout Varian itu ditolak karena stok habis", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 0,
      }),
    ).toEqual({ hasil: "stok-habis" });
  });

  it("Varian yang tidak dijual ditolak lebih dulu, walaupun email itu masih punya Pesanan menunggu dan Stok Varian-nya 0", () => {
    expect(
      hasilCheckout({
        varianDijual: undefined,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "andi@example.test",
          pesananLain,
        }),
        stokVarian: 0,
      }),
    ).toEqual({ hasil: "tidak-dijual" });
  });

  it("email dengan Pesanan menunggu mengikuti batas Pesanan menunggu juga saat Stok Varian masih ada", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "andi@example.test",
          pesananLain,
        }),
        // Contoh PRD §5.3: 10 Item stok belum terkirim, 2 di antaranya Ditahan.
        stokVarian: 8,
      }),
    ).toEqual({ hasil: "pesanan-menunggu", pesananMenunggu: pesananAndi });
  });

  it("email tanpa Pesanan menunggu dan Stok Varian yang masih ada boleh membuat Pesanan untuk Varian itu", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 8,
      }),
    ).toEqual({ hasil: "boleh", varianDijual: netflixSatuBulan });
  });
});
