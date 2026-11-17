// Menghitung potongan voucher (PRD §8.2, §8.3).
import type { JenisPotongan } from "./isian-voucher";
import { HARGA_JUAL_MINIMUM } from "./validasi-harga";

/**
 * Harga jual dikurangi potongan voucher tidak pernah kurang dari nilai ini, supaya tidak ada Pesanan gratis
 * (PRD §8.3). Nilainya sama dengan Harga jual terkecil.
 */
const HARGA_SETELAH_POTONGAN_MINIMUM = HARGA_JUAL_MINIMUM;

/** Jenis potongan Voucher beserta nilainya (PRD §8.2). Batas maksimum hanya untuk jenis persen. */
export type PotonganVoucherDiatur = {
  jenisPotongan: JenisPotongan;
  nilai: number;
  batasMaksimum: number | null;
};

/**
 * Potongan voucher sebuah Voucher untuk Harga jual itu (PRD §8.3).
 *
 * 1. Potongan dasar: nilai nominalnya untuk jenis nominal tetap, atau Harga jual × persen ÷ 100 dibulatkan ke
 *    bawah ke rupiah untuk jenis persen, lalu diambil yang lebih kecil dengan batas maksimum bila ada.
 * 2. Potongan voucher: yang lebih kecil antara potongan dasar dan (Harga jual − Rp 1.000).
 *
 * Hasilnya membawa Harga jual dan potongan dasar sebagai bahan hitungnya.
 */
export function potonganVoucher({
  hargaJual,
  voucher: { jenisPotongan, nilai, batasMaksimum },
}: {
  hargaJual: number;
  voucher: PotonganVoucherDiatur;
}) {
  const persen = Math.floor((hargaJual * nilai) / 100);
  const potonganDasar =
    jenisPotongan === "nominal"
      ? nilai
      : batasMaksimum === null
        ? persen
        : Math.min(persen, batasMaksimum);
  const potongan = Math.min(
    potonganDasar,
    hargaJual - HARGA_SETELAH_POTONGAN_MINIMUM,
  );
  return {
    hargaJual,
    potonganDasar,
    potonganVoucher: potongan,
    hargaSetelahPotongan: hargaJual - potongan,
  };
}
