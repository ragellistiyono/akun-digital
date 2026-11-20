import { describe, expect, it } from "vitest";

import { rupiahBertanda, rupiahPlusMinus } from "./rupiah";

// Issue T67 (PRD §14.1): Laba kotor negatif ditulis "−Rp X".
describe("rupiahBertanda", () => {
  it.each([
    [15000, "Rp 15.000"],
    [0, "Rp 0"],
    [-10000, "−Rp 10.000"],
  ])("%d ditulis %s", (nilai, teks) => {
    expect(rupiahBertanda(nilai)).toBe(teks);
  });
});

// PRD §15.2: nominal Riwayat saldo ditulis dengan tanda + atau −, misalnya "+Rp 50.000" dan "−Rp 45.000".
describe("rupiahPlusMinus", () => {
  it.each([
    [50000, "+Rp 50.000"],
    [-45000, "−Rp 45.000"],
  ])("%d ditulis %s", (nilai, teks) => {
    expect(rupiahPlusMinus(nilai)).toBe(teks);
  });
});
