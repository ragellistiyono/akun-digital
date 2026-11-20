// Laporan keuangan di dasbor admin (PRD §14.5, §14.6, §14.8): rincian angka dan tabel Pesanan Selesai dalam
// saringan rentang tanggal WIB, Kategori, dan Produk. Aturan hitungnya ada di src/domain/laba.ts,
// src/domain/harga-modal.ts, dan src/domain/rentang-awal-laporan.ts.
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  lt,
  lte,
  min,
  or,
  sql,
} from "drizzle-orm";

import { labaKotor } from "@/domain/harga-modal";
import { laba } from "@/domain/laba";

import { db } from "./db";
import {
  biayaOperasional,
  kategori,
  pesanan,
  produk,
  varian,
} from "./db/schema";
import { rentangTanggalWib } from "./zona-waktu-toko";

/** Jumlah Pesanan di satu halaman tabel (PRD §14.8). */
const UKURAN_HALAMAN = 50;

/**
 * Saringan Laporan keuangan (PRD §14.6). Tanggal berbentuk "YYYY-MM-DD" dan dibaca dalam WIB, keduanya ikut
 * dihitung. Kategori dan Produk yang tidak diberikan berarti "Semua".
 */
type SaringanLaporan = {
  dari: string;
  sampai: string;
  kategoriId?: string;
  produkId?: string;
};

/** Rentang instan saringan: dari 00.00.00 WIB tanggal `dari` sampai sebelum 00.00.00 WIB sesudah `sampai`. */
function rentangSaringan({ dari, sampai }: SaringanLaporan) {
  const { mulai, sebelum } = rentangTanggalWib({ dari, sampai });
  if (mulai === undefined || sebelum === undefined) {
    throw new Error("Rentang Laporan keuangan harus punya dua tanggal.");
  }
  return { mulai, sebelum };
}

/**
 * Syarat Kategori dan Produk (PRD §14.6). Kategori sebuah Pesanan adalah Kategori Produknya saat ini, jadi
 * Pesanan dari Produk yang dipindah Kategori ikut pindah ke Kategori barunya.
 */
const syaratKatalog = ({ kategoriId, produkId }: SaringanLaporan) => [
  kategoriId === undefined ? undefined : eq(produk.kategoriId, kategoriId),
  produkId === undefined ? undefined : eq(produk.id, produkId),
];

/**
 * Rincian angka Laporan keuangan (PRD §14.5, §14.6): Pendapatan, Pesanan Selesai, Total Harga modal, Laba kotor,
 * potongan voucher, Kode unik, Biaya transaksi, Biaya operasional, dan Laba bersih dalam saringan itu, dihitung
 * fungsi domain laba. Saat saringan Kategori atau Produk aktif, Biaya operasional tidak dikurangkan (nilainya
 * null). Database hanya memilih Pesanan yang dibayar dalam rentang itu dan Biaya operasional bertanggal dalam
 * rentang itu; yang memutuskan Pesanan mana yang dihitung adalah domain.
 */
export async function rincianLaporan(saringan: SaringanLaporan) {
  const rentang = rentangSaringan(saringan);
  const denganBiayaOperasional =
    saringan.kategoriId === undefined && saringan.produkId === undefined;
  const [dibayar, biaya] = await Promise.all([
    db
      .select({
        status: pesanan.status,
        dibayarPada: pesanan.waktuBayar,
        hargaJual: pesanan.hargaJual,
        potonganVoucher: pesanan.potonganVoucher,
        kodeUnik: pesanan.kodeUnik,
        totalBayar: pesanan.totalBayar,
        hargaModal: pesanan.hargaModal,
        biayaTransaksi: pesanan.biayaTransaksi,
      })
      .from(pesanan)
      .innerJoin(varian, eq(pesanan.varianId, varian.id))
      .innerJoin(produk, eq(varian.produkId, produk.id))
      .where(
        and(
          gte(pesanan.waktuBayar, rentang.mulai),
          lt(pesanan.waktuBayar, rentang.sebelum),
          ...syaratKatalog(saringan),
        ),
      ),
    db
      .select({
        id: biayaOperasional.id,
        tanggal: biayaOperasional.tanggal,
        nominal: biayaOperasional.nominal,
      })
      .from(biayaOperasional)
      .where(
        and(
          gte(biayaOperasional.tanggal, saringan.dari),
          lte(biayaOperasional.tanggal, saringan.sampai),
        ),
      ),
  ]);
  return laba({
    rentang,
    denganBiayaOperasional,
    pesanan: dibayar,
    biayaOperasional: biaya,
  });
}

