// Jeda kirim Tautan atur ulang password (PRD §7.5 ▶ Keputusan 2026-11-17), yang sama dengan jeda kirim
// ulang Kode verifikasi (PRD §7.7).
import { periksaKirimUlangKodeVerifikasi } from "./kirim-ulang-kode-verifikasi";

/**
 * Apakah Tautan atur ulang password baru boleh dikirim sekarang ke email itu. Tautan baru paling cepat
 * dikirim 60 detik setelah tautan sebelumnya; tepat 60 detik sesudahnya sudah boleh. `terakhirDikirimPada`
 * null berarti email itu belum pernah dikirimi tautan.
 */
export function periksaKirimTautanAturUlangPassword({
  terakhirDikirimPada,
  sekarang,
}: {
  terakhirDikirimPada: Date | null;
  sekarang: Date;
}): { kirim: boolean } {
  if (terakhirDikirimPada === null) return { kirim: true };
  return {
    kirim: periksaKirimUlangKodeVerifikasi({ terakhirDikirimPada, sekarang })
      .boleh,
  };
}
