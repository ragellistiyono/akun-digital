// Pembatalan Pesanan oleh Pembeli (PRD §5.8, ADR-0004). Pesanan yang boleh dibatalkan ditentukan
// perpindahanStatusPesanan di src/domain/status-pesanan.ts.
import type { StatusPesanan } from "./status-pesanan";

/** Status pembayaran QRIS menurut Qrispy (docs/referensi/qrispy-api.md bagian 4). */
type StatusPembayaranQris = "pending" | "paid" | "expired" | "cancelled";

/**
 * Jawaban Qrispy atas permintaan pembatalan QRIS. Bila Qrispy menolak, `statusQris` adalah status QRIS
 * itu sesudahnya, atau null bila statusnya juga tidak bisa ditanyakan.
 */
type JawabanPembatalanQris =
  | { pembatalanQris: "diterima" }
  | { pembatalanQris: "ditolak"; statusQris: StatusPembayaranQris | null };

/**
 * Akibat permintaan pembatalan sebuah Pesanan Menunggu Pembayaran (PRD §5.8, ADR-0004):
 * - Qrispy menerima pembatalan QRIS-nya: Pesanan menjadi Dibatalkan;
 * - Qrispy menolak dan status QRIS `paid`: Pesanan diproses sebagai sudah dibayar;
 * - Qrispy menolak dan status QRIS `cancelled` atau `expired`: Pesanan menjadi Dibatalkan;
 * - selain itu, termasuk status yang tidak bisa ditanyakan: pembatalan gagal, Pembeli melihat pesan
 *   gagal, dan Pesanan tetap Menunggu Pembayaran.
 */
export function hasilPembatalanPesanan(jawaban: JawabanPembatalanQris): {
  akibat: "dibatalkan" | "diproses-sebagai-dibayar" | "gagal";
} {
  if (jawaban.pembatalanQris === "diterima") return { akibat: "dibatalkan" };
  switch (jawaban.statusQris) {
    case "paid":
      return { akibat: "diproses-sebagai-dibayar" };
    case "cancelled":
    case "expired":
      return { akibat: "dibatalkan" };
    default:
      return { akibat: "gagal" };
  }
}

/**
 * Hasil "Batalkan" yang mengembalikan Pembeli ke Tautan Pesanan. Untuk Pesanan yang tidak bisa dibatalkan,
 * `status` adalah Status Pesanan saat pembatalannya diproses.
 */
type PembatalanDiproses =
  | { hasil: "dibatalkan" }
  | { hasil: "diproses-sebagai-dibayar" }
  | { hasil: "tidak-bisa-dibatalkan"; status: StatusPesanan };

/**
 * Apakah pesan "Pembayaran Anda sudah masuk, jadi Pesanan tidak dibatalkan." tampil tepat setelah Pembeli
 * menekan "Batalkan" (PRD §5.8, ▶ Keputusan 2026-11-12 #87 dan #99). Pesan itu tampil bila pembatalannya
 * diproses sebagai sudah dibayar, atau bila Pesanan sudah Selesai saat pembatalannya diproses. Pesanan
 * yang Dibatalkan, dan Pesanan yang sudah berstatus lain, termasuk Bermasalah, tampil tanpa pesan itu.
 */
export function pesanSudahDibayarTampil(pembatalan: PembatalanDiproses) {
  switch (pembatalan.hasil) {
    case "diproses-sebagai-dibayar":
      return true;
    case "tidak-bisa-dibatalkan":
      return pembatalan.status === "Selesai";
    case "dibatalkan":
      return false;
  }
}
