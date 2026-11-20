// Pemeriksaan signature webhook Qrispy dan penerusan kabar pembayarannya ke pemroses Pesanan atau Top up (ADR-0004,
// docs/referensi/qrispy-api.md bagian 6).
import { createHmac, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";

import { rujukanTopUp } from "@/domain/nomor-top-up";

import { db } from "./db";
import { topUp } from "./db/schema";
import {
  type KabarPembayaran,
  prosesKabarPembayaran,
} from "./kabar-pembayaran";
import { prosesKabarPembayaranTopUp } from "./kabar-pembayaran-top-up";

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

/** Apakah ada Top up dengan QRIS itu. */
async function qrisTopUp(qrisId: string) {
  const [ada] = await db
    .select({ id: topUp.id })
    .from(topUp)
    .where(eq(topUp.qrisId, qrisId));
  return ada !== undefined;
}

/**
 * Meneruskan kabar pembayaran dari webhook ke pemrosesnya (issue T78). Kabar untuk Top up dikenali dari awalan TOPUP-
 * pada `payment_reference`, atau dari qris_id-nya bila `payment_reference` tidak ada atau bukan Nomor Top up, lalu
 * diproses prosesKabarPembayaranTopUp. Kabar lain diproses prosesKabarPembayaran untuk Pesanan.
 */
export async function teruskanKabarWebhook({
  paymentReference,
  ...kabar
}: KabarPembayaran & { paymentReference?: string }) {
  const untukTopUp =
    rujukanTopUp(paymentReference) || (await qrisTopUp(kabar.qrisId));
  return untukTopUp
    ? prosesKabarPembayaranTopUp(kabar)
    : prosesKabarPembayaran(kabar);
}
