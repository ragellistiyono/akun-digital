// Daftar Pesanan di dasbor admin (PRD §9.5): saringan status dan rentang tanggal WIB (PRD §9.1), serta
// pencarian menurut email (PRD §7.4) atau Nomor Pesanan (PRD §9.6).
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

import { emailBaku } from "@/domain/kesamaan-email";
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
 * Syarat pencarian: email Pesanan sama dengan teks itu menurut emailBaku (PRD §7.4), atau Nomor Pesanan-nya
 * sama dengan teks itu. Bentuk baku email Pesanan dihitung di database dengan lower(btrim()), yang sama
 * dengan emailBaku untuk email; daftar-pesanan.test.ts memeriksanya dengan tests/golden/kesamaan-email.json.
 * Nomor Pesanan selalu huruf besar (PRD §9.6), jadi teks yang dicari ikut dibuat huruf besar.
 */
function cocokPencarian(cari: string) {
  return or(
    eq(sql`lower(btrim(${pesanan.email}))`, emailBaku(cari)),
    eq(pesanan.nomorPesanan, cari.trim().toUpperCase()),
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
 * - `cari` memuat Pesanan yang emailnya sama dengan teks itu menurut emailBaku (PRD §7.4), atau yang Nomor
 *   Pesanan-nya sama persis dengan teks itu tanpa spasi di ujung dan tanpa membedakan huruf besar dan kecil.
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
