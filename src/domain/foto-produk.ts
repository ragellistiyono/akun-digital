// Foto Produk (PRD §3.3): daftar foto berurutan milik satu Produk. Setiap foto dikenali dari namanya,
// misalnya nama berkas di folder unggahan.

/** Jumlah foto terbanyak untuk satu Produk (PRD §3.3). */
export const BATAS_FOTO_PRODUK = 5;

type HasilTambahFoto =
  | { sah: true; foto: string[] }
  | { sah: false; alasan: "melebihi-batas"; batas: number };

/**
 * Menambah satu foto di urutan terakhir. Ditolak bila Produk sudah punya 5 foto, jadi foto keenam
 * tidak pernah masuk (PRD §3.3).
 */
export function tambahFoto(
  foto: readonly string[],
  baru: string,
): HasilTambahFoto {
  if (foto.length >= BATAS_FOTO_PRODUK) {
    return { sah: false, alasan: "melebihi-batas", batas: BATAS_FOTO_PRODUK };
  }
  return { sah: true, foto: [...foto, baru] };
}

type HasilPindahkanFoto =
  | { sah: true; foto: string[] }
  | { sah: false; alasan: "foto-tidak-ada" | "urutan-di-luar" };

/**
 * Memindahkan satu foto ke urutan baru (dihitung dari 1). Foto lain bergeser satu urutan tanpa
 * berubah urutan di antara mereka. Foto yang dipindah ke urutan pertama menjadi sampul.
 */
export function pindahkanFoto(
  foto: readonly string[],
  nama: string,
  urutanBaru: number,
): HasilPindahkanFoto {
  const indeks = foto.indexOf(nama);
  if (indeks === -1) return { sah: false, alasan: "foto-tidak-ada" };
  if (
    !Number.isInteger(urutanBaru) ||
    urutanBaru < 1 ||
    urutanBaru > foto.length
  ) {
    return { sah: false, alasan: "urutan-di-luar" };
  }

  const tanpaFoto = foto.filter((_, i) => i !== indeks);
  return {
    sah: true,
    foto: [
      ...tanpaFoto.slice(0, urutanBaru - 1),
      nama,
      ...tanpaFoto.slice(urutanBaru - 1),
    ],
  };
}

/**
 * Menghapus satu foto. Foto sesudahnya maju satu urutan, jadi bila foto pertama dihapus, foto
 * berikutnya menjadi sampul.
 */
export function hapusFoto(
  foto: readonly string[],
  nama: string,
): { sah: true; foto: string[] } | { sah: false; alasan: "foto-tidak-ada" } {
  if (!foto.includes(nama)) return { sah: false, alasan: "foto-tidak-ada" };
  return { sah: true, foto: foto.filter((f) => f !== nama) };
}

/** Foto sampul Produk, yaitu foto di urutan pertama, atau null bila Produk belum punya foto (PRD §3.3). */
export function fotoSampul(foto: readonly string[]): string | null {
  return foto[0] ?? null;
}