/**
 * Syarat pencarian tabel (PRD §14.8, sama seperti daftar Pesanan §9.5): email atau Nomor Pesanan memuat kata cari
 * itu, tanpa membedakan huruf besar dan kecil dan tanpa spasi di ujungnya. strpos dipakai, bukan LIKE, supaya `%`
 * dan `_` dicocokkan sebagai huruf biasa.
 */
function cocokPencarian(cari: string) {
  const kata = cari.trim();
  return or(
    sql`strpos(lower(${pesanan.email}), lower(${kata})) > 0`,
    sql`strpos(lower(${pesanan.nomorPesanan}), lower(${kata})) > 0`,
  );
}

/**
 * Satu halaman tabel Pesanan Selesai Laporan keuangan (PRD §14.8): Pesanan Selesai yang dibayar dalam saringan
 * itu, yang terbaru dibayar di atas, 50 per halaman, beserta jumlah semua Pesanan yang cocok dan jumlah
 * halamannya. `cari` hanya menyaring tabel ini. Laba kotor setiap Pesanan dihitung domain, dan null bila Pesanan
 * itu belum punya Harga modal. Tabel tanpa Pesanan tetap punya satu halaman.
 */
export async function tabelPesananLaporan(
  saringan: SaringanLaporan & { cari?: string; halaman?: number },
) {
  const halaman = saringan.halaman ?? 1;
  const rentang = rentangSaringan(saringan);
  const cocok = and(
    eq(pesanan.status, "Selesai"),
    gte(pesanan.waktuBayar, rentang.mulai),
    lt(pesanan.waktuBayar, rentang.sebelum),
    ...syaratKatalog(saringan),
    saringan.cari === undefined ? undefined : cocokPencarian(saringan.cari),
  );
  const [{ jumlah }] = await db
    .select({ jumlah: count() })
    .from(pesanan)
    .innerJoin(varian, eq(pesanan.varianId, varian.id))
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .where(cocok);

  const baris = await db
    .select({
      nomorPesanan: pesanan.nomorPesanan,
      waktuBayar: pesanan.waktuBayar,
      namaProduk: produk.nama,
      namaVarian: varian.nama,
      hargaJual: pesanan.hargaJual,
      hargaModal: pesanan.hargaModal,
      potonganVoucher: pesanan.potonganVoucher,
      kodeUnik: pesanan.kodeUnik,
      biayaTransaksi: pesanan.biayaTransaksi,
      totalBayar: pesanan.totalBayar,
    })
    .from(pesanan)
    .innerJoin(varian, eq(pesanan.varianId, varian.id))
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .where(cocok)
    .orderBy(desc(pesanan.waktuBayar), desc(pesanan.nomorPesanan))
    .limit(UKURAN_HALAMAN)
    .offset((halaman - 1) * UKURAN_HALAMAN);

  return {
    pesanan: baris.map((p) => ({ ...p, labaKotor: labaKotor(p).labaKotor })),
    jumlah,
    halaman,
    jumlahHalaman: Math.max(1, Math.ceil(jumlah / UKURAN_HALAMAN)),
  };
}

/**
 * Pilihan saringan Kategori dan Produk (PRD §14.6), masing-masing urut nama A sampai Z. Pilihan Produk memuat
 * Produk nonaktif, karena Pesanan lamanya tetap tercatat, dan membawa Kategori-nya supaya pilihan Produk bisa
 * dibatasi ke Kategori yang dipilih.
 */
export async function pilihanSaringanLaporan() {
  const [semuaKategori, semuaProduk] = await Promise.all([
    db
      .select({ id: kategori.id, nama: kategori.nama })
      .from(kategori)
      .orderBy(asc(sql`lower(${kategori.nama})`)),
    db
      .select({
        id: produk.id,
        nama: produk.nama,
        kategoriId: produk.kategoriId,
        aktif: produk.aktif,
      })
      .from(produk)
      .orderBy(asc(sql`lower(${produk.nama})`)),
  ]);
  return { kategori: semuaKategori, produk: semuaProduk };
}

/**
 * Waktu bayar Pesanan Selesai pertama, untuk rentang awal periode Tahunan (PRD §14.6), atau null bila belum ada
 * Pesanan Selesai.
 */
export async function waktuBayarPesananSelesaiPertama() {
  const [{ waktu }] = await db
    .select({ waktu: min(pesanan.waktuBayar) })
    .from(pesanan)
    .where(and(eq(pesanan.status, "Selesai"), isNotNull(pesanan.waktuBayar)));
  return waktu;
}
