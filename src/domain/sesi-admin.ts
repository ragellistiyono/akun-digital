// PRD §2.2 ▶ Keputusan 2026-11-11: Admin tetap login selama 12 jam sejak login, walaupun sedang
// aktif memakai dasbor admin. Setelah itu Admin diminta login ulang.
export const LAMA_SESI_ADMIN_DETIK = 12 * 60 * 60;

/** Sesi Admin berlaku sejak login sampai sebelum tepat 12 jam sesudahnya. */
export function sesiAdminBerlaku({
  waktuLogin,
  sekarang,
}: {
  waktuLogin: Date;
  sekarang: Date;
}): boolean {
  return (
    sekarang.getTime() < waktuLogin.getTime() + LAMA_SESI_ADMIN_DETIK * 1000
  );
}
