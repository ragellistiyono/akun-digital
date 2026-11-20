// Admin menyelesaikan Top up Bermasalah (PRD §15.4, §15.9). Perpindahan status yang boleh ada di
// src/domain/status-top-up.ts.
import { perpindahanStatusTopUp, type StatusTopUp } from "./status-top-up";

/**
 * Cara Admin menyelesaikan Top up Bermasalah (PRD §15.9):
 * - `tambahkan-ke-saldo`: saldo Member bertambah sebesar Nominal top up, lalu Top up menjadi Berhasil;
 * - `dana-dikembalikan`: uangnya sudah dikembalikan di luar sistem, lalu Top up menjadi Dana Dikembalikan tanpa
 *   mengubah saldo.
 */
export const CARA_PENYELESAIAN_TOP_UP = [
  "tambahkan-ke-saldo",
  "dana-dikembalikan",
] as const;

export type CaraPenyelesaianTopUp = (typeof CARA_PENYELESAIAN_TOP_UP)[number];

/** Status tujuan setiap cara penyelesaian (PRD §15.4). */
const STATUS_TUJUAN: Record<CaraPenyelesaianTopUp, StatusTopUp> = {
  "tambahkan-ke-saldo": "Berhasil",
  "dana-dikembalikan": "Dana Dikembalikan",
};

/**
 * Apakah Admin bisa menyelesaikan Top up berstatus itu (PRD §15.4, §15.9). Hanya Top up Bermasalah yang diselesaikan
 * Admin; untuk status lain, "Tambahkan ke saldo" dan "Dana Dikembalikan" tidak tersedia.
 */
export function penyelesaianTopUpBermasalahTersedia(statusTopUp: StatusTopUp) {
  return statusTopUp === "Bermasalah";
}

/**
 * Hasil Admin menyelesaikan sebuah Top up dengan cara itu (PRD §15.4, §15.9).
 *
 * - Top up selain Bermasalah, atau yang perpindahannya ke status tujuan tidak boleh, tidak diubah.
 * - "Tambahkan ke saldo" menjadikan Top up Berhasil dan menambah saldo sebesar Nominal top up, karena saldo bertambah
 *   tepat satu kali saat Top up menjadi Berhasil (PRD §15.4).
 * - "Dana Dikembalikan" menjadikan Top up Dana Dikembalikan, dan saldo tidak berubah.
 */
export function hasilPenyelesaianTopUpBermasalah({
  statusTopUp,
  cara,
  nominalTopUp,
}: {
  statusTopUp: StatusTopUp;
  cara: CaraPenyelesaianTopUp;
  nominalTopUp: number;
}):
  | { hasil: "tidak-tersedia" }
  | { hasil: "diselesaikan"; statusBaru: StatusTopUp; saldoBertambah: number } {
  const statusBaru = STATUS_TUJUAN[cara];
  if (
    !penyelesaianTopUpBermasalahTersedia(statusTopUp) ||
    !perpindahanStatusTopUp({ dari: statusTopUp, ke: statusBaru }).boleh
  ) {
    return { hasil: "tidak-tersedia" };
  }
  return {
    hasil: "diselesaikan",
    statusBaru,
    saldoBertambah: statusBaru === "Berhasil" ? nominalTopUp : 0,
  };
}
