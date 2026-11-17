// Daftar Member di dasbor admin (PRD §2.3 ▶ Keputusan 2026-11-17). Aturan total belanja ada di
// src/domain/total-belanja.ts, dan Pesanan ditautkan ke Member lewat emailnya (ADR-0003).
import { and, desc, eq, sql } from "drizzle-orm";

import { totalBelanja } from "@/domain/total-belanja";

import { db } from "./db";
import { pesanan, user } from "./db/schema";

/**
 * Syarat pencarian (PRD §2.3 ▶ Keputusan 2026-11-17): email Member memuat kata cari itu, tanpa membedakan
 * huruf besar dan kecil, seperti pencarian daftar Pesanan (src/server/daftar-pesanan.ts). Spasi di ujung kata
 * cari diabaikan, dan kata cari dicari dengan strpos supaya `%` dan `_` dicocokkan sebagai huruf biasa.
 */
const cocokPencarian = (cari: string) =>
  sql`strpos(lower(${user.email}), lower(${cari.trim()})) > 0`;

/**
 * Member di daftar Member dasbor admin, yang terbaru terdaftar di atas (PRD §2.3 ▶ Keputusan 2026-11-17).
 * Daftar ini hanya memuat baris user berperan Member, yang dibuat begitu Kode verifikasi yang benar dimasukkan
 * (PRD §7.3), jadi Pendaftar (tabel pendaftar) dan Admin tidak ikut. Bila `cari` diberikan, hanya Member yang
 * emailnya memuat kata cari itu yang dimuat.
 *
 * Setiap baris membawa email, waktu terdaftar, status nonaktif, serta total belanja dan jumlah Pesanan Selesai beserta Pesanan
 * yang dihitung (PRD §2.3), tanpa password Member. Saringan di database hanya mempersempit bacaan ke Pesanan
 * Selesai yang emailnya memuat email salah satu Member itu; yang memutuskan Pesanan mana milik Member dan mana
 * yang dihitung adalah totalBelanja di domain (ADR-0002).
 */
export async function daftarMember({ cari }: { cari?: string }) {
  const syaratMember = and(
    eq(user.peran, "Member"),
    cari === undefined ? undefined : cocokPencarian(cari),
  );

  const semuaMember = await db
    .select({
      id: user.id,
      email: user.email,
      terdaftarPada: user.createdAt,
      nonaktif: user.nonaktif,
    })
    .from(user)
    .where(syaratMember)
    .orderBy(desc(user.createdAt), desc(user.id));
  if (semuaMember.length === 0) return [];

  const bacaanPesanan = await db
    .select({
      nomorPesanan: pesanan.nomorPesanan,
      email: pesanan.email,
      status: pesanan.status,
      totalBayar: pesanan.totalBayar,
      dibayarPada: pesanan.waktuBayar,
    })
    .from(pesanan)
    .where(
      and(
        eq(pesanan.status, "Selesai"),
        sql`exists (select 1 from ${user} where ${syaratMember} and strpos(lower(${pesanan.email}), ${user.email}) > 0)`,
      ),
    );

  return semuaMember.map((member) => ({
    ...member,
    belanja: totalBelanja({
      emailMember: member.email,
      pesanan: bacaanPesanan,
    }),
  }));
}
