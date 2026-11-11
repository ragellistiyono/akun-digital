import { describe, expect, it } from "vitest";

import { kategoriTampil, saringProdukBeranda } from "./saringan-katalog";

// Data persiapan bersama docs/UAT.md, yang bertanda [CONTOH]: Netflix Premium dan YouTube Premium di
// Kategori Streaming, Spotify Premium di Kategori Musik.
const netflix = { nama: "Netflix Premium", kategoriId: "streaming" };
const youtube = { nama: "YouTube Premium", kategoriId: "streaming" };
const spotify = { nama: "Spotify Premium", kategoriId: "musik" };
const produk = [netflix, spotify, youtube];

describe("saringProdukBeranda", () => {
  // Issue T12, kriteria penerimaan: "NETFLIX" memberi hasil yang sama dengan "netflix".
  it.each(["netflix", "NETFLIX", "Netflix"])(
    'mencari "%s" menampilkan Netflix Premium saja',
    (kataCari) => {
      expect(
        saringProdukBeranda({ produk, kataCari, kategoriId: null }),
      ).toEqual([netflix]);
    },
  );

  it("mencari bagian nama di tengah nama Produk juga cocok", () => {
    expect(
      saringProdukBeranda({ produk, kataCari: "premium", kategoriId: null }),
    ).toEqual(produk);
  });

  it("spasi di awal dan akhir kata cari diabaikan", () => {
    expect(
      saringProdukBeranda({ produk, kataCari: "  netflix ", kategoriId: null }),
    ).toEqual([netflix]);
  });

  it("tanpa kata cari dan tanpa saringan, semua Produk tampil menurut urutan masukan", () => {
    expect(
      saringProdukBeranda({ produk, kataCari: "  ", kategoriId: null }),
    ).toEqual(produk);
  });

  // UAT-C1: saringan Musik hanya menampilkan Spotify Premium.
  it("saringan Kategori Musik hanya menampilkan Spotify Premium", () => {
    expect(
      saringProdukBeranda({ produk, kataCari: "", kategoriId: "musik" }),
    ).toEqual([spotify]);
  });

  it("kata cari dan saringan Kategori yang dipakai bersamaan harus cocok keduanya", () => {
    expect(
      saringProdukBeranda({
        produk,
        kataCari: "premium",
        kategoriId: "streaming",
      }),
    ).toEqual([netflix, youtube]);
    expect(
      saringProdukBeranda({ produk, kataCari: "netflix", kategoriId: "musik" }),
    ).toEqual([]);
  });
});

describe("kategoriTampil", () => {
  // Kategori persiapan bersama docs/UAT.md [CONTOH]. Game hanya berisi Produk nonaktif (Game Lama),
  // jadi tidak satu pun Produknya tampil di katalog.
  const streaming = { id: "streaming", nama: "Streaming" };
  const musik = { id: "musik", nama: "Musik" };
  const game = { id: "game", nama: "Game" };

  it("Kategori yang tidak berisi Produk di katalog tidak tampil (PRD §3.1, UAT-C1)", () => {
    expect(
      kategoriTampil({
        kategori: [game, musik, streaming],
        produkTampil: produk,
      }),
    ).toEqual([musik, streaming]);
  });

  it("tanpa Produk di katalog, tidak ada Kategori yang tampil", () => {
    expect(
      kategoriTampil({ kategori: [game, musik], produkTampil: [] }),
    ).toEqual([]);
  });
});
