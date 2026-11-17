// Total belanja di daftar Member dasbor admin (PRD §2.3).
import { emailSama } from "./kesamaan-email";
import { selesaiDibayar } from "./pendapatan";
import type { StatusPesanan } from "./status-pesanan";

type PesananMember = {
  status: StatusPesanan;
  dibayarPada: Date | null;
  totalBayar: number;
  email: string;
};

/**
 * Total belanja dan jumlah Pesanan Selesai seorang Member (PRD §2.3). Total belanja dihitung seperti
 * Pendapatan (§9.3), tetapi tanpa batas waktu dan hanya dari Pesanan yang emailnya sama dengan email Member
 * (§7.4): jumlah Total bayar Pesanan Selesai yang sudah dibayar, termasuk Kode unik. Pesanan Bermasalah, Dana
 * Dikembalikan, dan Pesanan yang belum dibayar tidak dihitung. Jumlah Pesanan Selesai menghitung Pesanan yang
 * sama, dan hasilnya membawa Pesanan itu sebagai bahan hitungnya, dengan urutan input.
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
    totalBelanja: dihitung.reduce((jumlah, p) => jumlah + p.totalBayar, 0),
    jumlahPesananSelesai: dihitung.length,
    dihitung,
  };
}
