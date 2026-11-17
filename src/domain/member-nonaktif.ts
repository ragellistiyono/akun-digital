// Member nonaktif (PRD §2.3, GLOSSARY): Member yang dinonaktifkan Admin, sehingga tidak bisa login maupun
// checkout dengan emailnya. Kesamaan email ditentukan emailSama di kesamaan-email.ts (§7.4).
import { emailSama } from "./kesamaan-email";

/**
 * Apakah email itu milik salah satu Member nonaktif (PRD §5.2 ▶ Keputusan 2026-11-17), yaitu sama menurut
 * §7.4 dengan email salah satu Member di `memberNonaktif`.
 */
export function emailMilikMemberNonaktif({
  email,
  memberNonaktif,
}: {
  email: string;
  memberNonaktif: readonly { email: string }[];
}): boolean {
  return memberNonaktif.some((member) => emailSama(member.email, email));
}
