// Kartu angka Pendapatan dan Pesanan Selesai di Ringkasan dasbor admin (PRD §9.2, §9.3). Aturannya ada di
// src/domain/pendapatan.ts, src/domain/jumlah-pesanan-selesai.ts, dan src/domain/rentang-waktu-toko.ts.
import { and, gte, lt } from "drizzle-orm";

import { jumlahPesananSelesai } from "@/domain/jumlah-pesanan-selesai";
import { pendapatan } from "@/domain/pendapatan";
import {
  rentangWaktuToko,
  type RentangWaktu,
} from "@/domain/rentang-waktu-toko";

import { db } from "./db";
import { pesanan } from "./db/schema";

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
