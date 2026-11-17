/**
 * Label baris potongan di rincian nominal sebuah Pesanan (PRD §5.5, §8.8 ▶ Keputusan 2026-11-17): Pesanan yang
 * memakai Voucher menyebut kode Voucher-nya, misalnya "Potongan voucher (HEMAT5)", dan Pesanan tanpa Voucher
 * (`kodeVoucher` null) menulis "Potongan voucher".
 */
export function labelPotonganVoucher(kodeVoucher: string | null): string {
  return kodeVoucher === null
    ? "Potongan voucher"
    : `Potongan voucher (${kodeVoucher})`;
}
