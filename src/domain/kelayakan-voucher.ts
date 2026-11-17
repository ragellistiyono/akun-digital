// Syarat Voucher dan pesan penolakannya (PRD §8.1, §8.4, §8.5, §8.7).
import type { CakupanVoucher } from "./isian-voucher";
import { kodeBaku } from "./kode-voucher";
import { rupiah } from "./rupiah";

const SATU_MENIT_MS = 60 * 1000;

/**
 * Alasan sebuah Voucher ditolak, urut seperti pesan penolakan PRD §8.7. Alasan "tanpa-potongan" paling bawah
 * (§8.3 ▶ Keputusan 2026-11-17) dan diputuskan penerapanVoucher, bukan kelayakanVoucher.
 */
export type AlasanVoucherDitolak =
  | "kode-tidak-ditemukan"
  | "belum-berlaku"
  | "sudah-berakhir"
  | "kuota-habis"
  | "sudah-dipakai-email-ini"
  | "di-bawah-minimal-harga-jual"
  | "di-luar-cakupan"
  | "khusus-member"
  | "tanpa-potongan";

/** Pesan penolakan yang dilihat Pembeli untuk setiap alasan selain minimal Harga jual (PRD §8.3, §8.7). */
export const PESAN_VOUCHER_DITOLAK: Record<
  Exclude<AlasanVoucherDitolak, "di-bawah-minimal-harga-jual">,
  string
> = {
  "kode-tidak-ditemukan": "Kode voucher tidak ditemukan",
  "belum-berlaku": "Voucher belum berlaku",
  "sudah-berakhir": "Voucher sudah berakhir",
  "kuota-habis": "Kuota voucher habis",
  "sudah-dipakai-email-ini": "Anda sudah memakai voucher ini",
  "di-luar-cakupan": "Voucher tidak berlaku untuk produk ini",
  "khusus-member": "Voucher khusus Member, silakan login",
  "tanpa-potongan": "Voucher tidak memberi potongan untuk produk ini",
};

/**
 * Voucher yang ditolak beserta pesannya. Penolakan karena minimal Harga jual membawa minimal Harga jual itu
 * sebagai bahan pesannya.
 */
export type PenolakanVoucher =
  | {
      diterima: false;
      alasan: Exclude<AlasanVoucherDitolak, "di-bawah-minimal-harga-jual">;
      pesan: string;
    }
  | {
      diterima: false;
      alasan: "di-bawah-minimal-harga-jual";
      minimalHargaJual: number;
      pesan: string;
    };

type HasilKelayakanVoucher =
  { diterima: true; alasan: null; pesan: null } | PenolakanVoucher;

/** Syarat sebuah Voucher yang diatur Admin (PRD §8.4). `null` berarti syarat itu tidak diisi atau tanpa batas. */
type SyaratVoucherDinilai = {
  kode: string;
  aktif: boolean;
  mulai: Date | null;
  berakhir: Date | null;
  kuotaVoucher: number | null;
  batasPerEmail: number | null;
  minimalHargaJual: number | null;
  cakupan: CakupanVoucher;
  khususMember: boolean;
};

/**
 * Satu checkout: kode yang diketik Pembeli, waktu checkout, apakah Pembeli login sebagai Member, serta Produk,
 * Kategori Produk, dan Harga jual Varian pada saat checkout.
 */
type CheckoutDinilai = {
  kodeDiketik: string;
  waktu: Date;
  member: boolean;
  produk: string;
  kategori: string;
  hargaJual: number;
};

const ditolak = (
  alasan: Exclude<AlasanVoucherDitolak, "di-bawah-minimal-harga-jual">,
): PenolakanVoucher => ({
  diterima: false,
  alasan,
  pesan: PESAN_VOUCHER_DITOLAK[alasan],
});

/** Apakah Produk checkout ada di Cakupan voucher. Cakupan Kategori memakai Kategori Produk saat checkout. */
function dalamCakupan(cakupan: CakupanVoucher, checkout: CheckoutDinilai) {
  if (cakupan.jenis === "semua") return true;
  const dicari =
    cakupan.jenis === "produk" ? checkout.produk : checkout.kategori;
  return cakupan.daftar.includes(dicari);
}

/**
 * Apakah Voucher itu boleh dipakai untuk satu checkout menurut syaratnya (PRD §8.4), atau pesan penolakannya
 * (PRD §8.7). `voucher` null berarti tidak ada Voucher dengan kode itu. `pemakaian` adalah hasil
 * pemakaianVoucher (PRD §8.5); `olehEmail` null berarti email checkout masih kosong, dan Batas per email tidak
 * diperiksa (PRD §8.7 ▶ Keputusan 2026-11-17).
 *
 * Syarat diperiksa menurut urutan pesan di §8.7, dan alasan pertama yang gagal dikembalikan:
 * 1. kode ada, sama dengan kode yang diketik tanpa membedakan huruf besar dan kecil, dan Voucher aktif;
 * 2. waktu checkout tidak lebih awal dari waktu mulai, dan tidak melewati menit berakhir;
 * 3. pemakaian total di bawah Kuota voucher;
 * 4. pemakaian oleh email itu di bawah Batas per email;
 * 5. Harga jual tidak di bawah minimal Harga jual;
 * 6. Produk ada di Cakupan voucher;
 * 7. Pembeli login sebagai Member, bila Voucher khusus Member.
 */
export function kelayakanVoucher({
  voucher,
  checkout,
  pemakaian,
}: {
  voucher: SyaratVoucherDinilai | null;
  checkout: CheckoutDinilai;
  pemakaian: { total: number; olehEmail: number | null };
}): HasilKelayakanVoucher {
  if (
    voucher === null ||
    !voucher.aktif ||
    kodeBaku(voucher.kode) !== kodeBaku(checkout.kodeDiketik)
  ) {
    return ditolak("kode-tidak-ditemukan");
  }

  const waktu = checkout.waktu.getTime();
  if (voucher.mulai !== null && waktu < voucher.mulai.getTime()) {
    return ditolak("belum-berlaku");
  }
  if (voucher.berakhir !== null) {
    // Waktu berakhir diisi sampai menit, dan menit itu masih termasuk masa berlaku.
    const awalMenitBerakhir =
      Math.floor(voucher.berakhir.getTime() / SATU_MENIT_MS) * SATU_MENIT_MS;
    if (waktu >= awalMenitBerakhir + SATU_MENIT_MS) {
      return ditolak("sudah-berakhir");
    }
  }

  if (
    voucher.kuotaVoucher !== null &&
    pemakaian.total >= voucher.kuotaVoucher
  ) {
    return ditolak("kuota-habis");
  }
  if (
    voucher.batasPerEmail !== null &&
    pemakaian.olehEmail !== null &&
    pemakaian.olehEmail >= voucher.batasPerEmail
  ) {
    return ditolak("sudah-dipakai-email-ini");
  }

  if (
    voucher.minimalHargaJual !== null &&
    checkout.hargaJual < voucher.minimalHargaJual
  ) {
    return {
      diterima: false,
      alasan: "di-bawah-minimal-harga-jual",
      minimalHargaJual: voucher.minimalHargaJual,
      pesan: `Minimal pembelian ${rupiah(voucher.minimalHargaJual)}`,
    };
  }

  if (!dalamCakupan(voucher.cakupan, checkout)) {
    return ditolak("di-luar-cakupan");
  }

  if (voucher.khususMember && !checkout.member) {
    return ditolak("khusus-member");
  }

  return { diterima: true, alasan: null, pesan: null };
}
