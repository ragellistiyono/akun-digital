// Daftar Pesanan di dasbor admin (PRD §9.5): saringan status dan rentang tanggal WIB (PRD §9.1), serta
// pencarian menurut sebagian email atau sebagian Nomor Pesanan (PRD §9.5, ▶ Keputusan 2026-11-12).
import {
  and,
  count,
  desc,
  eq,
  gte,
  lt,
  min,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { StatusPesanan } from "@/domain/status-pesanan";

import { db } from "./db";
import { pesanan, produk, riwayatStatusPesanan, varian } from "./db/schema";
import { rentangTanggalWib } from "./zona-waktu-toko";

/** Jumlah Pesanan di satu halaman daftar. */
const UKURAN_HALAMAN = 50;

/**
 * Saringan daftar Pesanan. Tanggal berbentuk "YYYY-MM-DD" dan dibaca dalam WIB. `halaman` dimulai dari 1,
 * dan bawaannya 1.
 */
type SaringanPesanan = {
  status?: StatusPesanan;
  dari?: string;
  sampai?: string;
  cari?: string;
  halaman?: number;
};

/**
 * Waktu dibuat setiap Pesanan, yaitu waktu baris pertama Riwayat status Pesanan-nya, yang ditulis saat
 * Pesanan dibuat (src/server/db/schema.ts).
 */
const waktuDibuat = db.$with("waktu_dibuat").as(
  db
    .select({
      pesananId: riwayatStatusPesanan.pesananId,
      waktu: min(riwayatStatusPesanan.waktu).as("waktu"),
    })
    .from(riwayatStatusPesanan)
    .groupBy(riwayatStatusPesanan.pesananId),
);

/**
 * Instan sebagai nilai timestamptz. Kolom hasil CTE tidak membawa pengubah Date milik Drizzle, jadi
 * instannya dikirim sebagai teks ISO.
 */
const instan = (waktu: Date) => sql`${waktu.toISOString()}::timestamptz`;

/**
 * Syarat pencarian (PRD §9.5, ▶ Keputusan 2026-11-12): email Pesanan atau Nomor Pesanan-nya memuat kata cari
 * itu, tanpa membedakan huruf besar dan kecil. Spasi di ujung kata cari diabaikan. Kata cari dicari dengan
 * strpos, bukan LIKE, supaya `%` dan `_` dicocokkan sebagai huruf biasa, bukan pola. Email atau Nomor Pesanan
 * lengkap tetap menemukan Pesanan itu, karena setiap teks memuat dirinya sendiri.
 */
function cocokPencarian(cari: string) {
  const kata = cari.trim();
  return or(
    sql`strpos(lower(${pesanan.email}), lower(${kata})) > 0`,
    sql`strpos(lower(${pesanan.nomorPesanan}), lower(${kata})) > 0`,
  );
}

/**
 * Satu halaman Pesanan yang cocok dengan saringan itu, yang terbaru dibuat di atas, beserta jumlah semua
 * Pesanan yang cocok dan jumlah halamannya. Setiap halaman memuat 50 Pesanan. Daftar tanpa Pesanan tetap
 * punya satu halaman, dan halaman sesudah halaman terakhir kosong.
 *
 * - `status` hanya memuat Pesanan berstatus itu.
 * - `dari` dan `sampai` memuat Pesanan yang dibuat dari pukul 00.00.00 WIB tanggal `dari` sampai 23.59.59
 *   WIB tanggal `sampai` (PRD §9.1).
 * - `cari` memuat Pesanan yang email atau Nomor Pesanan-nya memuat teks itu, tanpa spasi di ujung dan tanpa
 *   membedakan huruf besar dan kecil.
 */
export async function daftarPesanan(saringan: SaringanPesanan) {
  const halaman = saringan.halaman ?? 1;
  const { mulai, sebelum } = rentangTanggalWib(saringan);
  const syarat: (SQL | undefined)[] = [
    saringan.status === undefined
      ? undefined
      : eq(pesanan.status, saringan.status),
    mulai === undefined ? undefined : gte(waktuDibuat.waktu, instan(mulai)),
    sebelum === undefined ? undefined : lt(waktuDibuat.waktu, instan(sebelum)),
    saringan.cari === undefined ? undefined : cocokPencarian(saringan.cari),
  ];

  const cocok = and(...syarat);

  const [{ jumlah }] = await db
    .with(waktuDibuat)
    .select({ jumlah: count() })
    .from(pesanan)
    .leftJoin(waktuDibuat, eq(waktuDibuat.pesananId, pesanan.id))
    .where(cocok);

  const baris = await db
    .with(waktuDibuat)
    .select({
      nomorPesanan: pesanan.nomorPesanan,
      waktuDibuat: waktuDibuat.waktu,
      email: pesanan.email,
      namaProduk: produk.nama,
      namaVarian: varian.nama,
      totalBayar: pesanan.totalBayar,
      status: pesanan.status,
      emailGagal: pesanan.emailGagal,
    })
    .from(pesanan)
    .innerJoin(varian, eq(pesanan.varianId, varian.id))
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .leftJoin(waktuDibuat, eq(waktuDibuat.pesananId, pesanan.id))
    .where(cocok)
    .orderBy(
      sql`${waktuDibuat.waktu} desc nulls last`,
      desc(pesanan.nomorPesanan),
    )
    .limit(UKURAN_HALAMAN)
    .offset((halaman - 1) * UKURAN_HALAMAN);

  return {
    pesanan: baris,
    jumlah,
    halaman,
    jumlahHalaman: Math.max(1, Math.ceil(jumlah / UKURAN_HALAMAN)),
  };
}

/** Jumlah semua Pesanan Bermasalah, yang tampil menonjol di menu dasbor admin (PRD §5.9). */
export async function jumlahPesananBermasalah() {
  const [{ jumlah }] = await db
    .select({ jumlah: count() })
    .from(pesanan)
    .where(eq(pesanan.status, "Bermasalah"));
  return jumlah;
}
