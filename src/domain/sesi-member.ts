// PRD §7.5 ▶ Keputusan 2026-11-11: Member tetap login selama 30 hari sejak login. Setelah itu Member
// diminta login ulang.
export const LAMA_SESI_MEMBER_DETIK = 30 * 24 * 60 * 60;

/** Sesi Member berlaku sejak login sampai sebelum tepat 30 hari sesudahnya. */
export function sesiMemberBerlaku({
  waktuLogin,
  sekarang,
}: {
  waktuLogin: Date;
  sekarang: Date;
}): boolean {
  return (
    sekarang.getTime() < waktuLogin.getTime() + LAMA_SESI_MEMBER_DETIK * 1000
  );
}
