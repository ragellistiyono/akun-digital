import { describe, expect, it } from "vitest";

import {
  BATAS_FOTO_PRODUK,
  fotoSampul,
  hapusFoto,
  pindahkanFoto,
  tambahFoto,
} from "./foto-produk";

// PRD §3.3: Produk punya hingga 5 foto, dan foto pertama menjadi sampul. Menurut tests/golden/NOTES.md
// batas ini tidak punya fixture golden, jadi ekspektasinya diambil dari PRD dan issue T08 (#15).
describe("tambahFoto", () => {
  it("foto pertama yang ditambahkan ke Produk tanpa foto menjadi sampul", () => {
    const hasil = tambahFoto([], "foto-1");

    expect(hasil).toEqual({ sah: true, foto: ["foto-1"] });
    expect(fotoSampul(["foto-1"])).toBe("foto-1");
  });

  it("foto baru ditambahkan di urutan terakhir", () => {
    expect(tambahFoto(["foto-1", "foto-2"], "foto-3")).toEqual({
      sah: true,
      foto: ["foto-1", "foto-2", "foto-3"],
    });
  });

  it("foto kelima diterima", () => {
    expect(
      tambahFoto(["foto-1", "foto-2", "foto-3", "foto-4"], "foto-5"),
    ).toEqual({
      sah: true,
      foto: ["foto-1", "foto-2", "foto-3", "foto-4", "foto-5"],
    });
  });

  it("foto keenam ditolak karena Produk paling banyak punya 5 foto", () => {
    expect(
      tambahFoto(["foto-1", "foto-2", "foto-3", "foto-4", "foto-5"], "foto-6"),
    ).toEqual({ sah: false, alasan: "melebihi-batas", batas: 5 });
    expect(BATAS_FOTO_PRODUK).toBe(5);
  });
});

describe("pindahkanFoto", () => {
  const tigaFoto = ["foto-1", "foto-2", "foto-3"];

  it("foto yang dipindah ke urutan pertama menjadi sampul, dan foto lain bergeser satu urutan", () => {
    const hasil = pindahkanFoto(tigaFoto, "foto-3", 1);

    expect(hasil).toEqual({
      sah: true,
      foto: ["foto-3", "foto-1", "foto-2"],
    });
    expect(hasil.sah && fotoSampul(hasil.foto)).toBe("foto-3");
  });

  it("sampul yang dipindah ke urutan kedua digantikan foto berikutnya", () => {
    const hasil = pindahkanFoto(tigaFoto, "foto-1", 2);

    expect(hasil).toEqual({
      sah: true,
      foto: ["foto-2", "foto-1", "foto-3"],
    });
    expect(hasil.sah && fotoSampul(hasil.foto)).toBe("foto-2");
  });

  it("foto bisa dipindah ke urutan terakhir", () => {
    expect(pindahkanFoto(tigaFoto, "foto-1", 3)).toEqual({
      sah: true,
      foto: ["foto-2", "foto-3", "foto-1"],
    });
  });

  it("foto yang dipindah ke urutannya sendiri tidak mengubah urutan", () => {
    expect(pindahkanFoto(tigaFoto, "foto-2", 2)).toEqual({
      sah: true,
      foto: tigaFoto,
    });
  });

  it("foto yang bukan milik Produk tidak bisa dipindah", () => {
    expect(pindahkanFoto(tigaFoto, "foto-9", 1)).toEqual({
      sah: false,
      alasan: "foto-tidak-ada",
    });
  });

  for (const urutan of [0, 4]) {
    it(`urutan ${urutan} di luar urutan foto Produk ditolak`, () => {
      expect(pindahkanFoto(tigaFoto, "foto-2", urutan)).toEqual({
        sah: false,
        alasan: "urutan-di-luar",
      });
    });
  }
});

describe("hapusFoto", () => {
  it("bila foto pertama dihapus, foto berikutnya menjadi sampul", () => {
    const hasil = hapusFoto(["foto-1", "foto-2", "foto-3"], "foto-1");

    expect(hasil).toEqual({ sah: true, foto: ["foto-2", "foto-3"] });
    expect(hasil.sah && fotoSampul(hasil.foto)).toBe("foto-2");
  });

  it("foto lain yang dihapus tidak mengubah sampul dan urutan sisanya", () => {
    expect(hapusFoto(["foto-1", "foto-2", "foto-3"], "foto-2")).toEqual({
      sah: true,
      foto: ["foto-1", "foto-3"],
    });
  });

  it("bila satu-satunya foto dihapus, Produk tidak punya sampul", () => {
    const hasil = hapusFoto(["foto-1"], "foto-1");

    expect(hasil).toEqual({ sah: true, foto: [] });
    expect(hasil.sah && fotoSampul(hasil.foto)).toBeNull();
  });

  it("foto yang bukan milik Produk tidak bisa dihapus", () => {
    expect(hapusFoto(["foto-1"], "foto-9")).toEqual({
      sah: false,
      alasan: "foto-tidak-ada",
    });
  });
});

describe("fotoSampul", () => {
  it("Produk tanpa foto tidak punya sampul", () => {
    expect(fotoSampul([])).toBeNull();
  });

  it("foto di urutan pertama menjadi sampul", () => {
    expect(fotoSampul(["foto-2", "foto-1", "foto-3"])).toBe("foto-2");
  });
});
