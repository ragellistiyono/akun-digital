// Kartu angka di Ringkasan dasbor admin (PRD §9.2 ▶ Keputusan 2026-11-20, §9.3, §14.2, §14.5, §15.8). Aturannya ada
// di src/domain/laba.ts, src/domain/rentang-waktu-toko.ts, src/domain/member-aktif.ts, dan
// src/domain/jumlah-item-stok.ts.
import { count, eq, isNotNull } from "drizzle-orm";

import {
  jumlahItemStokTerkirim,
  jumlahItemStokTersedia,
} from "@/domain/jumlah-item-stok";
import { laba } from "@/domain/laba";
import {
  jumlahMemberAktif,
  jumlahMemberTerdaftar,
  totalSaldoMember,
} from "@/domain/member-aktif";
import { rentangWaktuToko } from "@/domain/rentang-waktu-toko";

import { db } from "./db";
import {
  biayaOperasional,
  itemStok,
  pesanan,
  produk,
  topUp,
  user,
  varian,
} from "./db/schema";

/**
 * Pendapatan, Pesanan Selesai, Total Harga modal, Laba kotor, dan Laba bersih hari ini, bulan ini, dan sepanjang
 * waktu menurut Zona waktu toko, untuk instan `sekarang` (PRD §9.1, §9.2 ▶ Keputusan 2026-11-20). Laba bersih
 * mengurangkan Biaya operasional bertanggal hari ini, bulan ini, atau semua biaya, lalu menambahkan Kode unik Top
 * up dan mengurangkan Biaya transaksi Top up dari Top up Berhasil yang dibayar dalam rentang itu (§9.2 ▶ Keputusan
 * 2026-11-20, §15.8). Setiap rentang membawa Pesanan, Biaya operasional, dan Top up yang dihitung sebagai
 * bahan hitungnya.
 *
 * Sepanjang waktu memuat semua Pesanan dan Top up yang sudah dibayar dan semua Biaya operasional, jadi ketiganya
 * dibaca sekali lalu dihitung untuk ketiga rentang. Waktu "sekarang" bisa diganti untuk test.
 */
export async function angkaRingkasan({
  sekarang = new Date(),
}: { sekarang?: Date } = {}) {
  const { hariIni, bulanIni } = rentangWaktuToko({ sekarang });
  const [dibayar, semuaBiaya, topUpDibayar] = await Promise.all([
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
      })
      .from(pesanan)
      .where(isNotNull(pesanan.waktuBayar)),
    db
      .select({
        id: biayaOperasional.id,
        tanggal: biayaOperasional.tanggal,
        nominal: biayaOperasional.nominal,
      })
      .from(biayaOperasional),
    db
      .select({
        id: topUp.id,
        status: topUp.status,
        dibayarPada: topUp.waktuBayar,
        nominalTopUp: topUp.nominalTopUp,
        kodeUnik: topUp.kodeUnik,
        totalBayar: topUp.totalBayar,
        biayaTransaksi: topUp.biayaTransaksi,
      })
      .from(topUp)
      .where(isNotNull(topUp.waktuBayar)),
  ]);

  const labaDalam = (rentang: typeof hariIni | null) =>
    laba({
      rentang,
      metode: "Semua",
      saringanProdukAtauKategori: false,
      pesanan: dibayar,
      biayaOperasional: semuaBiaya,
      topUp: topUpDibayar,
    });
  return {
    hariIni: labaDalam(hariIni),
    bulanIni: labaDalam(bulanIni),
    sepanjangWaktu: labaDalam(null),
  };
}

/**
 * Jumlah Pesanan yang berstatus Menunggu Pembayaran saat ini (PRD §9.2 ▶ Keputusan 2026-11-20, kartu 6). Hasilnya
 * membawa id Pesanan yang dihitung sebagai bahan hitungnya.
 */
export async function jumlahPesananMenungguPembayaran() {
  const dihitung = await db
    .select({ id: pesanan.id })
    .from(pesanan)
    .where(eq(pesanan.status, "Menunggu Pembayaran"));
  return { jumlah: dihitung.length, dihitung };
}

/**
 * Jumlah Top up yang berstatus Bermasalah saat ini (PRD §9.2 ▶ Keputusan 2026-11-20, kartu 10, §15.4). Hasilnya
 * membawa id Top up yang dihitung sebagai bahan hitungnya.
 */
export async function jumlahTopUpBermasalah() {
  const dihitung = await db
    .select({ id: topUp.id })
    .from(topUp)
    .where(eq(topUp.status, "Bermasalah"));
  return { jumlah: dihitung.length, dihitung };
}

/**
 * Jumlah Member aktif dan Member terdaftar untuk kartu Member aktif (PRD §2.3 ▶ Keputusan 2026-11-17, §9.2
 * ▶ Keputusan 2026-11-20). Yang dibaca hanya baris user berperan Member, sama seperti daftar Member, jadi
 * Pendaftar (tabel pendaftar) dan Admin tidak ikut; yang memutuskan Member mana yang dihitung adalah domain
 * (ADR-0002). Hasilnya membawa Member yang dihitung, berupa email dan status nonaktifnya, sebagai bahan hitungnya.
 */
export async function angkaMemberAktif() {
  const semuaMember = await db
    .select({ email: user.email, nonaktif: user.nonaktif })
    .from(user)
    .where(eq(user.peran, "Member"));
  return {
    ...jumlahMemberAktif({ semuaMember }),
    terdaftar: jumlahMemberTerdaftar({ semuaMember }),
  };
}

/**
 * Jumlah Item stok Tersedia dan Item stok Terkirim untuk kartu 9 dan 10 (PRD §9.2 ▶ Keputusan 2026-11-20).
 * Database hanya menjumlah Item stok per Varian dan status; yang memutuskan kelompok mana yang dihitung adalah
 * domain. Setiap kelompok membawa id Varian-nya sebagai bahan hitungnya.
 */
export async function angkaItemStok() {
  const kelompok = await db
    .select({
      varianId: varian.id,
      varianAktif: varian.aktif,
      produkAktif: produk.aktif,
      status: itemStok.status,
      jumlah: count(itemStok.id),
    })
    .from(itemStok)
    .innerJoin(varian, eq(itemStok.varianId, varian.id))
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .groupBy(varian.id, produk.id, itemStok.status);
  return {
    tersedia: jumlahItemStokTersedia({ kelompok }),
    terkirim: jumlahItemStokTerkirim({ kelompok }),
  };
}

/**
 * Total saldo Member untuk kartu 9 (PRD §9.2 ▶ Keputusan 2026-11-20): jumlah saldo semua Member saat ini,
 * aktif maupun nonaktif. Yang dibaca hanya baris user berperan Member, sama seperti daftar Member, jadi Pendaftar
 * dan Admin tidak ikut; jumlahnya dihitung domain. Hasilnya membawa Member yang dihitung, berupa email dan saldonya,
 * sebagai bahan hitungnya.
 */
export async function angkaTotalSaldoMember() {
  const semuaMember = await db
    .select({ email: user.email, saldo: user.saldo })
    .from(user)
    .where(eq(user.peran, "Member"));
  return totalSaldoMember({ semuaMember });
}
