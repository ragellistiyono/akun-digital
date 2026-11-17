// Percobaan memasukkan Kode verifikasi (PRD §7.3, §7.7).

/** Banyaknya kesalahan yang membuat Kode verifikasi hangus (PRD §7.7). */
const BATAS_SALAH_KODE = 5;

/**
 * Hasil satu percobaan memasukkan Kode verifikasi yang masih berlaku, beserta hitungan salah sesudahnya.
 * - Kode yang sudah salah 5 kali hangus dan menolak semua percobaan, termasuk kode yang benar; hitungannya
 *   tidak bertambah lagi.
 * - Kode yang cocok diterima; kode yang tidak cocok menambah satu kesalahan, dan kesalahan kelima membuat
 *   kode itu hangus.
 */
export function percobaanKodeVerifikasi({
  jumlahSalahSebelumnya,
  kodeCocok,
}: {
  jumlahSalahSebelumnya: number;
  kodeCocok: boolean;
}): {
  hasil: "diterima" | "salah" | "hangus";
  jumlahSalah: number;
  hangus: boolean;
} {
  if (jumlahSalahSebelumnya >= BATAS_SALAH_KODE) {
    return {
      hasil: "hangus",
      jumlahSalah: jumlahSalahSebelumnya,
      hangus: true,
    };
  }
  if (kodeCocok) {
    return {
      hasil: "diterima",
      jumlahSalah: jumlahSalahSebelumnya,
      hangus: false,
    };
  }
  const jumlahSalah = jumlahSalahSebelumnya + 1;
  return {
    hasil: "salah",
    jumlahSalah,
    hangus: jumlahSalah >= BATAS_SALAH_KODE,
  };
}
