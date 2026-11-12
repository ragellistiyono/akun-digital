// Kapan Kategori, Produk, dan Varian boleh dihapus Admin (PRD §3.1, §3.7).
import type { StatusPesanan } from "./status-pesanan";

/**
 * Apakah sebuah Kategori boleh dihapus (PRD §3.1). Kategori yang masih berisi Produk, termasuk Produk
 * nonaktif, tidak bisa dihapus; Admin memindahkan Produknya ke Kategori lain dulu. Bila ditolak, hasilnya
 * membawa jumlah Produk di Kategori itu sebagai sebabnya.
 */
export function bolehHapusKategori({
  jumlahProdukAktif,
  jumlahProdukNonaktif,
}: {
  jumlahProdukAktif: number;
  jumlahProdukNonaktif: number;
}): { boleh: true } | { boleh: false; jumlahProduk: number } {
  const jumlahProduk = jumlahProdukAktif + jumlahProdukNonaktif;
  return jumlahProduk === 0 ? { boleh: true } : { boleh: false, jumlahProduk };
}

/**
 * Apakah sebuah Produk atau Varian boleh dihapus (PRD §3.7), menurut jumlah Pesanan per status yang
 * mencatatnya; untuk Produk, Pesanan semua Variannya. Produk atau Varian yang sudah pernah dipesan tidak
 * bisa dihapus, hanya dinonaktifkan. "Pernah dipesan" berarti tercatat di Pesanan berstatus apa pun,
 * termasuk Kedaluwarsa dan Dibatalkan, jadi Pesanan semua status dihitung. Bila ditolak, hasilnya membawa
 * jumlah Pesanan itu sebagai sebabnya.
 */
export function bolehHapusProdukAtauVarian({
  jumlahPesananPerStatus,
}: {
  jumlahPesananPerStatus: Partial<Record<StatusPesanan, number>>;
}): { boleh: true } | { boleh: false; jumlahPesanan: number } {
  const jumlahPesanan = Object.values(jumlahPesananPerStatus).reduce(
    (total, jumlah) => total + jumlah,
    0,
  );
  return jumlahPesanan === 0
    ? { boleh: true }
    : { boleh: false, jumlahPesanan };
}
