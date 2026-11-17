// PRD §7.6 ▶ Keputusan 2026-11-17: bila password lama salah 5 kali berturut-turut di form ganti
// password, ganti password untuk Member itu dikunci 15 menit sejak kesalahan kelima, walaupun password
// lamanya kemudian benar. Ganti password yang berhasil mengembalikan hitungan ke 0, dan setelah 15 menit
// itu lewat hitungan juga mulai lagi dari 0. Hitungan ini terpisah dari batas salah password login
// (§7.7, `batas-login.ts`): kunci ini tidak memengaruhi login.
export const BATAS_SALAH_PASSWORD_LAMA = 5;
export const LAMA_KUNCI_GANTI_PASSWORD_MENIT = 15;

type KeadaanBatasGantiPassword = {
  jumlahSalah: number;
  terkunciSampai: Date | null;
};

type HasilPercobaanGantiPassword = {
  hasil: "berhasil" | "salah" | "terkunci";
  keadaanBaru: KeadaanBatasGantiPassword;
};

/**
 * Menilai satu percobaan ganti password untuk satu Member. Selama kunci berlaku, ganti password ditolak
 * walaupun password lamanya benar, dan keadaannya tidak berubah. Tepat saat kunci berakhir, ganti
 * password sudah boleh.
 */
export function percobaanGantiPassword({
  keadaan,
  sekarang,
  passwordLamaBenar,
}: {
  keadaan: KeadaanBatasGantiPassword;
  sekarang: Date;
  passwordLamaBenar: boolean;
}): HasilPercobaanGantiPassword {
  const { terkunciSampai } = keadaan;
  if (
    terkunciSampai !== null &&
    sekarang.getTime() < terkunciSampai.getTime()
  ) {
    return { hasil: "terkunci", keadaanBaru: keadaan };
  }

  if (passwordLamaBenar) {
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
        jumlahSalah >= BATAS_SALAH_PASSWORD_LAMA
          ? new Date(
              sekarang.getTime() + LAMA_KUNCI_GANTI_PASSWORD_MENIT * 60 * 1000,
            )
          : null,
    },
  };
}
