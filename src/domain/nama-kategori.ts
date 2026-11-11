const namaBaku = (nama: string) => nama.trim().toLowerCase();

/**
 * Apakah nama Kategori sudah dipakai salah satu Kategori lain (PRD §3.1 ▶ Keputusan 2026-11-11).
 * Nama dibandingkan tanpa membedakan huruf besar dan kecil, dan tanpa spasi di awal atau akhir,
 * jadi "streaming" sudah dipakai bila Kategori "Streaming" ada. Kategori yang sedang diubah tidak
 * termasuk Kategori lain, jadi ia tetap bisa disimpan dengan namanya sendiri.
 */
export function namaKategoriDipakai(
  nama: string,
  namaKategoriLain: readonly string[],
): boolean {
  const dicari = namaBaku(nama);
  return namaKategoriLain.some((lain) => namaBaku(lain) === dicari);
}
