// Tanda di alamat Tautan Pesanan setelah Pembeli menekan "Batalkan" tetapi pembatalannya diproses sebagai
// sudah dibayar, atau Pesanan itu sudah Selesai saat pembatalannya diproses (PRD §5.8, ▶ Keputusan
// 2026-11-12 #87 dan #99). Hanya selama tanda ini ada, Halaman Pesanan Selesai menampilkan pesan
// penjelasnya. Tanda ini dihapus dari alamat begitu halamannya tampil, sehingga Tautan Pesanan yang dimuat
// ulang, disalin, atau dibuka dari email tidak menampilkan pesan itu.
export const TANDA_SUDAH_DIBAYAR = {
  nama: "pembatalan",
  nilai: "sudah-dibayar",
} as const;
