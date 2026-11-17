// "Hari ini" dan "bulan ini" dalam Zona waktu toko (PRD §9.1).

/** Rentang instan: `mulai` termasuk, `sebelum` tidak termasuk. */
export type RentangWaktu = { mulai: Date; sebelum: Date };

/**
 * Zona waktu toko adalah WIB, yang selalu UTC+7 tanpa jam musim panas (PRD §9.1), jadi pergeseran tetap ini
 * cukup untuk membaca tanggal WIB sebuah instan.
 */
const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;

/** Instan pukul 00.00.00 WIB pada tanggal WIB itu. Tanggal dan bulan yang melewati batas dibawa ke depan. */
const awalTanggalWib = (tahun: number, bulan: number, tanggal: number) =>
  new Date(Date.UTC(tahun, bulan, tanggal) - OFFSET_WIB_MS);

/**
 * Rentang "hari ini" dan "bulan ini" untuk instan `sekarang` (PRD §9.1). Hari ini berawal pukul 00.00.00 WIB
 * tanggal berjalan dan berakhir sebelum pukul 00.00.00 WIB keesokan harinya. Bulan ini berawal tanggal 1
 * pukul 00.00.00 WIB dan berakhir sebelum tanggal 1 bulan berikutnya, seperti di
 * tests/golden/rentang-waktu-toko.json.
 */
export function rentangWaktuToko({ sekarang }: { sekarang: Date }): {
  hariIni: RentangWaktu;
  bulanIni: RentangWaktu;
} {
  const wib = new Date(sekarang.getTime() + OFFSET_WIB_MS);
  const tahun = wib.getUTCFullYear();
  const bulan = wib.getUTCMonth();
  const tanggal = wib.getUTCDate();
  return {
    hariIni: {
      mulai: awalTanggalWib(tahun, bulan, tanggal),
      sebelum: awalTanggalWib(tahun, bulan, tanggal + 1),
    },
    bulanIni: {
      mulai: awalTanggalWib(tahun, bulan, 1),
      sebelum: awalTanggalWib(tahun, bulan + 1, 1),
    },
  };
}

/** Apakah instan itu ada di dalam rentang: sama dengan atau sesudah `mulai`, dan sebelum `sebelum`. */
export function dalamRentang(instan: Date, { mulai, sebelum }: RentangWaktu) {
  return instan >= mulai && instan < sebelum;
}
