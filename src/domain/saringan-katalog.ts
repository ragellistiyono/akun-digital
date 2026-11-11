// Kategori yang tampil di toko (PRD §3.1), serta pencarian dan saringan Produk di Beranda (PRD §3.6).

/** Produk di katalog sebagai bahan saringan: nama dan Kategori-nya. */
type ProdukSaringan = { nama: string; kategoriId: string };

/**
 * Produk Beranda yang cocok dengan pencarian dan saringan Kategori (PRD §3.6).
 * - Pencarian mencocokkan bagian nama Produk tanpa membedakan huruf besar dan kecil. Spasi di awal dan
 *   akhir kata cari diabaikan, dan kata cari kosong berarti tidak mencari.
 * - Saringan Kategori hanya menyisakan Produk di Kategori itu. Tanpa saringan (null), semua Produk ikut.
 * - Bila keduanya dipakai, Produk harus cocok dengan keduanya.
 *
 * Urutan masukan dipertahankan.
 */
export function saringProdukBeranda<P extends ProdukSaringan>({
  produk,
  kataCari,
  kategoriId,
}: {
  produk: readonly P[];
  kataCari: string;
  kategoriId: string | null;
}): P[] {
  const kata = kataCari.trim().toLowerCase();
  return produk.filter(
    (p) =>
      (kategoriId === null || p.kategoriId === kategoriId) &&
      p.nama.toLowerCase().includes(kata),
  );
}

/**
 * Kategori yang tampil di toko (PRD §3.1): Kategori yang berisi setidaknya satu Produk yang tampil di
 * katalog, yaitu Produk aktif dengan setidaknya satu Varian aktif. Kategori yang hanya berisi Produk
 * nonaktif, atau tanpa Produk, tidak tampil. Urutan masukan dipertahankan.
 */
export function kategoriTampil<K extends { id: string }>({
  kategori,
  produkTampil,
}: {
  kategori: readonly K[];
  produkTampil: readonly Pick<ProdukSaringan, "kategoriId">[];
}): K[] {
  const berisi = new Set(produkTampil.map((p) => p.kategoriId));
  return kategori.filter((k) => berisi.has(k.id));
}
