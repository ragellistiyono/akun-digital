// Kelompok periode grafik Laporan keuangan (PRD §14.6 "Periode", §14.7).
import type { PeriodeLaporan } from "./rentang-awal-laporan";
import { awalTanggalToko, type RentangWaktu } from "./rentang-waktu-toko";

/** Tanggal kalender "YYYY-MM-DD" sebagai instan UTC tengah malam, hanya untuk berhitung tanggal. */
const tanggalUtc = (tanggal: string) => new Date(`${tanggal}T00:00:00Z`);

/** Tanggal kalender "YYYY-MM-DD"; tanggal dan bulan yang melewati batas dibawa ke depan. */
const tanggalKalender = (tahun: number, bulan: number, tanggal: number) =>
  new Date(Date.UTC(tahun, bulan, tanggal)).toISOString().slice(0, 10);

/** Tanggal terakhir unit periode (hari, minggu Senin sampai Minggu, bulan, atau tahun) yang memuat tanggal itu. */
function akhirUnit(periode: PeriodeLaporan, tanggal: string) {
  const t = tanggalUtc(tanggal);
  const tahun = t.getUTCFullYear();
  const bulan = t.getUTCMonth();
  const hari = t.getUTCDate();
  switch (periode) {
    case "Harian":
      return tanggal;
    case "Mingguan": {
      // Hari ke berapa sejak Senin: Senin 0 sampai Minggu 6.
      const sejakSenin = (t.getUTCDay() + 6) % 7;
      return tanggalKalender(tahun, bulan, hari + 6 - sejakSenin);
    }
    case "Bulanan":
      return tanggalKalender(tahun, bulan + 1, 0);
    case "Tahunan":
      return tanggalKalender(tahun, 11, 31);
  }
}

/** Tanggal sesudah tanggal itu. */
function besoknya(tanggal: string) {
  const t = tanggalUtc(tanggal);
  return tanggalKalender(
    t.getUTCFullYear(),
    t.getUTCMonth(),
    t.getUTCDate() + 1,
  );
}

/**
 * Kelompok periode grafik Laporan keuangan dalam rentang tanggal WIB `mulai` sampai `akhir`, keduanya ikut
 * dihitung (PRD §14.6, tests/golden/kelompok-periode-laporan.json). Minggu dihitung Senin sampai Minggu, bulan
 * dan tahun mengikuti kalender. Kelompok pertama dan terakhir hanya berisi tanggal di dalam rentang. Setiap
 * kelompok tetap ada walaupun tanpa Pesanan Selesai.
 *
 * Setiap kelompok membawa tanggal mulai dan akhirnya, serta rentang instannya: 00.00.00 WIB tanggal mulai sampai
 * sebelum 00.00.00 WIB sesudah tanggal akhir, untuk dipakai fungsi laba. Hasilnya membawa periode dan rentang
 * tanggal sebagai bahan hitungnya. Rentang dengan tanggal akhir sebelum tanggal mulai tidak punya kelompok.
 */
export function kelompokPeriodeLaporan({
  periode,
  mulai,
  akhir,
}: {
  periode: PeriodeLaporan;
  mulai: string;
  akhir: string;
}) {
  const kelompok: { mulai: string; akhir: string; rentang: RentangWaktu }[] =
    [];
  for (let awal = mulai; awal <= akhir;) {
    const ujung = akhirUnit(periode, awal);
    const akhirKelompok = ujung < akhir ? ujung : akhir;
    const sesudahnya = besoknya(akhirKelompok);
    kelompok.push({
      mulai: awal,
      akhir: akhirKelompok,
      rentang: {
        mulai: awalTanggalToko(awal),
        sebelum: awalTanggalToko(sesudahnya),
      },
    });
    awal = sesudahnya;
  }
  return { periode, mulai, akhir, kelompok };
}
