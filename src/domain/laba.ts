// Total Harga modal, Laba kotor, dan Laba bersih dalam suatu rentang (PRD §9.2, §14.2, §14.5, §15.8).
import type { Metode } from "./bayar-saldo";
import { labaKotor } from "./harga-modal";
import { jumlahPesananSelesai } from "./jumlah-pesanan-selesai";
import { pendapatan } from "./pendapatan";
import {
  awalTanggalToko,
  dalamRentang,
  type RentangWaktu,
} from "./rentang-waktu-toko";
import type { StatusPesanan } from "./status-pesanan";
import type { StatusTopUp } from "./status-top-up";

type PesananLaba = {
  metode: Metode;
  status: StatusPesanan;
  dibayarPada: Date | null;
  hargaJual: number;
  potonganVoucher: number;
  hargaModal: number | null;
  biayaTransaksi: number | null;
};

type BiayaOperasionalLaba = { tanggal: string; nominal: number };

type TopUpLaba = {
  status: StatusTopUp;
  dibayarPada: Date | null;
  nominalTopUp: number;
  biayaTransaksi: number | null;
};

/** Saringan Metode Laporan keuangan (PRD §14.6 ▶ Keputusan 2026-11-20 dan 2026-11-22): Semua, QRIS, Saldo, atau Gratis. */
export type SaringanMetode = Metode | "Semua";

/**
 * Pesanan yang cocok dengan saringan Metode, dengan urutan input (PRD §14.6 ▶ Keputusan 2026-11-20 dan 2026-11-22):
 * "Semua" memuat Pesanan QRIS, Saldo, dan Gratis, sedangkan QRIS, Saldo, atau Gratis hanya memuat Pesanan bermetode
 * itu. Saringan ini membatasi rincian angka dan semua grafik Laporan keuangan.
 */
export function pesananMenurutMetode<P extends { metode: Metode }>({
  metode,
  pesanan,
}: {
  metode: SaringanMetode;
  pesanan: readonly P[];
}): readonly P[] {
  return metode === "Semua"
    ? pesanan
    : pesanan.filter((p) => p.metode === metode);
}

const jumlahkan = <T>(daftar: readonly T[], nilai: (t: T) => number) =>
  daftar.reduce((jumlah, t) => jumlah + nilai(t), 0);

/**
 * Angka keuangan dalam rentang itu (PRD §14.2, §14.5, §15.8, tests/golden/laba-tanpa-kode-unik.json,
 * tests/golden/laba-top-up-tanpa-kode-unik.json). Rentang null berarti sepanjang waktu, tanpa batas tanggal.
 *
 * - Hanya Pesanan yang cocok dengan saringan `metode` yang dihitung; "Semua" menghitung semua Metode (§14.6).
 *   Pesanan gratis dihitung seperti Pesanan Selesai lain, dengan nominal Rp 0 dan Harga modal Varian-nya, jadi tidak
 *   menambah Pendapatan dan Laba kotornya Rp 0 − Harga modal (§16.5).
 * - Pendapatan dan jumlah Pesanan Selesai menghitung semua Pesanan Selesai yang dibayar dalam rentang itu. Pendapatan
 *   adalah jumlah (Harga jual − potongan voucher), tanpa Kode unik (§9.3 ▶ Keputusan 2026-11-23). Pesanan saldo
 *   dihitung sama, dengan Biaya transaksi Rp 0 (§15.8).
 * - Total Harga modal, Laba kotor, potongan voucher, dan Biaya transaksi hanya dari Pesanan Selesai yang punya Harga
 *   modal (§14.2). Pesanan Selesai tanpa Harga modal dihitung di `pesananTanpaHargaModal`.
 * - Biaya operasional adalah jumlah biaya yang tanggalnya (00.00 WIB) berada dalam rentang itu.
 * - Biaya transaksi Top up dijumlahkan dari Top up Berhasil yang dibayar dalam rentang itu; `topUpBerhasil` hanya
 *   informasi: jumlah Top up itu dan jumlah Nominal top up-nya, yang bukan Pendapatan (§15.8).
 * - Bila saringan Produk atau Kategori aktif, atau `metode` bukan "Semua", Biaya operasional, Biaya transaksi Top up,
 *   dan `topUpBerhasil` null dan tidak ikut Laba bersih (§14.5 ▶ Keputusan 2026-11-20).
 * - Laba bersih = Laba kotor − potongan voucher − Biaya transaksi − Biaya operasional − Biaya transaksi Top up (§14.5
 *   ▶ Keputusan 2026-11-23). Kode unik dan Kode unik Top up tidak dihitung, karena tidak masuk saldo toko (§5.5).
 *
 * Biaya transaksi Pesanan dan Top up yang sudah dibayar selalu tercatat (§14.3, §15.5), jadi null hanya mungkin di
 * data uji dan dihitung Rp 0. Hasilnya membawa Pesanan, Biaya operasional, dan Top up yang dihitung sebagai bahan
 * hitungnya.
 */
