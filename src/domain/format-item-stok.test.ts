import { describe, expect, it } from "vitest";

import { periksaFormatItemStok } from "./format-item-stok";

// PRD §4.1 dan issue T07: Format Item stok berupa daftar nama kolom, minimal satu kolom, dan nama
// kolom tidak boleh kosong atau kembar. Belum ada fixture golden untuk aturan ini, jadi ekspektasinya
// diambil dari contoh di PRD §4.1 dan issue (`Email`, `Password`, `Profil`; satu kolom `Kode`).
describe("periksaFormatItemStok", () => {
  it("menerima Format Item stok Email, Password, Profil dengan urutan tetap", () => {
    expect(periksaFormatItemStok(["Email", "Password", "Profil"])).toEqual({
      sah: true,
      kolom: ["Email", "Password", "Profil"],
    });
  });

  it("menerima satu kolom Kode", () => {
    expect(periksaFormatItemStok(["Kode"])).toEqual({
      sah: true,
      kolom: ["Kode"],
    });
  });

  it("membuang spasi di awal dan akhir nama kolom", () => {
    expect(periksaFormatItemStok(["  Email ", "Password\t"])).toEqual({
      sah: true,
      kolom: ["Email", "Password"],
    });
  });

  it("menolak Format Item stok tanpa kolom", () => {
    expect(periksaFormatItemStok([])).toEqual({
      sah: false,
      masalah: [{ alasan: "tanpa-kolom" }],
    });
  });

  it("menolak nama kolom kosong dan menyebut nomor kolomnya", () => {
    expect(periksaFormatItemStok(["Email", "", "Profil", "   "])).toEqual({
      sah: false,
      masalah: [{ alasan: "kolom-kosong", nomorKolom: [2, 4] }],
    });
  });

  it("menolak nama kolom kembar: kolom pertama dipertahankan, kolom berikutnya disebut", () => {
    expect(
      periksaFormatItemStok(["Email", "Password", "Email", "Profil", "Email"]),
    ).toEqual({
      sah: false,
      masalah: [{ alasan: "kolom-kembar", nomorKolom: [3, 5] }],
    });
  });

  it("menganggap kembar nama kolom yang hanya berbeda huruf besar-kecil atau spasi di tepi", () => {
    expect(periksaFormatItemStok(["Email", " email", "EMAIL "])).toEqual({
      sah: false,
      masalah: [{ alasan: "kolom-kembar", nomorKolom: [2, 3] }],
    });
  });

  it("menyebut kolom kosong dan kolom kembar sekaligus, dan dua kolom kosong tidak dihitung kembar", () => {
    expect(periksaFormatItemStok(["Email", "", "Email", " "])).toEqual({
      sah: false,
      masalah: [
        { alasan: "kolom-kosong", nomorKolom: [2, 4] },
        { alasan: "kolom-kembar", nomorKolom: [3] },
      ],
    });
  });
});
