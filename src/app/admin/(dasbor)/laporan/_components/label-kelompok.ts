// Label kelompok periode grafik Laporan keuangan (PRD §14.7, DESIGN.md "Grafik Laporan keuangan"). Tanggalnya
// tanggal kalender WIB "YYYY-MM-DD", jadi dibaca sebagai tanggal UTC tanpa konversi zona waktu.
import type { PeriodeLaporan } from "@/domain/rentang-awal-laporan";

const formatTanggal = new Intl.DateTimeFormat("id-ID", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Tanggal, bulan singkat, dan tahun tanggal kalender itu, misalnya { tanggal: "20", bulan: "Nov", tahun: "2026" }. */
function bagianTanggal(tanggal: string) {
  const bagian = formatTanggal.formatToParts(new Date(`${tanggal}T00:00:00Z`));
  const ambil = (jenis: Intl.DateTimeFormatPartTypes) =>
    bagian.find((b) => b.type === jenis)?.value ?? "";
  return { tanggal: ambil("day"), bulan: ambil("month"), tahun: ambil("year") };
}

/** Apakah kelompok itu satu bulan atau satu tahun kalender penuh, tanpa terpotong rentang. */
function bulanPenuh(mulai: string, akhir: string) {
  const sesudah = new Date(`${akhir}T00:00:00Z`);
  sesudah.setUTCDate(sesudah.getUTCDate() + 1);
  return (
    mulai.endsWith("-01") &&
    akhir.slice(0, 7) === mulai.slice(0, 7) &&
    sesudah.getUTCDate() === 1
  );
}
const tahunPenuh = (mulai: string, akhir: string) =>
  mulai.endsWith("-01-01") &&
  akhir.endsWith("-12-31") &&
  mulai.slice(0, 4) === akhir.slice(0, 4);

/**
 * Label lengkap kelompok untuk catatan nilai dan ringkasan pembaca layar:
 * - satu hari: "20 Nov 2026";
 * - bulan atau tahun penuh: "Nov 2026" atau "2026";
 * - selain itu rentang tanggalnya: "16–22 Nov 2026", "26 Okt–1 Nov 2026", atau "29 Des 2025–4 Jan 2026".
 */
function labelLengkap(periode: PeriodeLaporan, mulai: string, akhir: string) {
  const a = bagianTanggal(mulai);
  const b = bagianTanggal(akhir);
  if (mulai === akhir) return `${a.tanggal} ${a.bulan} ${a.tahun}`;
  if (periode === "Bulanan" && bulanPenuh(mulai, akhir)) {
    return `${a.bulan} ${a.tahun}`;
  }
  if (periode === "Tahunan" && tahunPenuh(mulai, akhir)) return a.tahun;
  if (a.tahun !== b.tahun) {
    return `${a.tanggal} ${a.bulan} ${a.tahun}–${b.tanggal} ${b.bulan} ${b.tahun}`;
  }
  if (a.bulan !== b.bulan) {
    return `${a.tanggal} ${a.bulan}–${b.tanggal} ${b.bulan} ${b.tahun}`;
  }
  return `${a.tanggal}–${b.tanggal} ${b.bulan} ${b.tahun}`;
}

/** Label pendek di sumbu mendatar: "20 Nov" untuk Harian dan Mingguan (tanggal mulai), "Nov 2026", atau "2026". */
function labelSumbu(periode: PeriodeLaporan, mulai: string) {
  const a = bagianTanggal(mulai);
  switch (periode) {
    case "Harian":
    case "Mingguan":
      return `${a.tanggal} ${a.bulan}`;
    case "Bulanan":
      return `${a.bulan} ${a.tahun}`;
    case "Tahunan":
      return a.tahun;
  }
}

/** Label lengkap dan label sumbu sebuah kelompok periode. */
export function labelKelompok(
  periode: PeriodeLaporan,
  { mulai, akhir }: { mulai: string; akhir: string },
) {
  return {
    label: labelLengkap(periode, mulai, akhir),
    sumbu: labelSumbu(periode, mulai),
  };
}
