// Tanda di alamat Riwayat saldo setelah Halaman bayar Top up berpindah sendiri karena Top up-nya Berhasil (PRD §15.3).
// Isinya Nomor Top up itu. Selama tanda ini ada dan Top up itu Berhasil milik Member yang login, Riwayat saldo
// menampilkan pesan "Top up Rp X berhasil. Saldo sekarang Rp Y."
export const PARAMETER_TOP_UP_BERHASIL = "top-up";

/** Alamat Riwayat saldo dengan pesan Top up Berhasil untuk Top up itu. */
export const alamatTopUpBerhasil = (nomorTopUp: string) =>
  `/akun/riwayat-saldo?${new URLSearchParams({ [PARAMETER_TOP_UP_BERHASIL]: nomorTopUp })}`;
