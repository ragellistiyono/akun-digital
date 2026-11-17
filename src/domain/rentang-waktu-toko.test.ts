import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/rentang-waktu-toko.json";
import { rentangWaktuToko } from "./rentang-waktu-toko";

const sebagaiInstan = (rentang: { mulai: string; sebelum: string }) => ({
  mulai: new Date(rentang.mulai),
  sebelum: new Date(rentang.sebelum),
});

// PRD §9.1: "hari ini" dan "bulan ini" dibaca dalam Zona waktu toko, yaitu WIB (UTC+7).
describe("rentangWaktuToko", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(rentangWaktuToko({ sekarang: new Date(input.sekarang) })).toEqual({
      hariIni: sebagaiInstan(output.hariIni),
      bulanIni: sebagaiInstan(output.bulanIni),
    });
  });
});
