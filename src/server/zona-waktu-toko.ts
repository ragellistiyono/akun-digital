// Satu-satunya tempat konversi ke Zona waktu toko, yaitu WIB (PRD §9.1, CODING_STANDARDS.md).
const SATU_MENIT_MS = 60 * 1000;

const formatJamWib = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Jam WIB berformat "HH.MM" untuk sebuah instan. Detik dibulatkan ke menit berikutnya, supaya
 * jam yang tertulis, misalnya di "coba lagi mulai pukul …", tidak pernah mendahului instannya.
 */
export function jamWibDibulatkanKeAtas(instan: Date): string {
  const menitPenuh = new Date(
    Math.ceil(instan.getTime() / SATU_MENIT_MS) * SATU_MENIT_MS,
  );
  const bagian = formatJamWib.formatToParts(menitPenuh);
  const ambil = (jenis: "hour" | "minute") =>
    bagian.find((b) => b.type === jenis)?.value;
  return `${ambil("hour")}.${ambil("minute")}`;
}

/** WIB selalu UTC+7, tanpa jam musim panas, jadi setiap tanggal WIB berawal pada offset yang sama. */
const OFFSET_WIB = "+07:00";
const SATU_HARI_MS = 24 * 60 * 60 * 1000;

/** Instan pukul 00.00.00 WIB pada tanggal "YYYY-MM-DD" itu. */
const awalTanggalWib = (tanggal: string) =>
  new Date(`${tanggal}T00:00:00${OFFSET_WIB}`);

/**
 * Rentang instan untuk tanggal-tanggal WIB "YYYY-MM-DD" (PRD §9.1): `mulai` pukul 00.00.00 WIB tanggal
 * `dari` (termasuk), dan `sebelum` pukul 00.00.00 WIB sesudah tanggal `sampai` (tidak termasuk), sehingga
 * tanggal `sampai` dimuat sampai pukul 23.59.59. Sisi yang tanggalnya tidak diberikan tidak dibatasi.
 */
export function rentangTanggalWib({
  dari,
  sampai,
}: {
  dari?: string;
  sampai?: string;
}): { mulai: Date | undefined; sebelum: Date | undefined } {
  return {
    mulai: dari === undefined ? undefined : awalTanggalWib(dari),
    sebelum:
      sampai === undefined
        ? undefined
        : new Date(awalTanggalWib(sampai).getTime() + SATU_HARI_MS),
  };
}

const formatWaktuWib = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Tanggal dan jam WIB sebuah instan, misalnya "11 Nov 2026 23.30". Detiknya dibuang tanpa pembulatan,
 * supaya instan pukul 23.59.59 tetap tertulis di tanggalnya sendiri.
 */
export function waktuWib(instan: Date): string {
  const bagian = formatWaktuWib.formatToParts(instan);
  const ambil = (jenis: Intl.DateTimeFormatPartTypes) =>
    bagian.find((b) => b.type === jenis)?.value;
  return `${ambil("day")} ${ambil("month")} ${ambil("year")} ${ambil("hour")}.${ambil("minute")}`;
}
