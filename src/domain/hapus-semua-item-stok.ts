// Hapus semua Item stok Tersedia sebuah Varian (PRD §4.4 ▶ Keputusan 2026-11-22), yang ditegaskan lewat Modal
// penegasan (PRD §9.10).
import type { StatusItemStok } from "./item-stok";

/**
 * Tombol "Hapus semua Item stok Tersedia" di daftar Item stok halaman Varian dan teks Modal penegasannya, dari
 * jumlah Item stok Varian itu per status saat modal dibuka.
 *
 * - Tombol hanya tampil bila Varian itu punya Item stok Tersedia.
 * - Teksnya "Hapus N Item stok Tersedia dari <Produk> – <Varian>? M Ditahan dan K Terkirim tidak ikut terhapus.
 *   Isinya tidak bisa dikembalikan." Kalimat "… tidak ikut terhapus." hanya menyebut status yang jumlahnya lebih
 *   dari 0, Ditahan dulu lalu Terkirim, dan tidak tampil bila keduanya 0.
 *
 * Hasilnya membawa jumlah per status itu sebagai bahan teksnya.
 */
export function penegasanHapusSemuaItemStokTersedia({
  produk,
  varian,
  jumlahPerStatus,
}: {
  produk: string;
  varian: string;
  jumlahPerStatus: Record<StatusItemStok, number>;
}):
  | { tombolTampil: false; jumlahPerStatus: Record<StatusItemStok, number> }
  | {
      tombolTampil: true;
      teksPenegasan: string;
      jumlahPerStatus: Record<StatusItemStok, number>;
    } {
  if (jumlahPerStatus.Tersedia <= 0) {
    return { tombolTampil: false, jumlahPerStatus };
  }
  const tidakTerhapus = (["Ditahan", "Terkirim"] as const)
    .filter((status) => jumlahPerStatus[status] > 0)
    .map((status) => `${jumlahPerStatus[status]} ${status}`);
  const kalimat = [
    `Hapus ${jumlahPerStatus.Tersedia} Item stok Tersedia dari ${produk} – ${varian}?`,
    ...(tidakTerhapus.length > 0
      ? [`${tidakTerhapus.join(" dan ")} tidak ikut terhapus.`]
      : []),
    "Isinya tidak bisa dikembalikan.",
  ];
  return {
    tombolTampil: true,
    teksPenegasan: kalimat.join(" "),
    jumlahPerStatus,
  };
}

/**
 * Pesan sesudah penegasan disetujui, dengan jumlah Item stok yang benar-benar terhapus. Item stok yang menjadi
 * Ditahan setelah modal terbuka dilewati, jadi jumlahnya bisa lebih kecil dari jumlah di teks penegasan.
 */
export function pesanItemStokTerhapus(jumlahTerhapus: number) {
  return `${jumlahTerhapus} Item stok terhapus.`;
}
