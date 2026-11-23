// Baris rincian nominal sebuah Pesanan menurut Metode-nya (PRD §5.5, §15.7, §16.4), yang sama di Checkout, Halaman
// Pesanan, email "Pesanan selesai", dan detail Pesanan dasbor admin.
import type { Metode } from "./bayar-saldo";

/** Tulisan di bawah rincian nominal menurut Metode, atau null bila tidak ada (PRD §15.7, §16.4). */
const KETERANGAN_METODE: Record<Metode, string | null> = {
  QRIS: null,
  Saldo: "Dibayar dengan saldo",
  Gratis: "Gratis",
};

/**
 * Baris yang tampil di rincian nominal Pesanan dengan Metode itu, selain baris Total bayar yang selalu ada:
 * - QRIS: Harga jual, Potongan voucher, dan Kode unik (PRD §5.5);
 * - Saldo: Harga jual dan Potongan voucher tanpa Kode unik, lalu tulisan "Dibayar dengan saldo" (PRD §15.7);
 * - Gratis: hanya "Total bayar Rp 0", lalu tulisan "Gratis" (PRD §16.4).
 */
export function rincianNominal(metode: Metode) {
  return {
    barisHargaDanPotongan: metode !== "Gratis",
    barisKodeUnik: metode === "QRIS",
    keterangan: KETERANGAN_METODE[metode],
  };
}
