// Masa berlaku Kode verifikasi (PRD §7.3).

/** Lama Kode verifikasi berlaku sejak dikirim, dalam menit (PRD §7.3). */
const MASA_BERLAKU_KODE_MENIT = 10;

const SATU_MENIT_MS = 60 * 1000;

/**
 * Apakah Kode verifikasi yang dikirim pada `dikirimPada` masih berlaku pada `sekarang`. Kode berlaku
 * 10 menit sejak dikirim; tepat 10 menit sesudahnya sudah tidak berlaku.
 */
export function kodeVerifikasiBerlaku({
  dikirimPada,
  sekarang,
}: {
  dikirimPada: Date;
  sekarang: Date;
}): { berlaku: boolean } {
  const berakhirPada =
    dikirimPada.getTime() + MASA_BERLAKU_KODE_MENIT * SATU_MENIT_MS;
  return { berlaku: sekarang.getTime() < berakhirPada };
}