export function laba<
  P extends PesananLaba,
  B extends BiayaOperasionalLaba,
  T extends TopUpLaba,
>({
  rentang,
  metode,
  saringanProdukAtauKategori,
  pesanan,
  biayaOperasional,
  topUp,
}: {
  rentang: RentangWaktu | null;
  metode: SaringanMetode;
  saringanProdukAtauKategori: boolean;
  pesanan: readonly P[];
  biayaOperasional: readonly B[];
  topUp: readonly T[];
}) {
  const pesananMetode = pesananMenurutMetode({ metode, pesanan });
  const selesai = pendapatan({ rentang, pesanan: pesananMetode });
  const dihitung = selesai.dihitung.filter(
    (p): p is P & { hargaModal: number } => p.hargaModal !== null,
  );
  const tanpaHargaModal = selesai.dihitung.filter((p) => p.hargaModal === null);

  const dalam = (waktu: Date) =>
    rentang === null || dalamRentang(waktu, rentang);
  const tanpaSaringan = metode === "Semua" && !saringanProdukAtauKategori;

  const biayaOperasionalDihitung = tanpaSaringan
    ? biayaOperasional.filter((b) => dalam(awalTanggalToko(b.tanggal)))
    : [];
  const topUpDihitung = tanpaSaringan
    ? topUp.filter(
        (t): t is T & { dibayarPada: Date } =>
          t.status === "Berhasil" &&
          t.dibayarPada !== null &&
          dalam(t.dibayarPada),
      )
    : [];
  const totalBiayaOperasional = tanpaSaringan
    ? jumlahkan(biayaOperasionalDihitung, (b) => b.nominal)
    : null;
  const biayaTransaksiTopUp = tanpaSaringan
    ? jumlahkan(topUpDihitung, (t) => t.biayaTransaksi ?? 0)
    : null;

  const totalLabaKotor = jumlahkan(dihitung, (p) => labaKotor(p).labaKotor);
  const potonganVoucher = jumlahkan(dihitung, (p) => p.potonganVoucher);
  const biayaTransaksi = jumlahkan(dihitung, (p) => p.biayaTransaksi ?? 0);

  return {
    pendapatan: selesai.pendapatan,
    pesananSelesai: jumlahPesananSelesai({ rentang, pesanan: pesananMetode })
      .jumlah,
    totalHargaModal: jumlahkan(dihitung, (p) => p.hargaModal),
    labaKotor: totalLabaKotor,
    potonganVoucher,
    biayaTransaksi,
    biayaOperasional: totalBiayaOperasional,
    biayaTransaksiTopUp,
    labaBersih:
      totalLabaKotor -
      potonganVoucher -
      biayaTransaksi -
      (totalBiayaOperasional ?? 0) -
      (biayaTransaksiTopUp ?? 0),
    topUpBerhasil: tanpaSaringan
      ? {
          jumlah: topUpDihitung.length,
          nominal: jumlahkan(topUpDihitung, (t) => t.nominalTopUp),
        }
      : null,
    pesananTanpaHargaModal: tanpaHargaModal.length,
    rentang,
    dihitung,
    tanpaHargaModal,
    biayaOperasionalDihitung,
    topUpDihitung,
  };
}
