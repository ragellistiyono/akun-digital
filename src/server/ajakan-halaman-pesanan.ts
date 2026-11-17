// Ajakan di bawah Item stok Halaman Pesanan Selesai (PRD §7.1 ▶ Keputusan 2026-11-17). Pesanan ditautkan
// ke Member lewat email, dan penautan itu dihitung setiap kali halaman dibuka (ADR-0003).
import { and, eq, sql } from "drizzle-orm";

import { ajakanHalamanPesanan } from "@/domain/ajakan-halaman-pesanan";
import { emailBaku } from "@/domain/kesamaan-email";

import { db } from "./db";
import { pesanan, user } from "./db/schema";

/**
 * Ajakan di Halaman Pesanan dengan Tautan Pesanan itu, beserta email Pesanan-nya, atau null bila tidak ada
 * Pesanan dengan Tautan Pesanan itu. `emailMemberLogin` adalah email Member yang sedang login, atau null.
 *
 * Saringan di database hanya mempersempit bacaan ke Member, aktif maupun nonaktif, yang email bakunya sama
 * dengan email Pesanan. Pendaftar dan Admin bukan Member, jadi tidak ikut terbaca. Yang memutuskan ajakannya
 * adalah ajakanHalamanPesanan di domain (ADR-0002).
 */
export async function bacaAjakanHalamanPesanan({
  tautan,
  emailMemberLogin,
}: {
  tautan: string;
  emailMemberLogin: string | null;
}) {
  const [baris] = await db
    .select({ email: pesanan.email, status: pesanan.status })
    .from(pesanan)
    .where(eq(pesanan.tautan, tautan));
  if (!baris) return null;

  const semuaMember = await db
    .select({ email: user.email })
    .from(user)
    .where(
      and(
        eq(user.peran, "Member"),
        sql`lower(${user.email}) = ${emailBaku(baris.email)}`,
      ),
    );
  return {
    ajakan: ajakanHalamanPesanan({
      status: baris.status,
      emailPesanan: baris.email,
      emailMemberLogin,
      semuaMember,
    }),
    emailPesanan: baris.email,
  };
}
