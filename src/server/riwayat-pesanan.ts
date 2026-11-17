// Riwayat Pesanan Member (PRD §7.4). Pesanan ditautkan ke Member lewat emailnya, dan penautan itu dihitung
// setiap kali Riwayat Pesanan dibaca (ADR-0003), jadi Pesanan yang emailnya dikoreksi Admin langsung pindah.
import { desc, eq, sql } from "drizzle-orm";

import { emailBaku } from "@/domain/kesamaan-email";

import { waktuDibuat } from "./daftar-pesanan";
import { db } from "./db";
import { pesanan, produk, varian } from "./db/schema";

/**
 * Riwayat Pesanan Member dengan email itu (PRD §7.4): semua Pesanan, apa pun statusnya, yang emailnya sama
 * dengan email Member menurut emailBaku, termasuk Pesanan yang dibuat sebelum ia menjadi Member. Yang
 * terbaru dibuat ada di atas. Setiap baris membawa Tautan Pesanan-nya, supaya baris itu bisa membuka
 * Halaman Pesanan (PRD §7.4 ▶ Keputusan 2026-11-17).
 *
 * Bentuk baku email Member dihitung emailBaku di domain. Email yang tersimpan di Pesanan dibakukan dengan
 * cara yang sama di database (huruf kecil, tanpa spasi di ujung), supaya Pesanan disaring di database.
 */
export async function riwayatPesanan(emailMember: string) {
  return db
    .with(waktuDibuat)
    .select({
      nomorPesanan: pesanan.nomorPesanan,
      tautan: pesanan.tautan,
      status: pesanan.status,
      totalBayar: pesanan.totalBayar,
      namaProduk: produk.nama,
      namaVarian: varian.nama,
      waktuDibuat: waktuDibuat.waktu,
    })
    .from(pesanan)
    .innerJoin(varian, eq(pesanan.varianId, varian.id))
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .leftJoin(waktuDibuat, eq(waktuDibuat.pesananId, pesanan.id))
    .where(sql`lower(btrim(${pesanan.email})) = ${emailBaku(emailMember)}`)
    .orderBy(
      sql`${waktuDibuat.waktu} desc nulls last`,
      desc(pesanan.nomorPesanan),
    );
}
