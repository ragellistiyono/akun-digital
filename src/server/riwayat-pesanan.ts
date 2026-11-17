// Riwayat Pesanan Member (PRD §7.4). Pesanan ditautkan ke Member lewat emailnya, dan penautan itu dihitung
// setiap kali Riwayat Pesanan dibaca (ADR-0003), jadi Pesanan yang emailnya dikoreksi Admin langsung pindah.
import { and, desc, eq, sql } from "drizzle-orm";

import { emailBaku, emailSama } from "@/domain/kesamaan-email";

import { waktuDibuat } from "./daftar-pesanan";
import { db } from "./db";
import { pesanan, produk, user, varian } from "./db/schema";

/**
 * Riwayat Pesanan Member dengan email itu (PRD §7.4): semua Pesanan, apa pun statusnya, yang emailnya sama
 * dengan email Member menurut emailBaku, termasuk Pesanan yang dibuat sebelum ia menjadi Member. Yang
 * terbaru dibuat ada di atas. Setiap baris membawa Tautan Pesanan-nya, supaya baris itu bisa membuka
 * Halaman Pesanan (PRD §7.4 ▶ Keputusan 2026-11-17), serta email dan tanda "Email gagal"-nya, supaya dasbor
 * admin bisa menampilkannya dengan kolom daftar Pesanan (PRD §9.5).
 *
 * Saringan di database hanya mempersempit bacaan ke Pesanan yang emailnya memuat bentuk baku email Member,
 * tanpa membedakan huruf besar dan kecil. Yang memutuskan apakah Pesanan itu milik Member adalah emailSama
 * di domain (ADR-0002), seperti batasPesananMenunggu saat checkout.
 */
export async function riwayatPesanan(emailMember: string) {
  const bacaan = await db
    .with(waktuDibuat)
    .select({
      nomorPesanan: pesanan.nomorPesanan,
      tautan: pesanan.tautan,
      status: pesanan.status,
      totalBayar: pesanan.totalBayar,
      email: pesanan.email,
      emailGagal: pesanan.emailGagal,
      namaProduk: produk.nama,
      namaVarian: varian.nama,
      waktuDibuat: waktuDibuat.waktu,
    })
    .from(pesanan)
    .innerJoin(varian, eq(pesanan.varianId, varian.id))
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .leftJoin(waktuDibuat, eq(waktuDibuat.pesananId, pesanan.id))
    .where(sql`strpos(lower(${pesanan.email}), ${emailBaku(emailMember)}) > 0`)
    .orderBy(
      sql`${waktuDibuat.waktu} desc nulls last`,
      desc(pesanan.nomorPesanan),
    );

  return bacaan.filter((satu) => emailSama(satu.email, emailMember));
}

/**
 * Riwayat Pesanan Member dengan id itu di dasbor admin (PRD §2.3 ▶ Keputusan 2026-11-17): Pesanan yang sama
 * dengan Riwayat Pesanan Member itu di toko (PRD §7.4), beserta email dan status nonaktif Member-nya. Hasilnya
 * null bila tidak ada Member dengan id itu; Pendaftar belum punya id Member, dan Admin bukan Member.
 * Pemeriksaan bahwa yang membaca adalah Admin dilakukan halaman pemanggilnya.
 */
export async function riwayatPesananMember(idMember: string) {
  const [member] = await db
    .select({ id: user.id, email: user.email, nonaktif: user.nonaktif })
    .from(user)
    .where(and(eq(user.id, idMember), eq(user.peran, "Member")));
  if (!member) return null;
  return { member, pesanan: await riwayatPesanan(member.email) };
}
