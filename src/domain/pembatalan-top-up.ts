// Pembatalan Top up oleh Member (PRD §15.3, mengikuti §5.8). Top up yang boleh dibatalkan ditentukan
// perpindahanStatusTopUp di src/domain/status-top-up.ts, dan akibat jawaban Qrispy ditentukan hasilPembatalanPesanan di
// src/domain/pembatalan-pesanan.ts.
import type { StatusTopUp } from "./status-top-up";

/**
 * Hasil "Batalkan" untuk sebuah Top up. Untuk Top up yang tidak dibatalkan, `status` adalah Status Top up sesudah
 * pembatalannya diproses: setelah diproses sebagai sudah dibayar, atau status yang sudah ada saat itu.
 */
type PembatalanTopUpDiproses =
  | { hasil: "dibatalkan" }
  | { hasil: "sudah-dibayar" | "tidak-bisa-dibatalkan"; status: StatusTopUp };

/**
 * Apakah pesan "Pembayaran Anda sudah masuk, jadi Top up tidak dibatalkan." tampil di Riwayat saldo tepat setelah
 * Member menekan "Batalkan" (PRD §15.3 ▶ Keputusan 2026-11-21, issue 240). Pesan itu tampil bila Top up itu Berhasil,
 * baik karena pembatalannya ditolak Qrispy lalu diproses sebagai sudah dibayar, maupun karena Top up sudah Berhasil
 * saat pembatalannya diproses. Top up yang menjadi atau sudah Bermasalah, Top up berstatus lain, dan Top up yang
 * Dibatalkan tampil tanpa pesan itu.
 */
export function pesanSudahDibayarTopUpTampil(
  pembatalan: PembatalanTopUpDiproses,
) {
  return pembatalan.hasil !== "dibatalkan" && pembatalan.status === "Berhasil";
}
