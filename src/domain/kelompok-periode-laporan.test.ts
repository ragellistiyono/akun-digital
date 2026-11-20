import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/kelompok-periode-laporan.json";
import { kelompokPeriodeLaporan } from "./kelompok-periode-laporan";
import type { PeriodeLaporan } from "./rentang-awal-laporan";

// PRD §14.6 "Periode": kelompok grafik per periode dalam rentang tanggal WIB, dipotong di kedua ujung.
describe("kelompokPeriodeLaporan", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const hasil = kelompokPeriodeLaporan({
      periode: input.periode as PeriodeLaporan,
      mulai: input.mulai,
      akhir: input.akhir,
    });

    expect(
      hasil.kelompok.map(({ mulai, akhir }) => ({ mulai, akhir })),
    ).toEqual(output.kelompok);
  });

  it("setiap kelompok membawa rentang instannya: 00.00 WIB tanggal mulai sampai sebelum 00.00 WIB sesudah tanggal akhir", () => {
    const hasil = kelompokPeriodeLaporan({
      periode: "Mingguan",
      mulai: "2026-11-04",
      akhir: "2026-11-20",
    });

    expect(hasil.kelompok[0].rentang).toEqual({
      mulai: new Date("2026-11-04T00:00:00+07:00"),
      sebelum: new Date("2026-11-09T00:00:00+07:00"),
    });
    expect(hasil.kelompok[2].rentang).toEqual({
      mulai: new Date("2026-11-16T00:00:00+07:00"),
      sebelum: new Date("2026-11-21T00:00:00+07:00"),
    });
  });
});
