// Laporan keuangan di dasbor admin (PRD §14.5, §14.6, §14.8, §15.8): rincian angka dan tabel Pesanan Selesai dalam
// saringan rentang tanggal WIB, Kategori, Produk, dan Metode, serta grafik per kelompok periode, Produk terlaris, dan
// Pendapatan per Kategori (§14.7). Aturan hitungnya ada di src/domain/laba.ts, src/domain/harga-modal.ts,
// src/domain/rentang-awal-laporan.ts, src/domain/kelompok-periode-laporan.ts, src/domain/produk-terlaris.ts, dan
// src/domain/pendapatan-per-kategori.ts.
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

import type { Metode } from "@/domain/bayar-saldo";
import { labaKotor } from "@/domain/harga-modal";
import { kelompokPeriodeLaporan } from "@/domain/kelompok-periode-laporan";
import { laba, pesananMenurutMetode, type SaringanMetode } from "@/domain/laba";
import { pesananSelesaiDibayar } from "@/domain/pendapatan";
import { pendapatanPerKategori } from "@/domain/pendapatan-per-kategori";
import { produkTerlaris } from "@/domain/produk-terlaris";
import type { PeriodeLaporan } from "@/domain/rentang-awal-laporan";

import { db } from "./db";
import {
  biayaOperasional,
  kategori,
  pesanan,
  produk,
  topUp,
  varian,
} from "./db/schema";
import { rentangTanggalWib } from "./zona-waktu-toko";

/** Jumlah Pesanan di satu halaman tabel (PRD §14.8). */
const UKURAN_HALAMAN = 50;

/**
 * Saringan Laporan keuangan (PRD §14.6). Tanggal berbentuk "YYYY-MM-DD" dan dibaca dalam WIB, keduanya ikut
 * dihitung. Kategori, Produk, dan Metode yang tidak diberikan berarti "Semua".
 */
