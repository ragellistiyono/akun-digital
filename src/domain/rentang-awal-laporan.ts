// Rentang awal Laporan keuangan per periode (PRD §14.6 "Rentang awal").

/** Pilihan periode Laporan keuangan, dengan urutan PRD §14.6. Halaman dibuka dengan Harian. */
export const PERIODE_LAPORAN = [
  "Harian",
  "Mingguan",
  "Bulanan",
  "Tahunan",
] as const;

export type PeriodeLaporan = (typeof PERIODE_LAPORAN)[number];

/** Zona waktu toko adalah WIB, yang selalu UTC+7 tanpa jam musim panas (PRD §9.1). */
const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;

/** Tanggal kalender "YYYY-MM-DD"; tanggal dan bulan yang melewati batas dibawa ke depan atau ke belakang. */
const tanggalKalender = (tahun: number, bulan: number, tanggal: number) =>
  new Date(Date.UTC(tahun, bulan, tanggal)).toISOString().slice(0, 10);

/** Tahun, bulan (0–11), tanggal, dan hari (0 Minggu sampai 6 Sabtu) WIB sebuah instan. */
function kalenderWib(instan: Date) {
  const wib = new Date(instan.getTime() + OFFSET_WIB_MS);
  return {
    tahun: wib.getUTCFullYear(),
    bulan: wib.getUTCMonth(),
    tanggal: wib.getUTCDate(),
    hari: wib.getUTCDay(),
  };
}

/**
 * Rentang awal Laporan keuangan untuk periode itu (PRD §14.6, tests/golden/rentang-awal-laporan.json), sebagai
 * tanggal WIB "YYYY-MM-DD" yang keduanya ikut dihitung. Tanggal akhir selalu hari ini. Tanggal mulainya:
 * - Harian: 30 hari terakhir, termasuk hari ini;
 * - Mingguan: Senin dari 12 minggu terakhir, termasuk minggu berjalan (minggu berawal Senin);
 * - Bulanan: tanggal 1 dari 12 bulan terakhir, termasuk bulan berjalan;
 * - Tahunan: 1 Januari tahun WIB waktu bayar Pesanan Selesai pertama, atau tahun berjalan bila belum ada.
 *
 * Hasilnya membawa periode dan waktu bayar Pesanan Selesai pertama sebagai bahan hitungnya.
 */
export function rentangAwalLaporan({
  sekarang,
  periode,
  pesananSelesaiPertamaDibayarPada,
}: {
  sekarang: Date;
  periode: PeriodeLaporan;
  pesananSelesaiPertamaDibayarPada: Date | null;
}) {
  const hariIni = kalenderWib(sekarang);
  const { tahun, bulan, tanggal } = hariIni;

  const mulai = (() => {
    switch (periode) {
      case "Harian":
        return tanggalKalender(tahun, bulan, tanggal - 29);
      case "Mingguan": {
        // Hari ke berapa sejak Senin: Senin 0 sampai Minggu 6.
        const sejakSenin = (hariIni.hari + 6) % 7;
        return tanggalKalender(tahun, bulan, tanggal - sejakSenin - 11 * 7);
      }
      case "Bulanan":
        return tanggalKalender(tahun, bulan - 11, 1);
      case "Tahunan": {
        const tahunPertama =
          pesananSelesaiPertamaDibayarPada === null
            ? tahun
            : kalenderWib(pesananSelesaiPertamaDibayarPada).tahun;
        return tanggalKalender(tahunPertama, 0, 1);
      }
    }
  })();

  return {
    mulai,
    akhir: tanggalKalender(tahun, bulan, tanggal),
    periode,
    pesananSelesaiPertamaDibayarPada,
  };
}
