import { describe, expect, it } from "vitest";

import { NominalQrispy } from "./nominal-qrispy";

// Contoh nominal diambil dari issue T36 dan uji API sungguhan (docs/referensi/qrispy-api.md bagian 9).
describe("NominalQrispy", () => {
  for (const nominal of [10281, "10281", "10281.00"]) {
    it(`${JSON.stringify(nominal)} menjadi rupiah bulat 10281`, () => {
      expect(NominalQrispy.parse(nominal)).toBe(10281);
    });
  }

  for (const nominal of ["10281.50", "10.281", "abc", "", 10281.5, -1]) {
    it(`${JSON.stringify(nominal)} tidak sah`, () => {
      expect(NominalQrispy.safeParse(nominal).success).toBe(false);
    });
  }
});
