// Urutan pemeriksaan checkout satu Varian (PRD §5.2 ▶ Keputusan 2026-11-17 langkah 1–5, §3.7, §5.4 ▶ Keputusan
// 2026-11-12). Batas Pesanan menunggu ada di batas-pesanan-menunggu.ts, email Member nonaktif ada di
// member-nonaktif.ts, Varian habis ada di stok-varian.ts, dan penilaian Voucher ada di penerapan-voucher.ts.
import type { HasilBatasPesananMenunggu } from "./batas-pesanan-menunggu";
import { varianHabis } from "./stok-varian";

/** Hasil penilaian Voucher yang diisi Pembeli menurut penerapanVoucher: dipakai, atau ditolak dengan pesannya. */
type VoucherDinilai = { dipakai: true } | { dipakai: false; pesan: string };

type HasilCheckout<V, P> =
  | { hasil: "tidak-dijual" }
  | { hasil: "member-nonaktif" }
  | { hasil: "pesanan-menunggu"; pesananMenunggu: P }
  | { hasil: "stok-habis" }
  | { hasil: "voucher-ditolak"; pesan: string }
  | { hasil: "boleh"; varianDijual: V };

/**
 * Hasil checkout satu Varian. Pemeriksaannya berurutan, dan yang pertama menolak menentukan hasilnya
 * (PRD §5.2 ▶ Keputusan 2026-11-17):
 * 1. Varian atau Produk yang tidak dijual (`varianDijual` undefined) ditolak (PRD §3.7);
 * 2. email milik Member nonaktif (`memberNonaktif`) ditolak (PRD §2.3), walaupun email itu masih punya
 *    Pesanan Menunggu Pembayaran;
 * 3. email yang masih punya Pesanan Menunggu Pembayaran menurut `batasPesananMenunggu` mengikuti batas
 *    Pesanan menunggu (PRD §5.4), walaupun Stok Varian-nya 0 (▶ Keputusan 2026-11-12). Hasilnya membawa
 *    Pesanan yang menghalangi itu;
 * 4. Varian dengan Stok Varian 0 ditolak karena stok habis (PRD §5.2);
 * 5. Voucher yang diisi Pembeli (`voucher`, hasil penerapanVoucher) dan ditolak menolak checkout, dan hasilnya
 *    membawa pesan penolakannya (PRD §8.7). `voucher` null berarti kode voucher tidak diisi.
 *
 * Bila tidak ada yang menolak, Pesanan untuk Varian itu boleh dibuat, dengan Voucher itu bila diisi, dan hasilnya
 * membawa Varian itu.
 */
export function hasilCheckout<V, P>({
  varianDijual,
  memberNonaktif,
  batasPesananMenunggu,
  stokVarian,
  voucher,
}: {
  varianDijual: V | undefined;
  memberNonaktif: boolean;
  batasPesananMenunggu: HasilBatasPesananMenunggu<P>;
  stokVarian: number;
  voucher: VoucherDinilai | null;
}): HasilCheckout<V, P> {
  if (varianDijual === undefined) return { hasil: "tidak-dijual" };
  if (memberNonaktif) return { hasil: "member-nonaktif" };
  if (!batasPesananMenunggu.boleh) {
    return {
      hasil: "pesanan-menunggu",
      pesananMenunggu: batasPesananMenunggu.pesananMenunggu,
    };
  }
  if (varianHabis(stokVarian)) return { hasil: "stok-habis" };
  if (voucher !== null && !voucher.dipakai) {
    return { hasil: "voucher-ditolak", pesan: voucher.pesan };
  }
  return { hasil: "boleh", varianDijual };
}
