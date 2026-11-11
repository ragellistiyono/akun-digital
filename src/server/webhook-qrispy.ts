// Pemeriksaan signature webhook Qrispy (ADR-0004, docs/referensi/qrispy-api.md bagian 6).
import { createHmac, timingSafeEqual } from "node:crypto";

/** Apakah dua teks sama, dibandingkan dengan waktu tetap setelah panjangnya dicek sama. */
function samaPersis(a: string, b: string) {
  const bitA = Buffer.from(a);
  const bitB = Buffer.from(b);
  return bitA.length === bitB.length && timingSafeEqual(bitA, bitB);
}

/**
 * Apakah signature itu cocok dengan HMAC-SHA256 dari body mentah, dengan QRISPY_WEBHOOK_SECRET sebagai
 * kunci. Selama format signature Qrispy belum dipastikan, digest dalam hex maupun base64 diterima
 * (ADR-0004). Signature yang tidak ada tidak pernah cocok.
 *
 * QRISPY_WEBHOOK_SECRET dibaca saat dipakai, supaya `next build` tidak membutuhkannya. Bila kosong, siapa
 * pun bisa membuat signature dengan kunci kosong, jadi pemeriksaan dihentikan dengan error.
 */
export function signatureWebhookCocok(body: string, signature: string | null) {
  const secret = process.env.QRISPY_WEBHOOK_SECRET ?? "";
  if (secret.trim() === "") {
    throw new Error(
      "QRISPY_WEBHOOK_SECRET kosong, jadi signature webhook Qrispy tidak bisa diperiksa dan kabar pembayarannya tidak diproses. Isi QRISPY_WEBHOOK_SECRET di berkas .env dengan secret dari Dashboard Qrispy → Webhook Settings, lalu jalankan ulang aplikasinya.",
    );
  }
  if (signature === null) return false;
  const digest = createHmac("sha256", secret).update(body).digest();
  return [digest.toString("hex"), digest.toString("base64")].some((bentuk) =>
    samaPersis(signature, bentuk),
  );
}
