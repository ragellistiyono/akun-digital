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
