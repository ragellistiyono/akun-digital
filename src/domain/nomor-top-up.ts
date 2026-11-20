// Nomor Top up (PRD §15.3): TOPUP- diikuti 6 karakter acak dengan aturan karakter Nomor Pesanan (§9.6).
import { nomorAcak, nomorAcakSah } from "./nomor-pesanan";

const AWALAN = "TOPUP-";

/** Nomor Top up dari 6 byte acak yang dibuat lapisan server (PRD §15.3). */
export function nomorTopUp(byteAcak: Uint8Array): string {
  return nomorAcak(
    { awalan: AWALAN, nama: "Nomor Top up", fungsi: "nomorTopUp" },
    byteAcak,
  );
}

/** Apakah teks itu berbentuk Nomor Top up (PRD §15.3). */
export function nomorTopUpSah(nomor: string): boolean {
  return nomorAcakSah(AWALAN, nomor);
}

/**
 * Apakah `payment_reference` sebuah kabar pembayaran menunjuk ke Top up, yaitu diawali TOPUP- (issue T78). Toko
 * mengirim Nomor Top up sebagai `payment_reference` QRIS Top up, dan Nomor Pesanan untuk QRIS Pesanan.
 */
export function rujukanTopUp(paymentReference: string | undefined): boolean {
  return paymentReference?.startsWith(AWALAN) ?? false;
}
