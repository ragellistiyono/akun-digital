// PRD §7.7: bila password salah 5 kali berturut-turut untuk satu email, email itu tidak bisa login
// selama 15 menit sejak kesalahan kelima. Login yang berhasil mengembalikan hitungan kesalahan ke 0,
// dan setelah 15 menit itu lewat hitungan juga mulai lagi dari 0. Berlaku untuk Member dan Admin.
export const BATAS_SALAH_PASSWORD = 5;
export const LAMA_KUNCI_LOGIN_MENIT = 15;

type KeadaanBatasLogin = {
  jumlahSalah: number;
  terkunciSampai: Date | null;
};

type HasilPercobaanLogin = {
  hasil: "berhasil" | "salah" | "terkunci";
  keadaanBaru: KeadaanBatasLogin;
};

/**
 * Menilai satu percobaan login untuk satu email. Selama kunci berlaku, login ditolak walaupun
 * password-nya benar, dan keadaannya tidak berubah. Tepat saat kunci berakhir, login sudah boleh.
 */
export function percobaanLogin({
  keadaan,
  sekarang,
  passwordBenar,
}: {
  keadaan: KeadaanBatasLogin;
  sekarang: Date;
  passwordBenar: boolean;
}): HasilPercobaanLogin {
  const { terkunciSampai } = keadaan;
  if (
    terkunciSampai !== null &&
    sekarang.getTime() < terkunciSampai.getTime()
  ) {
    return { hasil: "terkunci", keadaanBaru: keadaan };
  }

  if (passwordBenar) {
    return {
      hasil: "berhasil",
      keadaanBaru: { jumlahSalah: 0, terkunciSampai: null },
    };
  }

  // Kunci yang sudah berakhir mengembalikan hitungan ke 0 sebelum kesalahan ini dihitung.
  const jumlahSalah = (terkunciSampai === null ? keadaan.jumlahSalah : 0) + 1;
  return {
    hasil: "salah",
    keadaanBaru: {
      jumlahSalah,
      terkunciSampai:
        jumlahSalah >= BATAS_SALAH_PASSWORD
          ? new Date(sekarang.getTime() + LAMA_KUNCI_LOGIN_MENIT * 60 * 1000)
          : null,
    },
  };
}
