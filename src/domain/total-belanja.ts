// Total belanja di daftar Member dasbor admin (PRD §2.3).
import { emailSama } from "./kesamaan-email";
import { pendapatanPesanan, selesaiDibayar } from "./pendapatan";
import type { StatusPesanan } from "./status-pesanan";

type PesananMember = {
  status: StatusPesanan;
  dibayarPada: Date | null;
  hargaJual: number;
  potonganVoucher: number;
  email: string;
};

/**
 * Total belanja dan jumlah Pesanan Selesai seorang Member (PRD §2.3). Total belanja dihitung seperti
 * Pendapatan (§9.3 ▶ Keputusan 2026-11-23), tetapi tanpa batas waktu dan hanya dari Pesanan yang emailnya sama dengan
 * email Member (§7.4): jumlah (Harga jual − potongan voucher) Pesanan Selesai yang sudah dibayar, tanpa Kode unik.
 * Pesanan Bermasalah, Dana Dikembalikan, dan Pesanan yang belum dibayar tidak dihitung. Jumlah Pesanan Selesai
 * menghitung Pesanan yang sama, dan hasilnya membawa Pesanan itu sebagai bahan hitungnya, dengan urutan input.
 */
export function totalBelanja<P extends PesananMember>({
  emailMember,
  pesanan,
}: {
  emailMember: string;
  pesanan: readonly P[];
}) {
  const dihitung = pesanan.filter(
    (p) => emailSama(p.email, emailMember) && selesaiDibayar(p),
  );
  return {
    totalBelanja: dihitung.reduce(
      (jumlah, p) => jumlah + pendapatanPesanan(p),
      0,
    ),
    jumlahPesananSelesai: dihitung.length,
    dihitung,
  };
}
