// Kartu angka Pendapatan, Pesanan Selesai, dan Member aktif di Ringkasan dasbor admin (PRD §9.2, §9.3).
// Aturannya ada di src/domain/pendapatan.ts, src/domain/jumlah-pesanan-selesai.ts,
// src/domain/rentang-waktu-toko.ts, dan src/domain/member-aktif.ts.
import { and, eq, gte, lt } from "drizzle-orm";

import { jumlahMemberAktif } from "@/domain/member-aktif";
import { jumlahPesananSelesai } from "@/domain/jumlah-pesanan-selesai";
import { pendapatan } from "@/domain/pendapatan";
import {
  rentangWaktuToko,
  type RentangWaktu,
} from "@/domain/rentang-waktu-toko";

import { db } from "./db";
import { pesanan, user } from "./db/schema";

/**
 * Pendapatan dan jumlah Pesanan Selesai hari ini dan bulan ini menurut Zona waktu toko, untuk instan
 * `sekarang` (PRD §9.1). Keduanya dihitung menurut waktu pembayaran (PRD §9.2 ▶ Keputusan 2026-11-17, §9.3),
 * dan setiap angka membawa rentang serta Pesanan yang dihitung sebagai bahan hitungnya.
 *
 * Hari ini selalu ada di dalam bulan ini, jadi cukup Pesanan yang dibayar bulan ini yang dibaca dari database.
 * Waktu "sekarang" bisa diganti untuk test.
 */
export async function angkaRingkasan({
  sekarang = new Date(),
}: { sekarang?: Date } = {}) {
  const { hariIni, bulanIni } = rentangWaktuToko({ sekarang });
  const dibayarBulanIni = await db
    .select({
      status: pesanan.status,
      totalBayar: pesanan.totalBayar,
      dibayarPada: pesanan.waktuBayar,
    })
    .from(pesanan)
    .where(
      and(
        gte(pesanan.waktuBayar, bulanIni.mulai),
        lt(pesanan.waktuBayar, bulanIni.sebelum),
      ),
    );

  const angkaDalam = (rentang: RentangWaktu) => ({
    pendapatan: pendapatan({ rentang, pesanan: dibayarBulanIni }),
    pesananSelesai: jumlahPesananSelesai({ rentang, pesanan: dibayarBulanIni }),
  });
  return { hariIni: angkaDalam(hariIni), bulanIni: angkaDalam(bulanIni) };
}

/**
 * Jumlah Member aktif untuk kartu Member aktif (PRD §2.3 ▶ Keputusan 2026-11-17, §9.2). Yang dibaca hanya
 * baris user berperan Member, sama seperti daftar Member, jadi Pendaftar (tabel pendaftar) dan Admin tidak
 * ikut; yang memutuskan Member mana yang aktif adalah jumlahMemberAktif di domain (ADR-0002). Hasilnya membawa
 * Member yang dihitung, berupa email dan status nonaktifnya, sebagai bahan hitungnya.
 */
export async function angkaMemberAktif() {
  const semuaMember = await db
    .select({ email: user.email, nonaktif: user.nonaktif })
    .from(user)
    .where(eq(user.peran, "Member"));
  return jumlahMemberAktif({ semuaMember });
}
