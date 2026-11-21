// Pesan sekali tampil di Riwayat saldo setelah Top up (PRD §15.3 ▶ Keputusan 2026-11-21, issue 240):
// - "berhasil": Halaman bayar Top up berpindah sendiri karena pembayarannya masuk, jadi Riwayat saldo menampilkan
//   "Top up Rp X berhasil. Saldo sekarang Rp Y.";
// - "sudah-dibayar": "Batalkan" tidak membatalkan Top up karena Top up itu Berhasil, jadi Riwayat saldo menampilkan
//   "Pembayaran Anda sudah masuk, jadi Top up tidak dibatalkan." sebagai ganti pesan berhasil.
//
// Pesan itu dibawa cookie berumur pendek berisi jenis pesan dan Nomor Top up-nya, bukan tanda di alamat. Riwayat saldo
// menghapus cookie itu begitu halamannya tampil, jadi Riwayat saldo yang dimuat ulang atau dibuka lagi, termasuk dari
// riwayat browser, tidak menampilkan pesan itu lagi.
export const JENIS_PESAN_TOP_UP = ["berhasil", "sudah-dibayar"] as const;

type JenisPesanTopUp = (typeof JENIS_PESAN_TOP_UP)[number];

export const PESAN_TOP_UP = {
  nama: "pesan-top-up",
  path: "/akun/riwayat-saldo",
} as const;

/** Umur cookie pesan: cukup untuk satu perpindahan ke Riwayat saldo. */
const UMUR_DETIK = 60;

/** Bagian cookies() dari next/headers yang dipakai untuk memasang pesan. */
type TokoCookie = {
  set(
    nama: string,
    nilai: string,
    opsi: { path: string; maxAge: number; sameSite: "lax" },
  ): unknown;
};

/** Memasang pesan sekali tampil untuk Top up itu, yang dibaca Riwayat saldo berikutnya. */
export function pasangPesanTopUp(
  cookie: TokoCookie,
  jenis: JenisPesanTopUp,
  nomorTopUp: string,
) {
  cookie.set(PESAN_TOP_UP.nama, `${jenis}:${nomorTopUp}`, {
    path: PESAN_TOP_UP.path,
    maxAge: UMUR_DETIK,
    sameSite: "lax",
  });
}
