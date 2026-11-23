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
 * Pendapatan satu Pesanan: Harga jual − potongan voucher, yaitu uang Pesanan itu yang masuk saldo toko (PRD §5.5 dan
 * §9.3 ▶ Keputusan 2026-11-23). Kode unik tidak dihitung, karena dibayar Pembeli tetapi tidak masuk saldo toko.
 */
export function pendapatanPesanan({
  hargaJual,
  potonganVoucher,
}: {
  hargaJual: number;
  potonganVoucher: number;
}) {
  return hargaJual - potonganVoucher;
}

/**
 * Pendapatan dalam rentang itu: jumlah Pendapatan Pesanan Selesai yang dibayar dalam rentang itu, yaitu jumlah
 * (Harga jual − potongan voucher) (PRD §9.3 ▶ Keputusan 2026-11-23, tests/golden/pendapatan-tanpa-kode-unik.json).
 * Kode unik tidak dihitung dan biaya Qrispy tidak dipotong. Rentang null berarti sepanjang waktu. Hasilnya membawa
 * rentang dan Pesanan yang dihitung sebagai bahan hitungnya.
 */
export function pendapatan<
  P extends PesananDibayar & { hargaJual: number; potonganVoucher: number },
>({
  rentang,
  pesanan,
}: {
  rentang: RentangWaktu | null;
  pesanan: readonly P[];
}) {
  const dihitung = pesananSelesaiDibayar({ rentang, pesanan });
  return {
    pendapatan: dihitung.reduce(
      (jumlah, p) => jumlah + pendapatanPesanan(p),
      0,
    ),
    rentang,
    dihitung,
  };
}
