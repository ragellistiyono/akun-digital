// Urutan pemeriksaan checkout satu Varian (PRD §3.7, §5.2, §5.4 ▶ Keputusan 2026-11-12). Batas Pesanan
// menunggu ada di batas-pesanan-menunggu.ts, dan Varian habis ada di stok-varian.ts.
import type { HasilBatasPesananMenunggu } from "./batas-pesanan-menunggu";
import { varianHabis } from "./stok-varian";

export type HasilCheckout<V, P> =
  | { hasil: "tidak-dijual" }
  | { hasil: "pesanan-menunggu"; pesananMenunggu: P }
  | { hasil: "stok-habis" }
  | { hasil: "boleh"; varianDijual: V };

/**
 * Hasil checkout satu Varian. Pemeriksaannya berurutan, dan yang pertama menolak menentukan hasilnya:
 * 1. Varian atau Produk yang tidak dijual (`varianDijual` undefined) ditolak (PRD §3.7);
 * 2. email yang masih punya Pesanan Menunggu Pembayaran menurut `batasPesananMenunggu` mengikuti batas
 *    Pesanan menunggu (PRD §5.4), walaupun Stok Varian-nya 0 (▶ Keputusan 2026-11-12). Hasilnya membawa
 *    Pesanan yang menghalangi itu;
 * 3. Varian dengan Stok Varian 0 ditolak karena stok habis (PRD §5.2).
 *
 * Bila tidak ada yang menolak, Pesanan untuk Varian itu boleh dibuat, dan hasilnya membawa Varian itu.
 */
export function hasilCheckout<V, P>({
  varianDijual,
  batasPesananMenunggu,
  stokVarian,
}: {
  varianDijual: V | undefined;
  batasPesananMenunggu: HasilBatasPesananMenunggu<P>;
  stokVarian: number;
}): HasilCheckout<V, P> {
  if (varianDijual === undefined) return { hasil: "tidak-dijual" };
  if (!batasPesananMenunggu.boleh) {
    return {
      hasil: "pesanan-menunggu",
      pesananMenunggu: batasPesananMenunggu.pesananMenunggu,
    };
  }
  if (varianHabis(stokVarian)) return { hasil: "stok-habis" };
  return { hasil: "boleh", varianDijual };
}
