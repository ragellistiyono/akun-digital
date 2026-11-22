// Pemeriksaan signature webhook Qrispy dan penerusan kabar pembayarannya ke pemroses Pesanan atau Top up (ADR-0004,
// docs/referensi/qrispy-api.md bagian 6). Sejak ▶ Keputusan 2026-11-22, webhook hanya memicu cek status
// QRIS-nya, dan nominal diterima serta waktu bayarnya diambil dari jawaban cek status.
import { createHmac, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";

import { rujukanTopUp } from "@/domain/nomor-top-up";

import { db } from "./db";
import { pesanan, topUp } from "./db/schema";
import {
  ambilGiliranCek,
  type KabarPembayaran,
  prosesKabarPembayaran,
} from "./kabar-pembayaran";
import { prosesKabarPembayaranTopUp } from "./kabar-pembayaran-top-up";
import { qrispyAktif, type StatusQris } from "./qrispy";

/** Apakah dua teks sama, dibandingkan dengan waktu tetap setelah panjangnya dicek sama. */
function samaPersis(a: string, b: string) {
  const bitA = Buffer.from(a);
  const bitB = Buffer.from(b);
  return bitA.length === bitB.length && timingSafeEqual(bitA, bitB);
}

/** Format digest yang diterima sebagai signature webhook Qrispy. */
export type FormatSignature = "hex" | "base64";

/**
 * Format signature yang cocok dengan HMAC-SHA256 dari body mentah, dengan QRISPY_WEBHOOK_SECRET sebagai
 * kunci, atau null bila tidak ada yang cocok. Selama format signature Qrispy belum dipastikan, digest dalam
 * hex maupun base64 diterima (ADR-0004); format yang cocok dicatat di log supaya format yang dipakai Qrispy
 * bisa dipastikan. Signature yang tidak ada tidak pernah cocok.
 *
 * QRISPY_WEBHOOK_SECRET dibaca saat dipakai, supaya `next build` tidak membutuhkannya. Bila kosong, siapa
 * pun bisa membuat signature dengan kunci kosong, jadi pemeriksaan dihentikan dengan error.
 */
export function formatSignatureWebhook(
  body: string,
  signature: string | null,
): FormatSignature | null {
  const secret = process.env.QRISPY_WEBHOOK_SECRET ?? "";
  if (secret.trim() === "") {
    throw new Error(
      "QRISPY_WEBHOOK_SECRET kosong, jadi signature webhook Qrispy tidak bisa diperiksa dan kabar pembayarannya tidak diproses. Isi QRISPY_WEBHOOK_SECRET di berkas .env dengan secret dari Dashboard Qrispy → Webhook Settings, lalu jalankan ulang aplikasinya.",
    );
  }
  if (signature === null) return null;
  const digest = createHmac("sha256", secret).update(body).digest();
  const cocok = (["hex", "base64"] as const).find((format) =>
    samaPersis(signature, digest.toString(format)),
  );
  return cocok ?? null;
}

/** Kabar pembayaran dari webhook `payment.received` bentuk dashboard yang sah (ADR-0004). */
type KabarWebhook = {
  qrisId: string;
  /** `payment_reference`, yang berisi Nomor Pesanan atau Nomor Top up, bila ada. */
  paymentReference?: string;
  /**
   * `received_amount` dari webhook. Nilai ini bukan nominal diterima: ia hanya dicatat di log di samping `amount` cek
   * status, supaya artinya bisa dipastikan pada pembayaran sungguhan (ADR-0004 ▶ Keputusan 2026-11-22).
   */
  receivedAmount: number;
};

/** id Top up dengan QRIS itu, atau undefined bila tidak ada. */
async function idTopUp(qrisId: string) {
  const [ada] = await db
    .select({ id: topUp.id })
    .from(topUp)
    .where(eq(topUp.qrisId, qrisId));
  return ada?.id;
}

/** id Pesanan dengan QRIS itu, atau undefined bila tidak ada. */
async function idPesanan(qrisId: string) {
  const [ada] = await db
    .select({ id: pesanan.id })
    .from(pesanan)
    .where(eq(pesanan.qrisId, qrisId));
  return ada?.id;
}

/**
 * Meneruskan kabar pembayaran dari webhook ke pemrosesnya lewat cek status (issue T78, T82; ADR-0004 ▶ Keputusan
 * 2026-11-22).
 *
 * - Kabar untuk Top up dikenali dari awalan TOPUP- pada `payment_reference`, atau dari qris_id-nya bila
 *   `payment_reference` tidak ada atau bukan Nomor Top up. Kabar lain untuk Pesanan. QRIS yang tidak dimiliki Pesanan
 *   atau Top up mana pun hanya dicatat di log, tanpa menanyakan statusnya ke Qrispy.
 * - Status QRIS itu langsung ditanyakan ke Qrispy lewat adaptor, tanpa menunggu giliran 15 detik dari jalur halaman
 *   bayar, dan cek ini tetap dicatat sebagai cek terakhir untuk Pesanan atau Top up itu.
 * - Bila jawabannya `paid`, kabar diproses prosesKabarPembayaran atau prosesKabarPembayaranTopUp dengan `amount`
 *   sebagai nominal diterima dan `paid_at` sebagai waktu bayar. Satu baris log mencatat `received_amount` dari
 *   webhook dan `amount` dari cek status, tanpa qris_id.
 * - Bila cek status gagal atau belum `paid`, tidak ada yang diubah, dan alasannya dicatat di log. Pembayarannya
 *   tertangkap lewat cek status berikutnya.
 */
export async function teruskanKabarWebhook({
  qrisId,
  paymentReference,
  receivedAmount,
}: KabarWebhook) {
  const topUpId = await idTopUp(qrisId);
  const untukTopUp = rujukanTopUp(paymentReference) || topUpId !== undefined;
  const jenis = untukTopUp ? "Top up" : "Pesanan";
  const id = untukTopUp ? topUpId : await idPesanan(qrisId);
  if (id === undefined) {
    console.error(
      `Kabar pembayaran untuk QRIS ${qrisId} diabaikan, karena tidak ada ${jenis} dengan QRIS itu.`,
    );
    return;
  }

  ambilGiliranCek(id, new Date(), { tanpaMenunggu: true });
  const tertangkapNanti = `Selama ${jenis} itu Menunggu Pembayaran, pembayarannya tertangkap lewat cek status berikutnya, paling lambat tepat sebelum ${jenis} itu dijadikan Kedaluwarsa. Bila ${jenis} itu sudah Kedaluwarsa atau Dibatalkan, periksa pembayarannya di Dashboard Qrispy.`;
  let status: StatusQris;
  try {
    status = await qrispyAktif().cekStatusQris(qrisId);
  } catch (galat) {
    console.error(
      `Webhook Qrispy dengan received_amount ${receivedAmount} memicu cek status, tetapi cek status itu gagal, jadi ${jenis} tidak diubah. ${tertangkapNanti}`,
      galat,
    );
    return;
  }
  if (status.paymentStatus !== "paid") {
    console.warn(
      `Webhook Qrispy dengan received_amount ${receivedAmount} memicu cek status, tetapi cek status menjawab ${status.paymentStatus}, jadi ${jenis} tidak diubah. ${tertangkapNanti}`,
    );
    return;
  }

  console.info(
    `Webhook Qrispy memicu cek status: received_amount ${receivedAmount} dari webhook, amount ${status.amount} dari cek status.`,
  );
  const kabar: KabarPembayaran = {
    qrisId,
    nominalDiterima: status.amount,
    waktuBayar: status.paidAt,
  };
  await (untukTopUp
    ? prosesKabarPembayaranTopUp(kabar)
    : prosesKabarPembayaran(kabar));
}
