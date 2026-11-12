import { describe, expect, it } from "vitest";

import {
  bolehHapusKategori,
  bolehHapusProdukAtauVarian,
} from "./hapus-katalog";
import { STATUS_PESANAN } from "./status-pesanan";

// PRD §3.1: Kategori yang masih berisi Produk, termasuk Produk nonaktif, tidak bisa dihapus.
describe("bolehHapusKategori", () => {
  it("Kategori Game yang hanya berisi Produk nonaktif ditolak (UAT-C6 langkah 1)", () => {
    expect(
      bolehHapusKategori({ jumlahProdukAktif: 0, jumlahProdukNonaktif: 1 }),
    ).toEqual({ boleh: false, jumlahProduk: 1 });
  });

  it("Kategori Streaming yang berisi Produk aktif dan nonaktif ditolak dengan jumlah semua Produknya", () => {
    expect(
      bolehHapusKategori({ jumlahProdukAktif: 3, jumlahProdukNonaktif: 1 }),
    ).toEqual({ boleh: false, jumlahProduk: 4 });
  });

  it("Kategori yang kosong boleh dihapus", () => {
    expect(
      bolehHapusKategori({ jumlahProdukAktif: 0, jumlahProdukNonaktif: 0 }),
    ).toEqual({ boleh: true });
  });
});

// PRD §3.7: Produk atau Varian yang sudah pernah dipesan tidak bisa dihapus, hanya dinonaktifkan. "Pernah
// dipesan" berarti tercatat di Pesanan berstatus apa pun, termasuk Kedaluwarsa dan Dibatalkan.
describe("bolehHapusProdukAtauVarian", () => {
  it("Netflix Premium yang Pesanannya Kedaluwarsa ditolak (UAT-C6 langkah 3)", () => {
    expect(
      bolehHapusProdukAtauVarian({
        jumlahPesananPerStatus: { Kedaluwarsa: 1 },
      }),
    ).toEqual({ boleh: false, jumlahPesanan: 1 });
  });

  it.each(STATUS_PESANAN)(
    "tercatat di satu Pesanan %s berarti pernah dipesan, jadi ditolak",
    (status) => {
      expect(
        bolehHapusProdukAtauVarian({ jumlahPesananPerStatus: { [status]: 1 } }),
      ).toEqual({ boleh: false, jumlahPesanan: 1 });
    },
  );

  it("Pesanan Selesai, Kedaluwarsa, dan Dibatalkan dihitung semuanya", () => {
    expect(
      bolehHapusProdukAtauVarian({
        jumlahPesananPerStatus: { Selesai: 2, Kedaluwarsa: 1, Dibatalkan: 3 },
      }),
    ).toEqual({ boleh: false, jumlahPesanan: 6 });
  });

  it("yang belum pernah dipesan boleh dihapus", () => {
    expect(bolehHapusProdukAtauVarian({ jumlahPesananPerStatus: {} })).toEqual({
      boleh: true,
    });
  });
});
