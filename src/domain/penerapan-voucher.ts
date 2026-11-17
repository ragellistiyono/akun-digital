// Hasil akhir Voucher di checkout: syarat, lalu potongan voucher (PRD §8.3, §8.7 ▶ Keputusan 2026-11-17).
import {
  PESAN_VOUCHER_DITOLAK,
  type PenolakanVoucher,
} from "./kelayakan-voucher";
import {
  potonganVoucher,
  type PotonganVoucherDiatur,
} from "./potongan-voucher";

type HasilPenerapanVoucher =
  | {
      dipakai: true;
      alasan: null;
      pesan: null;
      hargaJual: number;
      potonganVoucher: number;
      hargaSetelahPotongan: number;
    }
  | (PenolakanVoucher & { dipakai: false; potonganVoucher: 0 });

/**
 * Apakah Voucher dipakai untuk Harga jual itu, dan berapa potongan vouchernya. `kelayakan` adalah hasil
 * kelayakanVoucher. Voucher yang ditolak syaratnya tetap ditolak dengan pesan syarat itu. Voucher yang
 * syaratnya terpenuhi tetapi potongan vouchernya Rp 0 ditolak dengan "Voucher tidak memberi potongan untuk
 * produk ini", dan tidak tercatat di Pesanan (PRD §8.3 ▶ Keputusan 2026-11-17). Bila ditolak, potongan
 * vouchernya Rp 0.
 */
export function penerapanVoucher({
  hargaJual,
  voucher,
  kelayakan,
}: {
  hargaJual: number;
  voucher: PotonganVoucherDiatur;
  kelayakan: { diterima: true } | PenolakanVoucher;
}): HasilPenerapanVoucher {
  if (!kelayakan.diterima) {
    return { ...kelayakan, dipakai: false, potonganVoucher: 0 };
  }
  const potongan = potonganVoucher({ hargaJual, voucher });
  if (potongan.potonganVoucher === 0) {
    return {
      diterima: false,
      alasan: "tanpa-potongan",
      pesan: PESAN_VOUCHER_DITOLAK["tanpa-potongan"],
      dipakai: false,
      potonganVoucher: 0,
    };
  }
  return {
    dipakai: true,
    alasan: null,
    pesan: null,
    hargaJual,
    potonganVoucher: potongan.potonganVoucher,
    hargaSetelahPotongan: potongan.hargaSetelahPotongan,
  };
}
