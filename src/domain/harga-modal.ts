// Harga modal sebuah Varian dan Laba kotor (PRD §14.1, §14.2).

/** Harga modal terkecil, dalam rupiah. Rp 0 dipakai untuk Item stok yang didapat toko tanpa biaya (PRD §14.1). */
const HARGA_MODAL_MINIMUM = 0;

export type AlasanHargaModalDitolak =
  | "harga-modal-kosong"
  | "harga-modal-negatif"
  | "harga-modal-bukan-rupiah-bulat";

type HasilPeriksaHargaModal =
  | { valid: true; alasan: null; labaKotorPerPesanan: number }
  | {
      valid: false;
      alasan: AlasanHargaModalDitolak;
      labaKotorPerPesanan: null;
    };

const ditolak = (alasan: AlasanHargaModalDitolak): HasilPeriksaHargaModal => ({
  valid: false,
  alasan,
  labaKotorPerPesanan: null,
});

/**
 * Laba kotor sebuah Pesanan atau Varian: Harga jual − Harga modal (PRD §14.2). Hasilnya null bila Harga modal
 * belum ada, yaitu Varian lama yang belum diisi Harga modal-nya atau Pesanan yang tercatat tanpa Harga modal
 * (PRD §14.1). Laba negatif dikembalikan apa adanya. Hasilnya membawa bahan hitungnya.
 */
export function labaKotor(bahan: { hargaJual: number; hargaModal: number }): {
  labaKotor: number;
  hargaJual: number;
  hargaModal: number;
};
export function labaKotor(bahan: {
  hargaJual: number;
  hargaModal: number | null;
}): { labaKotor: number | null; hargaJual: number; hargaModal: number | null };
export function labaKotor({
  hargaJual,
  hargaModal,
}: {
  hargaJual: number;
  hargaModal: number | null;
}) {
  return {
    labaKotor: hargaModal === null ? null : hargaJual - hargaModal,
    hargaJual,
    hargaModal,
  };
}

/**
 * Memeriksa isian Harga modal di form Varian (PRD §14.1): wajib (null berarti kosong), minimal Rp 0, rupiah
 * bulat, tanpa batas maksimum, dan boleh lebih besar dari Harga jual. Harga jual hanya dipakai untuk Laba kotor
 * per Pesanan, yang null bila Harga modal ditolak. Hanya satu alasan yang dikembalikan; batasnya diperiksa
 * lebih dulu daripada sen, seperti periksaHarga.
 */
export function periksaHargaModal({
  hargaModal,
  hargaJual,
}: {
  hargaModal: number | null;
  hargaJual: number;
}): HasilPeriksaHargaModal {
  if (hargaModal === null) return ditolak("harga-modal-kosong");
  if (hargaModal < HARGA_MODAL_MINIMUM) return ditolak("harga-modal-negatif");
  if (!Number.isInteger(hargaModal)) {
    return ditolak("harga-modal-bukan-rupiah-bulat");
  }
  return {
    valid: true,
    alasan: null,
    labaKotorPerPesanan: labaKotor({ hargaJual, hargaModal }).labaKotor,
  };
}

/**
 * Harga modal yang ikut dicatat di semua Pesanan Varian itu yang belum punya Harga modal, apa pun statusnya,
 * saat Harga modal Varian disimpan (PRD §14.1). Hanya isi pertama, yaitu Varian yang sebelumnya belum punya
 * Harga modal, yang mengisi Pesanan lama. Perubahan sesudahnya hanya berlaku untuk Pesanan baru, jadi hasilnya
 * null. Rp 0 juga dihitung sebagai isi pertama.
 */
export function hargaModalIsiPertama({
  hargaModalSebelumnya,
  hargaModalBaru,
}: {
  hargaModalSebelumnya: number | null;
  hargaModalBaru: number;
}) {
  return hargaModalSebelumnya === null ? hargaModalBaru : null;
}
