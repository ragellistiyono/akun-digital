import { z } from "zod";

import { NominalQrispy } from "@/server/nominal-qrispy";
import {
  type FormatSignature,
  formatSignatureWebhook,
  teruskanKabarWebhook,
} from "@/server/webhook-qrispy";

// Kabar pembayaran hanya diterima dalam bentuk dashboard, yang terbukti dipakai Qrispy pada pembayaran
// sungguhan (ADR-0004, docs/referensi/qrispy-api.md bagian 6 dan 9). Bentuknya dikenali dari field event;
// webhook uji dan event lain dijawab 200 tanpa mengubah apa pun.
const Webhook = z.object({ event: z.string() });

/** Event kabar pembayaran dan event webhook uji dari tombol Test Webhook di Dashboard Qrispy. */
const EVENT_PEMBAYARAN = "payment.received";
const EVENT_UJI = "payment.test";

/** Nominal diterima: rupiah bulat lebih dari 0, berupa angka atau teks desimal seperti "50123.00". */
const NominalDiterima = NominalQrispy.pipe(z.number().positive());

/**
 * Bentuk dashboard: event payment.received dengan field di dalam data. Nominal diterima-nya
 * received_amount, bukan amount. payment_reference boleh tidak ada; bila berupa teks, dipakai untuk mengenali
 * kabar Top up (issue T78). Field lain di data, seperti amount dan unique_id, tidak dipakai, jadi tidak
 * diperiksa.
 */
const KabarDashboard = z
  .object({
    event: z.literal(EVENT_PEMBAYARAN),
    data: z.object({
      qris_id: z.string().min(1),
      received_amount: NominalDiterima,
      paid_at: z.iso.datetime({ offset: true }),
      payment_reference: z.string().optional().catch(undefined),
    }),
  })
  .transform(({ data }) => ({
    qrisId: data.qris_id,
    paymentReference: data.payment_reference,
    nominalDiterima: data.received_amount,
    waktuBayar: new Date(data.paid_at),
  }));

/** Nama bentuk webhook di baris log, menurut event-nya. */
function namaBentuk(event: string | undefined) {
  if (event === EVENT_PEMBAYARAN) return "dashboard";
  if (event === EVENT_UJI) return "uji";
  return "tidak dikenal";
}

const BentukDiterima =
  'Toko hanya menerima bentuk dashboard: event payment.received dengan qris_id, received_amount, dan paid_at di dalam data. qris_id berupa teks, received_amount berupa rupiah bulat lebih dari 0 dalam angka atau teks seperti "50123.00", dan paid_at berupa waktu ISO 8601 dengan zona waktu.';

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

/**
 * Baris log bentuk webhook (ADR-0004): bentuk, nama event, dan format signature yang cocok, supaya format
 * signature yang dipakai Qrispy bisa dipastikan dari log. qris_id, nominal, dan secret sengaja tidak
 * dicatat. Nama event ditulis sebagai teks JSON, supaya isinya tetap satu baris.
 */
function catatBentuk(
  event: string | undefined,
  formatSignature: FormatSignature,
) {
  console.info(
    `Webhook Qrispy diterima: bentuk ${namaBentuk(event)}, event ${event === undefined ? "-" : JSON.stringify(event)}, signature ${formatSignature}.`,
  );
}

// Webhook Qrispy (ADR-0004). Alamat ini didaftarkan pemilik di Dashboard Qrispy → Webhook Settings.
// Signature diperiksa dari body mentah sebelum body di-parse. Kabar bentuk dashboard diteruskan ke pemroses
// kabar pembayaran Pesanan atau Top up yang sama dengan jalur cek status, yang memprosesnya dalam satu transaksi
// dan hanya sekali untuk qris_id yang sama.
export async function POST(request: Request) {
  const body = await request.text();
  const formatSignature = formatSignatureWebhook(
    body,
    request.headers.get("X-Qrispy-Signature"),
  );
  if (formatSignature === null) {
    return tolak(
      "Header X-Qrispy-Signature tidak ada atau tidak cocok dengan HMAC-SHA256 dari body, jadi webhook ini tidak diproses. Pastikan QRISPY_WEBHOOK_SECRET di server toko sama dengan secret di Dashboard Qrispy → Webhook Settings.",
      401,
    );
  }

  const payload = bacaJson(body);
  const webhook = Webhook.safeParse(payload);
  const event = webhook.success ? webhook.data.event : undefined;
  catatBentuk(event, formatSignature);

  if (event === undefined) {
    return tolak(
      `Body webhook bukan JSON dengan field event berupa teks, jadi tidak ada yang diproses. ${BentukDiterima}`,
      400,
    );
  }
  if (event === EVENT_UJI) {
    return teks(
      "Webhook uji payment.test diterima. Signature-nya cocok, dan tidak ada yang diubah.",
      200,
    );
  }
  if (event !== EVENT_PEMBAYARAN) {
    return teks(
      `Event ${event} diabaikan, karena toko hanya memproses payment.received.`,
      200,
    );
  }
  const kabar = KabarDashboard.safeParse(payload);
  if (!kabar.success) {
    return tolak(
      `Payload ${event} tidak sesuai bentuk dashboard (${z.prettifyError(kabar.error)}), jadi tidak ada yang diproses. ${BentukDiterima}`,
      400,
    );
  }

  await teruskanKabarWebhook(kabar.data);
  return teks(`Kabar pembayaran QRIS ${kabar.data.qrisId} diterima.`, 200);
}
