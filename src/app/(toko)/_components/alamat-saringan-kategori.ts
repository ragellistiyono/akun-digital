/** Alamat Beranda dengan saringan Kategori, atau Beranda tanpa saringan bila id-nya null. */
export const alamatSaringanKategori = (id: string | null) =>
  id === null ? "/" : `/?kategori=${id}`;
