// Tanda di alamat halaman Masuk setelah password baru disimpan lewat Tautan atur ulang password (PRD §7.5
// ▶ Keputusan 2026-11-17). Selama tanda ini ada, halaman Masuk menampilkan pesan di atas form.
export const TANDA_PASSWORD_DIGANTI = {
  nama: "password",
  nilai: "diganti",
} as const;

export const PESAN_PASSWORD_DIGANTI =
  "Password sudah diganti. Masuk dengan password baru.";
