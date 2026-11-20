import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/rentang-awal-laporan.json";
import { PERIODE_LAPORAN, rentangAwalLaporan } from "./rentang-awal-laporan";

type Periode = (typeof PERIODE_LAPORAN)[number];

// PRD §14.6 "Rentang awal": tanggal akhir selalu hari ini WIB, dan tanggal mulainya bergantung pada periode.
describe("rentangAwalLaporan", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const hasil = rentangAwalLaporan({
      sekarang: new Date(input.sekarang),
      periode: input.periode as Periode,
      pesananSelesaiPertamaDibayarPada:
        input.pesananSelesaiPertamaDibayarPada === null
          ? null
          : new Date(input.pesananSelesaiPertamaDibayarPada),
    });

    expect({ mulai: hasil.mulai, akhir: hasil.akhir }).toEqual(output);
  });
});
