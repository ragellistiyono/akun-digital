// Masa berlaku Tautan atur ulang password (PRD §7.5 ▶ Keputusan 2026-11-17).

/** Lama Tautan atur ulang password berlaku sejak dikirim, dalam menit (PRD §7.5). */
const MASA_BERLAKU_TAUTAN_MENIT = 30;

const SATU_MENIT_MS = 60 * 1000;

/** Sebab Tautan atur ulang password tidak berlaku lagi. */
export type AlasanTautanTidakBerlaku =
  "kedaluwarsa" | "sudah-dipakai" | "diganti";

/**
 * Apakah Tautan atur ulang password yang dikirim pada `dikirimPada` masih bisa dipakai pada `sekarang`.
 * Tautan berlaku 30 menit sejak dikirim (tepat 30 menit sesudahnya sudah tidak berlaku), hanya sekali
 * pakai, dan tidak berlaku lagi begitu tautan baru untuk email yang sama dikirim (`diganti`).
 *
 * Bila lebih dari satu sebab berlaku sekaligus, alasan yang dipilih berurutan: sudah dipakai, diganti,
 * lalu kedaluwarsa.
 */
export function tautanAturUlangPasswordBerlaku({
  dikirimPada,
  sekarang,
  sudahDipakai,
  diganti,
}: {
  dikirimPada: Date;
  sekarang: Date;
  sudahDipakai: boolean;
  diganti: boolean;
}):
  | { berlaku: true; alasan: null }
  | { berlaku: false; alasan: AlasanTautanTidakBerlaku } {
  if (sudahDipakai) return { berlaku: false, alasan: "sudah-dipakai" };
  if (diganti) return { berlaku: false, alasan: "diganti" };
  const berakhirPada =
    dikirimPada.getTime() + MASA_BERLAKU_TAUTAN_MENIT * SATU_MENIT_MS;
  if (sekarang.getTime() >= berakhirPada) {
    return { berlaku: false, alasan: "kedaluwarsa" };
  }
  return { berlaku: true, alasan: null };
}
