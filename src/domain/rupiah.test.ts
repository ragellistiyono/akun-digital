import { describe, expect, it } from "vitest";

import { rupiahBertanda } from "./rupiah";

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
