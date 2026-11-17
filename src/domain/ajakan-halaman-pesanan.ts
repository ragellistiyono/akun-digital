// Ajakan di bawah Item stok Halaman Pesanan Selesai (PRD §7.1 ▶ Keputusan 2026-11-17). Kesamaan email
// ditentukan emailSama di kesamaan-email.ts (§7.4).
import { emailSama } from "./kesamaan-email";
import type { StatusPesanan } from "./status-pesanan";

/**
 * Yang tampil di bawah Item stok:
 * - `buat-akun`: ajakan "Buat akun untuk menyimpan riwayat";
 * - `login`: "Login untuk melihat riwayat";
 * - `lihat-riwayat`: tautan "Lihat Riwayat Pesanan";
 * - `tidak-ada`: tidak ada ajakan apa pun.
 */
export type AjakanHalamanPesanan =
  "buat-akun" | "login" | "lihat-riwayat" | "tidak-ada";

/**
 * Ajakan di Halaman Pesanan itu menurut PRD §7.1 ▶ Keputusan 2026-11-17. Hanya Pesanan Selesai yang mendapat
 * ajakan. `emailMemberLogin` adalah email Member yang sedang login, atau null bila tidak ada Member yang
 * login. `semuaMember` memuat Member aktif maupun nonaktif; Pendaftar dan Admin bukan Member, jadi email
 * mereka dianggap belum milik Member.
 */
export function ajakanHalamanPesanan({
  status,
  emailPesanan,
  emailMemberLogin,
  semuaMember,
}: {
  status: StatusPesanan;
  emailPesanan: string;
  emailMemberLogin: string | null;
  semuaMember: readonly { email: string }[];
}): AjakanHalamanPesanan {
  if (status !== "Selesai") return "tidak-ada";
  if (emailMemberLogin !== null) {
    return emailSama(emailMemberLogin, emailPesanan)
      ? "lihat-riwayat"
      : "tidak-ada";
  }
  return semuaMember.some((member) => emailSama(member.email, emailPesanan))
    ? "login"
    : "buat-akun";
}
