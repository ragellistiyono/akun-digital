import { sesiMemberBerlaku } from "@/domain/sesi-member";

import { auth } from "./auth";

/**
 * Membaca sesi Member dari cookie permintaan. Hasilnya null bila tidak ada sesi, bila sesi itu milik
 * Admin, atau bila sesi sudah mencapai 30 hari sejak login (PRD §7.5 ▶ Keputusan 2026-11-11).
 */
export async function bacaSesiMember(kepala: Headers) {
  const sesi = await auth.api.getSession({ headers: kepala });
  if (sesi?.user.peran !== "Member") return null;

  const berlaku = sesiMemberBerlaku({
    waktuLogin: sesi.session.createdAt,
    sekarang: new Date(),
  });
  return berlaku ? sesi : null;
}
