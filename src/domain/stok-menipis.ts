// Stok menipis dan Ambang stok menipis (PRD §9.4, §9.8).

/** Nilai awal Ambang stok menipis sebelum Admin mengubahnya (PRD §9.4). */
export const AMBANG_STOK_MENIPIS_AWAL = 5;

/** Ambang stok menipis terbesar yang boleh disimpan (PRD §9.4 ▶ Keputusan 2026-11-17). */
export const AMBANG_STOK_MENIPIS_MAKSIMUM = 999;

type VarianDiperiksa = {
  stokVarian: number;
  aktif: boolean;
  produkAktif: boolean;
};

/**
 * Varian yang stoknya menipis: Varian aktif dari Produk aktif yang Stok Varian-nya sama dengan atau kurang
 * dari Ambang stok menipis (PRD §9.4). Urutan Varian tidak diubah. Hasilnya membawa ambang itu sebagai bahan
 * hitungnya, dan setiap Varian membawa Stok Varian-nya.
 */
export function stokMenipis<V extends VarianDiperiksa>({
  ambang,
  varian,
}: {
  ambang: number;
  varian: readonly V[];
}) {
  return {
    ambang,
    menipis: varian.filter(
      (v) => v.aktif && v.produkAktif && v.stokVarian <= ambang,
    ),
  };
}

/**
 * Urutan tampil daftar Stok menipis: Stok Varian terkecil di atas (PRD §9.4 ▶ Keputusan 2026-11-17). Varian
 * dengan Stok Varian yang sama tetap pada urutan asalnya.
 */
export function urutkanStokMenipis<V extends { stokVarian: number }>(
  varian: readonly V[],
) {
  return varian.toSorted((a, b) => a.stokVarian - b.stokVarian);
}

export type AlasanAmbangStokMenipisDitolak =
  "bukan-bilangan-bulat" | "di-luar-rentang";

/**
 * Memeriksa Ambang stok menipis yang diisi Admin: bilangan bulat 0 sampai 999 (PRD §9.4 ▶ Keputusan
 * 2026-11-17). Isian yang bukan angka sama sekali dikirim sebagai NaN dan ditolak sebagai bukan bilangan
 * bulat. Hanya satu alasan yang dikembalikan: bukan bilangan bulat diperiksa lebih dulu.
 */
export function periksaAmbangStokMenipis({
  ambang,
}: {
  ambang: number;
}):
  | { sah: true; ambang: number; alasan: null }
  | { sah: false; alasan: AlasanAmbangStokMenipisDitolak } {
  if (!Number.isInteger(ambang)) {
    return { sah: false, alasan: "bukan-bilangan-bulat" };
  }
  if (ambang < 0 || ambang > AMBANG_STOK_MENIPIS_MAKSIMUM) {
    return { sah: false, alasan: "di-luar-rentang" };
  }
  return { sah: true, ambang, alasan: null };
}
