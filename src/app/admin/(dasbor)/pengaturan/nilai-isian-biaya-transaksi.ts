import { angkaRupiah } from "@/lib/rupiah";
import type { PengaturanBiayaTransaksi } from "@/server/pengaturan-toko";

/**
 * Nilai isian Biaya transaksi di form Pengaturan toko dari pengaturan yang tersimpan: persen dengan koma
 * desimal dan minimal Total bayar dengan titik pemisah ribuan, misalnya "0,7" dan "100.000".
 */
export function nilaiIsianBiayaTransaksi({
  persen,
  minimalTotalBayar,
}: PengaturanBiayaTransaksi) {
  return {
    persenBiayaTransaksi: String(persen).replace(".", ","),
    minimalBiayaTransaksi: angkaRupiah(minimalTotalBayar),
  };
}
