// Bayar Pesanan dengan saldo (PRD §15.7) dan Metode sebuah Pesanan (GLOSSARY).

/**
 * Metode sebuah Pesanan (GLOSSARY): QRIS atau Saldo, atau Gratis untuk Pesanan gratis (PRD §16.5). Pesanan yang dibuat
 * sebelum bayar dengan saldo ada bermetode QRIS.
 */
export const METODE = ["QRIS", "Saldo", "Gratis"] as const;

export type Metode = (typeof METODE)[number];

/** Kode unik dan Biaya transaksi Pesanan yang dibayar dengan saldo (PRD §15.7, §15.8). */
const TANPA_KODE_UNIK_DAN_BIAYA = 0;

/**
 * Bayar dengan saldo (PRD §15.7):
 * - yang harus dibayar = Harga jual − potongan voucher, tanpa Kode unik dan tanpa Biaya transaksi. Inilah Total bayar
 *   Pesanan itu;
 * - saldo cukup bila saldo sama dengan atau lebih dari yang harus dibayar;
 * - `kurang` adalah selisihnya bila saldo tidak cukup, untuk "Saldo kurang Rp X. Top up dulu.", dan 0 bila cukup;
 * - pilihan awal di Checkout adalah Saldo bila cukup, dan QRIS bila tidak;
 * - `saldoSesudah` adalah saldo setelah Pesanan dibuat dengan saldo, atau null bila saldo tidak cukup, karena saldo
 *   tidak pernah negatif (PRD §15.1).
 *
 * Hasilnya membawa saldo, Harga jual, dan potongan voucher sebagai bahan hitungnya.
 */
export function bayarSaldo({
  saldo,
  hargaJual,
  potonganVoucher,
}: {
  saldo: number;
  hargaJual: number;
  potonganVoucher: number;
}) {
  const harusDibayar = hargaJual - potonganVoucher;
  const saldoCukup = saldo >= harusDibayar;
  const pilihanAwal: Metode = saldoCukup ? "Saldo" : "QRIS";
  return {
    saldo,
    hargaJual,
    potonganVoucher,
    harusDibayar,
    saldoCukup,
    kurang: saldoCukup ? 0 : harusDibayar - saldo,
    pilihanAwal,
    saldoSesudah: saldoCukup ? saldo - harusDibayar : null,
    kodeUnik: TANPA_KODE_UNIK_DAN_BIAYA,
    biayaTransaksi: TANPA_KODE_UNIK_DAN_BIAYA,
  };
}

/** Hasil bayarSaldo. */
export type BayarSaldo = ReturnType<typeof bayarSaldo>;
