import { describe, expect, it } from "vitest";

import { kolomItemStokTerkirim, itemStokTampil } from "./item-stok-terkirim";

// PRD §6.1: Item stok sebuah Pesanan Selesai tampil di halaman Pesanan. Issue T19: Item stok tidak pernah
// tampil untuk status selain Selesai.
describe("itemStokTampil", () => {
  it("Item stok Pesanan Selesai tampil", () => {
    expect(itemStokTampil("Selesai")).toBe(true);
  });

  it.each([
    "Menunggu Pembayaran",
    "Kedaluwarsa",
    "Dibatalkan",
    "Bermasalah",
    "Dana Dikembalikan",
  ] as const)("Item stok Pesanan %s tidak tampil", (status) => {
    expect(itemStokTampil(status)).toBe(false);
  });
});

// PRD §4.1: Item stok yang sudah Terkirim tetap tampil dengan kolom lamanya. Contoh baris dari PRD §4.2
// untuk format `Email`, `Password`, `Profil`: `budi@mail.com|rahasia123|Profil 2`.
describe("kolomItemStokTerkirim", () => {
  it("setiap isi kolom tampil dengan nama kolom yang dicatat saat Item stok Terkirim, menurut urutannya", () => {
    expect(
      kolomItemStokTerkirim({
        formatSaatTerkirim: ["Email", "Password", "Profil"],
        nilai: ["budi@mail.com", "rahasia123", "Profil 2"],
      }),
    ).toEqual([
      { nama: "Email", nilai: "budi@mail.com" },
      { nama: "Password", nilai: "rahasia123" },
      { nama: "Profil", nilai: "Profil 2" },
    ]);
  });

  it("Item stok satu kolom `Kode` untuk kode lisensi tampil sebagai satu kolom", () => {
    expect(
      kolomItemStokTerkirim({
        formatSaatTerkirim: ["Kode"],
        nilai: ["GNS-8Q2K-L7PX"],
      }),
    ).toEqual([{ nama: "Kode", nilai: "GNS-8Q2K-L7PX" }]);
  });

  it("jumlah nama kolom yang tidak sama dengan jumlah isi kolom ditolak dengan galat", () => {
    expect(() =>
      kolomItemStokTerkirim({
        formatSaatTerkirim: ["Email", "Password"],
        nilai: ["budi@mail.com", "rahasia123", "Profil 2"],
      }),
    ).toThrow(/2 nama kolom.*3 isi kolom/);
  });
});
