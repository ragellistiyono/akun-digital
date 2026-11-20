// Pendapatan di Ringkasan dasbor admin (PRD §9.2, §9.3).
import { dalamRentang, type RentangWaktu } from "./rentang-waktu-toko";
import type { StatusPesanan } from "./status-pesanan";

type PesananDibayar = { status: StatusPesanan; dibayarPada: Date | null };

/**
 * Apakah Pesanan itu dihitung ke Pendapatan bila waktu bayarnya masuk rentang (PRD §9.3): Pesanan Selesai yang
 * sudah dibayar. Pesanan Bermasalah, Dana Dikembalikan, dan Pesanan yang belum dibayar tidak dihitung.
 */
export function selesaiDibayar(
  p: PesananDibayar,
): p is PesananDibayar & { dibayarPada: Date } {
  return p.status === "Selesai" && p.dibayarPada !== null;
}

/**
 * Pesanan Selesai yang dibayar dalam rentang itu, dengan urutan input (PRD §9.2 ▶ Keputusan 2026-11-17, §9.3).
 * Yang menentukan adalah waktu pembayarannya, bukan waktu Pesanan dibuat atau waktu Admin menyelesaikan
 * Pesanan Bermasalah. Pesanan Bermasalah, Dana Dikembalikan, dan Pesanan yang belum dibayar tidak termasuk.
 * Rentang null berarti sepanjang waktu, tanpa batas tanggal (PRD §9.2 ▶ Keputusan 2026-11-20).
 */
export function pesananSelesaiDibayar<P extends PesananDibayar>({
  rentang,
  pesanan,
}: {
  rentang: RentangWaktu | null;
  pesanan: readonly P[];
}) {
  return pesanan.filter(
    (p) =>
      selesaiDibayar(p) &&
      (rentang === null || dalamRentang(p.dibayarPada, rentang)),
  );
}

/**
 * Pendapatan dalam rentang itu: jumlah Total bayar Pesanan Selesai yang dibayar dalam rentang itu (PRD §9.3).
 * Kode unik ikut dihitung karena sudah termasuk Total bayar, dan biaya Qrispy tidak dipotong. Rentang null
 * berarti sepanjang waktu. Hasilnya membawa rentang dan Pesanan yang dihitung sebagai bahan hitungnya.
 */
export function pendapatan<P extends PesananDibayar & { totalBayar: number }>({
  rentang,
  pesanan,
}: {
  rentang: RentangWaktu | null;
  pesanan: readonly P[];
}) {
  const dihitung = pesananSelesaiDibayar({ rentang, pesanan });
  return {
    pendapatan: dihitung.reduce((jumlah, p) => jumlah + p.totalBayar, 0),
    rentang,
    dihitung,
  };
}