type SaringanLaporan = {
  dari: string;
  sampai: string;
  kategoriId?: string;
  produkId?: string;
  metode?: Metode;
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
 * Bahan hitung Laporan keuangan dalam saringan itu: Pesanan yang dibayar dalam rentang dan saringan Kategori atau
 * Produk, beserta Metode, Produk, dan Kategori Produk-nya saat ini, Biaya operasional bertanggal dalam rentang, Top
 * up yang dibayar dalam rentang, saringan Metode, dan apakah saringan Kategori atau Produk aktif. Yang memutuskan
 * Pesanan dan Top up mana yang dihitung, termasuk bahwa Biaya operasional dan Top up tidak dihitung saat saringan
 * aktif (PRD §14.5 ▶ Keputusan 2026-11-20), adalah fungsi domain laba.
 */
async function bahanLaporan(saringan: SaringanLaporan) {
  const rentang = rentangSaringan(saringan);
  const metode: SaringanMetode = saringan.metode ?? "Semua";
  const saringanProdukAtauKategori =
    saringan.kategoriId !== undefined || saringan.produkId !== undefined;
  const [dibayar, biaya, topUpDibayar] = await Promise.all([
    db
      .select({
        metode: pesanan.metode,
        status: pesanan.status,
        dibayarPada: pesanan.waktuBayar,
        hargaJual: pesanan.hargaJual,
        potonganVoucher: pesanan.potonganVoucher,
        kodeUnik: pesanan.kodeUnik,
        totalBayar: pesanan.totalBayar,
        hargaModal: pesanan.hargaModal,
        biayaTransaksi: pesanan.biayaTransaksi,
        produkId: produk.id,
        namaProduk: produk.nama,
        kategoriId: kategori.id,
        namaKategori: kategori.nama,
      })
      .from(pesanan)
      .innerJoin(varian, eq(pesanan.varianId, varian.id))
      .innerJoin(produk, eq(varian.produkId, produk.id))
      .innerJoin(kategori, eq(produk.kategoriId, kategori.id))
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
    db
      .select({
        status: topUp.status,
        dibayarPada: topUp.waktuBayar,
        nominalTopUp: topUp.nominalTopUp,
        kodeUnik: topUp.kodeUnik,
        biayaTransaksi: topUp.biayaTransaksi,
      })
      .from(topUp)
      .where(
        and(
          gte(topUp.waktuBayar, rentang.mulai),
          lt(topUp.waktuBayar, rentang.sebelum),
        ),
      ),
  ]);
  return {
    rentang,
    metode,
    saringanProdukAtauKategori,
    pesanan: dibayar,
    biayaOperasional: biaya,
    topUp: topUpDibayar,
  };
}

/**
 * Rincian angka Laporan keuangan (PRD §14.5, §14.6, §15.8): Pendapatan, Pesanan Selesai, Total Harga modal, Laba
 * kotor, potongan voucher, Biaya transaksi, Biaya operasional, Biaya transaksi Top up, Laba bersih, dan Top up
 * Berhasil dalam saringan itu, dihitung fungsi domain laba. Kode unik dan Kode unik Top up tidak dihitung, karena
 * tidak masuk saldo toko (§14.6 ▶ Keputusan 2026-11-23). Saat saringan Kategori, Produk, atau Metode aktif, Biaya
 * operasional, Biaya transaksi Top up, dan Top up Berhasil tidak dihitung (nilainya null).
 */
export async function rincianLaporan(saringan: SaringanLaporan) {
  return laba(await bahanLaporan(saringan));
}

/**
 * Nilai grafik per kelompok periode Laporan keuangan (PRD §14.6, §14.7) dalam saringan itu. Kelompoknya dari
 * fungsi domain kelompokPeriodeLaporan, dan angka setiap kelompok dari fungsi domain laba dengan rentang kelompok
 * itu:
 * - Pendapatan dan jumlah Pesanan Selesai (grafik 1 dan 3) menghitung semua Pesanan Selesai, termasuk yang belum
 *   punya Harga modal, dengan Pendapatan tanpa Kode unik (§9.3 ▶ Keputusan 2026-11-23);
 * - Laba kotor dan Laba bersih (grafik 2) mengikuti §14.2 dan §14.5, dengan Biaya operasional dikurangkan pada
 *   kelompok yang memuat tanggalnya, serta Biaya transaksi Top up dikurangkan pada kelompok yang memuat waktu bayar
 *   Top up-nya, kecuali saat saringan Kategori, Produk, atau Metode aktif (§14.6 ▶ Keputusan 2026-11-20). Kode unik
 *   Top up tidak ditambahkan (§14.6 ▶ Keputusan 2026-11-23).
 * Kelompok tanpa Pesanan Selesai bernilai 0.
 *
 * Grafik Produk terlaris dan Pendapatan per Kategori (grafik 4 dan 5) dihitung dari semua Pesanan Selesai dalam
 * saringan itu, termasuk saringan Metode (fungsi domain pesananMenurutMetode) dan termasuk yang belum punya Harga
 * modal, oleh fungsi domain produkTerlaris dan pendapatanPerKategori.
 */
export async function grafikLaporan(
  saringan: SaringanLaporan & { periode: PeriodeLaporan },
) {
  const bahan = await bahanLaporan(saringan);
  const selesai = pesananSelesaiDibayar({
    rentang: bahan.rentang,
    pesanan: pesananMenurutMetode(bahan),
  });
  const { kelompok } = kelompokPeriodeLaporan({
    periode: saringan.periode,
    mulai: saringan.dari,
    akhir: saringan.sampai,
  });
  return {
    periode: saringan.periode,
    kelompok: kelompok.map(({ mulai, akhir, rentang }) => {
      const angka = laba({ ...bahan, rentang });
      return {
        mulai,
        akhir,
        pendapatan: angka.pendapatan,
        pesananSelesai: angka.pesananSelesai,
        labaKotor: angka.labaKotor,
        labaBersih: angka.labaBersih,
      };
    }),
    produkTerlaris: produkTerlaris({ pesananSelesai: selesai }).terlaris.map(
      ({ produkId, namaProduk, pesananSelesai, pendapatan }) => ({
        produkId,
        namaProduk,
        pesananSelesai,
        pendapatan,
      }),
    ),
    pendapatanPerKategori: pendapatanPerKategori({
      pesananSelesai: selesai,
    }).kategori.map(
      ({ kategoriId, namaKategori, pesananSelesai, pendapatan }) => ({
        kategoriId,
        namaKategori,
        pesananSelesai,
        pendapatan,
      }),
    ),
  };
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
 * itu, termasuk saringan Metode, beserta Metode-nya (§14.6 ▶ Keputusan 2026-11-20), yang terbaru dibayar di atas, 50
 * per halaman, beserta jumlah semua Pesanan yang cocok dan jumlah halamannya. `cari` hanya menyaring tabel ini.
 * Laba kotor setiap Pesanan dihitung domain, dan null bila Pesanan itu belum punya Harga modal. Tabel tanpa Pesanan
 * tetap punya satu halaman.
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
    saringan.metode === undefined
      ? undefined
      : eq(pesanan.metode, saringan.metode),
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
      metode: pesanan.metode,
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
