import { z } from "zod";

import { prosesKabarPembayaran } from "@/server/kabar-pembayaran";
import { signatureWebhookCocok } from "@/server/webhook-qrispy";

// Payload webhook berbentuk datar, tanpa pembungkus data (docs/referensi/qrispy-api.md bagian 6).
// Dokumentasi Qrispy hanya menjelaskan bentuk payment.success, jadi event lain cukup dikenali dari field
// event-nya, lalu diabaikan.
const Webhook = z.object({ event: z.string() });

const PaymentSuccess = z.object({
  event: z.literal("payment.success"),
  qris_id: z.string().min(1),
  amount: z.number().int().positive(),
  paid_at: z.iso.datetime({ offset: true }),
});

const BentukPaymentSuccess =
  "Kirim JSON datar tanpa pembungkus data, dengan qris_id berupa teks, amount berupa rupiah bulat lebih dari 0, dan paid_at berupa waktu ISO 8601 dengan zona waktu.";

const teks = (isi: string, status: number) =>
  new Response(isi, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

/** Menolak webhook tanpa mengubah apa pun. Alasannya juga dicatat di log server untuk pemilik. */
function tolak(isi: string, status: 400 | 401) {
  console.warn(`Webhook Qrispy dijawab ${status}: ${isi}`);
  return teks(isi, status);
}

/** Body mentah sebagai JSON, atau undefined bila bukan JSON. */
function bacaJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

// Webhook Qrispy (ADR-0004). Alamat ini didaftarkan pemilik di Dashboard Qrispy → Webhook Settings.
// Signature diperiksa dari body mentah sebelum body di-parse. Kabar payment.success diteruskan ke pemroses
// kabar pembayaran yang sama dengan jalur cek status, yang memprosesnya dalam satu transaksi dan hanya
// sekali untuk qris_id yang sama.
export async function POST(request: Request) {
  const body = await request.text();
  if (!signatureWebhookCocok(body, request.headers.get("X-Qrispy-Signature"))) {
    return tolak(
      "Header X-Qrispy-Signature tidak ada atau tidak cocok dengan HMAC-SHA256 dari body, jadi webhook ini tidak diproses. Pastikan QRISPY_WEBHOOK_SECRET di server toko sama dengan secret di Dashboard Qrispy → Webhook Settings.",
      401,
    );
  }

  const payload = bacaJson(body);
  const webhook = Webhook.safeParse(payload);
  if (!webhook.success) {
    return tolak(
      `Body webhook bukan JSON dengan field event berupa teks, jadi tidak ada yang diproses. ${BentukPaymentSuccess}`,
      400,
    );
  }
  if (webhook.data.event !== "payment.success") {
    return teks(
      `Event ${webhook.data.event} diabaikan, karena toko hanya memproses payment.success.`,
      200,
    );
  }
  const kabar = PaymentSuccess.safeParse(payload);
  if (!kabar.success) {
    return tolak(
      `Payload payment.success tidak sesuai bentuknya (${z.prettifyError(kabar.error)}), jadi tidak ada yang diproses. ${BentukPaymentSuccess}`,
      400,
    );
  }

  await prosesKabarPembayaran({
    qrisId: kabar.data.qris_id,
    nominalDiterima: kabar.data.amount,
    waktuBayar: new Date(kabar.data.paid_at),
  });
  return teks(`Kabar pembayaran QRIS ${kabar.data.qris_id} diterima.`, 200);
}
