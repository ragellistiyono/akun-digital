// Item stok yang sudah Terkirim ke sebuah Pesanan: kapan tampil (PRD §6.1) dan dengan nama kolom apa
// (PRD §4.1).
import type { StatusPesanan } from "./status-pesanan";

/** Satu kolom Item stok yang tampil: nama kolom Format Item stok dan isinya. */
type KolomItemStok = { nama: string; nilai: string };

/**
 * Apakah Item stok sebuah Pesanan tampil (PRD §6.1). Hanya Pesanan Selesai yang Item stoknya tampil;
 * untuk status lain Item stok tidak pernah tampil.
 */
export function itemStokTampil(statusPesanan: StatusPesanan) {
  return statusPesanan === "Selesai";
}

/**
 * Kolom-kolom sebuah Item stok Terkirim, menurut urutan Format Item stok. Setiap isi kolom tampil dengan
 * nama kolom yang dicatat saat Item stok itu Terkirim, bukan nama kolom Format Item stok yang berlaku
 * sekarang (PRD §4.1). Melempar galat bila jumlah nama kolom dan isi kolom tidak sama, karena Format
 * Item stok tidak bisa ditambah atau dikurangi kolomnya selama Item stok itu Tersedia atau Ditahan.
 */
export function kolomItemStokTerkirim({
  formatSaatTerkirim,
  nilai,
}: {
  formatSaatTerkirim: readonly string[];
  nilai: readonly string[];
}): KolomItemStok[] {
  if (formatSaatTerkirim.length !== nilai.length) {
    throw new Error(
      `Item stok Terkirim punya ${formatSaatTerkirim.length} nama kolom tetapi ${nilai.length} isi kolom, padahal jumlahnya selalu sama (PRD §4.1). Periksa nama kolom yang dicatat saat Item stok itu Terkirim (item_stok.format_saat_terkirim) terhadap isinya.`,
    );
  }
  return formatSaatTerkirim.map((nama, i) => ({ nama, nilai: nilai[i] }));
}
