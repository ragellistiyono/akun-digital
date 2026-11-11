// Satu adaptor untuk semua panggilan ke Qrispy (ADR-0004). QRISPY_MODE memilih implementasinya. Saat ini
// hanya Qrispy tiruan yang tersedia; Qrispy sungguhan menyusul di tiket tersendiri.
import { bayarQrisTiruan, qrispyTiruan } from "./qrispy-tiruan";

/**
 * QRIS yang baru diterbitkan Qrispy, dengan arti field seperti respons Qrispy
 * (docs/referensi/qrispy-api.md bagian 3).
 */
export type QrisBaru = {
  qrisId: string;
  /** Nominal yang harus dibayar Pembeli: `requested_amount` ditambah Kode unik. */
  amount: number;
  /** Nominal yang dikirim toko. */
  requestedAmount: number;
  /** Kode unik. */
  uniqueId: number;
  expiredAt: Date;
  /** Gambar QR sebagai data URL PNG (`qris_image_base64`). */
  gambarQr: string;
};

/**
 * Status pembayaran sebuah QRIS (docs/referensi/qrispy-api.md bagian 4). Bila sudah dibayar, `amount`
 * adalah nominal diterima (ADR-0004) dan `paidAt` waktu bayarnya.
 */
export type StatusQris =
  | { paymentStatus: "paid"; amount: number; paidAt: Date }
  | { paymentStatus: "pending" | "expired" | "cancelled" };

/** Antarmuka adaptor Qrispy. Setiap kegagalan, termasuk Qrispy yang menolak atau tidak menjawab, dilempar. */
export type Qrispy = {
  /** Membuat QRIS baru. `paymentReference` berisi Nomor Pesanan. */
  buatQris(masukan: {
    amount: number;
    paymentReference: string;
  }): Promise<QrisBaru>;
  /** Membatalkan QRIS yang belum dibayar. */
  batalkanQris(qrisId: string): Promise<void>;
  /** Menanyakan status pembayaran sebuah QRIS. */
  cekStatusQris(qrisId: string): Promise<StatusQris>;
};

/** Nilai QRISPY_MODE, dibaca saat dipakai. */
const modeQrispy = () => process.env.QRISPY_MODE?.trim() ?? "";

/**
 * Adaptor Qrispy menurut QRISPY_MODE. Dibaca saat dipakai, bukan saat modul dimuat, supaya `next build`
 * tidak membutuhkannya.
 */
export function qrispyAktif(): Qrispy {
  const mode = modeQrispy();
  if (mode === "tiruan") return qrispyTiruan;
  throw new Error(
    `QRISPY_MODE bernilai "${mode}", padahal saat ini hanya "tiruan" yang tersedia, jadi QRIS tidak bisa dibuat. Isi QRISPY_MODE=tiruan di berkas .env, lalu jalankan ulang aplikasinya.`,
  );
}

/**
 * Pemicu pembayaran Qrispy tiruan (ADR-0004): Pembeli tiruan membayar QRIS itu dengan nominal yang
 * diatur, termasuk nominal kurang dari Total bayar. Hanya aktif bila QRISPY_MODE=tiruan; selain itu tidak
 * ada yang dicatat.
 */
export function picuPembayaranTiruan(pembayaran: {
  qrisId: string;
  amount: number;
}) {
  if (modeQrispy() !== "tiruan") return { hasil: "tidak-aktif" } as const;
  bayarQrisTiruan(pembayaran);
  return { hasil: "dibayar" } as const;
}
