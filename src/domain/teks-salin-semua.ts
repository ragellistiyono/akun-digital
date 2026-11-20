// Teks yang disalin tombol "Salin semua" di Halaman Pesanan Selesai (PRD §6.1 ▶ Keputusan 2026-11-20).

/**
 * Teks seluruh Item stok untuk tombol "Salin semua": satu baris "Nama kolom: isi" untuk setiap kolom,
 * menurut urutan kolom yang diberikan, dipisah baris baru tanpa baris baru di akhir. Kolom Item stok
 * Terkirim diambil dari kolomItemStokTerkirim, jadi nama kolomnya adalah nama saat Item stok itu Terkirim
 * (PRD §4.1).
 */
export function teksSalinSemua(
  kolom: readonly { nama: string; nilai: string }[],
) {
  return kolom.map(({ nama, nilai }) => `${nama}: ${nilai}`).join("\n");
}
