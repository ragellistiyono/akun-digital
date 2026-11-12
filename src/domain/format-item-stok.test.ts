import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/format-item-stok.json";
import goldenUbah from "../../tests/golden/ubah-format-item-stok.json";
import {
  bolehUbahFormatItemStok,
  perubahanFormatItemStok,
  periksaFormatItemStok,
  type PerubahanFormatItemStok,
} from "./format-item-stok";

// PRD §4.1 (▶ Keputusan 2026-11-11, #53): Format Item stok minimal satu kolom, dan nama kolom tidak
// boleh kosong atau kembar. Nama kolom dianggap kembar tanpa membedakan huruf besar dan kecil, dan
// tanpa spasi di awal atau akhir. Semua contoh diambil dari fixture golden.
describe("periksaFormatItemStok", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(periksaFormatItemStok(input.kolom)).toEqual(output);
  });
});

// PRD §4.1: nama kolom boleh diganti kapan saja, sedangkan kolom hanya boleh ditambah atau dihapus bila
// Produk itu tidak punya Item stok Tersedia atau Ditahan. Semua contoh diambil dari fixture golden.
describe("bolehUbahFormatItemStok", () => {
  it.each(goldenUbah.kasus)("$nama", ({ input, output }) => {
    expect(
      bolehUbahFormatItemStok({
        ...input,
        perubahan: input.perubahan as PerubahanFormatItemStok,
      }),
    ).toEqual(output);
  });
});

// PRD §4.1 dan contoh UAT-D2: perubahan yang dikandung Format Item stok baru. Setiap kolom lama membawa
// nomor kolom lamanya, dan kolom baru tidak.
describe("perubahanFormatItemStok", () => {
  const NETFLIX = ["Email", "Password", "Profil"];
  const lama = (nomorLama: number, nama = NETFLIX[nomorLama - 1]) => ({
    nama,
    nomorLama,
  });
  const baru = (nama: string) => ({ nama, nomorLama: null });

  it("Format yang sama tidak mengandung perubahan", () => {
    expect(
      perubahanFormatItemStok({
        formatLama: NETFLIX,
        formatBaru: [lama(1), lama(2), lama(3)],
      }),
    ).toEqual([]);
  });

  it("Profil diganti Nama Profil adalah ganti nama", () => {
    expect(
      perubahanFormatItemStok({
        formatLama: NETFLIX,
        formatBaru: [lama(1), lama(2), lama(3, "Nama Profil")],
      }),
    ).toEqual(["ganti-nama"]);
  });

  it("menambah kolom PIN adalah tambah kolom", () => {
    expect(
      perubahanFormatItemStok({
        formatLama: NETFLIX,
        formatBaru: [lama(1), lama(2), lama(3), baru("PIN")],
      }),
    ).toEqual(["tambah-kolom"]);
  });

  it("menghapus kolom Password adalah hapus kolom", () => {
    expect(
      perubahanFormatItemStok({
        formatLama: NETFLIX,
        formatBaru: [lama(1), lama(3)],
      }),
    ).toEqual(["hapus-kolom"]);
  });

  it("menghapus Profil lalu menambah PIN adalah hapus dan tambah kolom, bukan ganti nama", () => {
    expect(
      perubahanFormatItemStok({
        formatLama: NETFLIX,
        formatBaru: [lama(1), lama(2), baru("PIN")],
      }),
    ).toEqual(["tambah-kolom", "hapus-kolom"]);
  });

  it("mengganti nama Email sambil menambah PIN mengandung ganti nama dan tambah kolom", () => {
    expect(
      perubahanFormatItemStok({
        formatLama: NETFLIX,
        formatBaru: [lama(1, "E-mail"), lama(2), lama(3), baru("PIN")],
      }),
    ).toEqual(["ganti-nama", "tambah-kolom"]);
  });

  it("kolom lama yang berpindah urutan dihitung dihapus lalu ditambah, karena isi Item stok tersimpan menurut urutan kolom", () => {
    expect(
      perubahanFormatItemStok({
        formatLama: NETFLIX,
        formatBaru: [lama(2), lama(1), lama(3)],
      }),
    ).toEqual(["tambah-kolom", "hapus-kolom"]);
  });

  it("nomor kolom lama yang tidak ada di Format lama dihitung kolom baru", () => {
    expect(
      perubahanFormatItemStok({
        formatLama: NETFLIX,
        formatBaru: [lama(1), lama(2), lama(3), lama(4, "PIN")],
      }),
    ).toEqual(["tambah-kolom"]);
  });
});
