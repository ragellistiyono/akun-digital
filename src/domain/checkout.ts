// Urutan pemeriksaan checkout satu Varian (PRD §5.2 ▶ Keputusan 2026-11-17 langkah 1–5 dan ▶ Keputusan 2026-11-20
// langkah 6, §3.7, §5.4 ▶ Keputusan 2026-11-12, §16). Batas Pesanan menunggu ada di batas-pesanan-menunggu.ts, email
// Member nonaktif ada di member-nonaktif.ts, Varian habis ada di stok-varian.ts, penilaian Voucher ada di
// penerapan-voucher.ts, dan kecukupan saldo ada di bayar-saldo.ts.
import type { HasilBatasPesananMenunggu } from "./batas-pesanan-menunggu";
import type { AlasanVoucherDitolak } from "./kelayakan-voucher";
import { varianHabis } from "./stok-varian";

/**
 * Hasil penilaian Voucher yang diisi Pembeli menurut penerapanVoucher: dipakai, atau ditolak dengan alasan dan
 * pesannya.
 */
type VoucherDinilai =
  | { dipakai: true }
  | { dipakai: false; alasan: AlasanVoucherDitolak; pesan: string };

type HasilCheckout<V, P> =
  | { hasil: "tidak-dijual" }
  | { hasil: "produk-gratis" }
  | { hasil: "member-nonaktif" }
  | { hasil: "pesanan-menunggu"; pesananMenunggu: P }
  | { hasil: "stok-habis" }
  | { hasil: "voucher-ditolak"; alasan: AlasanVoucherDitolak; pesan: string }
  | { hasil: "saldo-kurang"; saldo: number; harusDibayar: number }
  | { hasil: "boleh"; varianDijual: V };

/** Kecukupan saldo Member yang memilih bayar dengan saldo, menurut bayarSaldo (PRD §15.7). */
type SaldoDinilai = {
  saldo: number;
  harusDibayar: number;
  saldoCukup: boolean;
};

/**
 * Hasil checkout satu Varian. Pemeriksaannya berurutan, dan yang pertama menolak menentukan hasilnya
 * (PRD §5.2 ▶ Keputusan 2026-11-17):
 * 1. Varian atau Produk yang tidak dijual (`varianDijual` undefined) ditolak (PRD §3.7);
 *    Varian Produk gratis (`varianDijual.gratis`) juga ditolak di langkah ini, karena Produk gratis hanya bisa diambil
 *    lewat "Ambil gratis", tanpa pembayaran QRIS (PRD §16, hasilAmbilGratis);
 * 2. email milik Member nonaktif (`memberNonaktif`) ditolak (PRD §2.3), walaupun email itu masih punya
 *    Pesanan Menunggu Pembayaran;
 * 3. email yang masih punya Pesanan Menunggu Pembayaran menurut `batasPesananMenunggu` mengikuti batas
 *    Pesanan menunggu (PRD §5.4), walaupun Stok Varian-nya 0 (▶ Keputusan 2026-11-12). Hasilnya membawa
 *    Pesanan yang menghalangi itu;
 * 4. Varian dengan Stok Varian 0 ditolak karena stok habis (PRD §5.2);
 * 5. Voucher yang diisi Pembeli (`voucher`, hasil penerapanVoucher) dan ditolak menolak checkout, dan hasilnya
 *    membawa alasan dan pesan penolakannya (PRD §8.7). Alasannya membuat tampilan bisa mengenali Voucher khusus
 *    Member tanpa mencocokkan teks pesan. `voucher` null berarti kode voucher tidak diisi;
 * 6. bila Member memilih bayar dengan saldo, saldo yang kurang dari yang harus dibayar (`saldo`, hasil bayarSaldo)
 *    ditolak, dan hasilnya membawa saldo dan yang harus dibayar untuk pesan penolakannya (PRD §5.2 ▶ Keputusan
 *    2026-11-20, §15.7). `saldo` null atau tidak diisi berarti Pesanan dibayar dengan QRIS.
 *
 * Bila tidak ada yang menolak, Pesanan untuk Varian itu boleh dibuat, dengan Voucher itu bila diisi, dan hasilnya
 * membawa Varian itu.
 */
export function hasilCheckout<V extends { gratis: boolean }, P>({
  varianDijual,
  memberNonaktif,
  batasPesananMenunggu,
  stokVarian,
  voucher,
  saldo = null,
}: {
  varianDijual: V | undefined;
  memberNonaktif: boolean;
  batasPesananMenunggu: HasilBatasPesananMenunggu<P>;
  stokVarian: number;
  voucher: VoucherDinilai | null;
  saldo?: SaldoDinilai | null;
}): HasilCheckout<V, P> {
  if (varianDijual === undefined) return { hasil: "tidak-dijual" };
  if (varianDijual.gratis) return { hasil: "produk-gratis" };
  if (memberNonaktif) return { hasil: "member-nonaktif" };
  if (!batasPesananMenunggu.boleh) {
    return {
      hasil: "pesanan-menunggu",
      pesananMenunggu: batasPesananMenunggu.pesananMenunggu,
    };
  }
  if (varianHabis(stokVarian)) return { hasil: "stok-habis" };
  if (voucher !== null && !voucher.dipakai) {
    return {
      hasil: "voucher-ditolak",
      alasan: voucher.alasan,
      pesan: voucher.pesan,
    };
  }
  if (saldo !== null && !saldo.saldoCukup) {
    return {
      hasil: "saldo-kurang",
      saldo: saldo.saldo,
      harusDibayar: saldo.harusDibayar,
    };
  }
  return { hasil: "boleh", varianDijual };
}
