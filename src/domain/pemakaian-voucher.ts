// Menghitung pemakaian Voucher (PRD §8.5).
import { emailSama } from "./kesamaan-email";
import type { StatusPesanan } from "./status-pesanan";

/**
 * Status Pesanan yang dihitung sebagai pemakaian Voucher (PRD §8.5). Pesanan Kedaluwarsa, Dibatalkan, dan
 * Dana Dikembalikan tidak dihitung, sehingga kuotanya kembali.
 */
const STATUS_DIHITUNG: readonly StatusPesanan[] = [
  "Menunggu Pembayaran",
  "Selesai",
  "Bermasalah",
];

type PesananDenganVoucher = { email: string; status: StatusPesanan };

/**
 * Pemakaian sebuah Voucher (PRD §8.5) dari Pesanan yang memakai Voucher itu. `total` dipakai untuk Kuota
 * voucher dan daftar Voucher di dasbor admin. `olehEmail` dipakai untuk Batas per email: hanya Pesanan dengan
 * email yang sama dengan `emailCheckout` menurut §7.4 yang dihitung. Bila email checkout belum diketahui,
 * `olehEmail` null. Hasilnya membawa Pesanan yang dihitung sebagai bahan hitungnya.
 */
export function pemakaianVoucher<P extends PesananDenganVoucher>({
  emailCheckout,
  pesananDenganVoucher,
}: {
  emailCheckout: string | null;
  pesananDenganVoucher: readonly P[];
}): { total: number; olehEmail: number | null; dihitung: P[] } {
  const dihitung = pesananDenganVoucher.filter((p) =>
    STATUS_DIHITUNG.includes(p.status),
  );
  return {
    total: dihitung.length,
    olehEmail:
      emailCheckout === null
        ? null
        : dihitung.filter((p) => emailSama(p.email, emailCheckout)).length,
    dihitung,
  };
}
