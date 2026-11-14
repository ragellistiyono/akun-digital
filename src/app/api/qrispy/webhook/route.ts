import { z } from "zod";

import { prosesKabarPembayaran } from "@/server/kabar-pembayaran";
import { NominalQrispy } from "@/server/nominal-qrispy";
import { signatureWebhookCocok } from "@/server/webhook-qrispy";

// Payload webhook diterima dalam dua bentuk, karena dokumentasi publik dan dokumentasi dashboard Qrispy
// berbeda, dan belum ada pembayaran sungguhan yang membuktikan salah satunya (ADR-0004,
// docs/referensi/qrispy-api.md bagian 6). Bentuknya dikenali dari field event; event lain diabaikan.
const Webhook = z.object({ event: z.string() });

/** Nominal diterima: rupiah bulat lebih dari 0, berupa angka atau teks desimal seperti "50123.00". */
const NominalDiterima = NominalQrispy.pipe(z.number().positive());

const WaktuBayar = z.iso.datetime({ offset: true });

/** Bentuk referensi, dari dokumentasi publik: event payment.success dengan field datar. */
const KabarReferensi = z
  .object({
    event: z.literal("payment.success"),
    qris_id: z.string().min(1),
    amount: NominalDiterima,
    paid_at: WaktuBayar,
  })
  .transform((kabar) => ({
    qrisId: kabar.qris_id,
    nominalDiterima: kabar.amount,
    waktuBayar: new Date(kabar.paid_at),
  }));

/**
 * Bentuk dashboard, dari dokumentasi dashboard Qrispy: event payment.received dengan field di dalam data.
 * Nominal diterima-nya received_amount, bukan amount. Field lain di data, seperti amount dan unique_id,
 * tidak dipakai, jadi tidak diperiksa.
 */
const KabarDashboard = z
  .object({
    event: z.literal("payment.received"),
    data: z.object({
      qris_id: z.string().min(1),
      received_amount: NominalDiterima,
      paid_at: WaktuBayar,
    }),
  })
  .transform(({ data }) => ({
    qrisId: data.qris_id,
    nominalDiterima: data.received_amount,
    waktuBayar: new Date(data.paid_at),
  }));

/** Bentuk webhook yang diproses, menurut event-nya. Event lain berbentuk "tidak dikenal" dan diabaikan. */
const BENTUK_WEBHOOK = new Map([
  ["payment.success", { nama: "referensi", Kabar: KabarReferensi }],
  ["payment.received", { nama: "dashboard", Kabar: KabarDashboard }],
]);

const BentukDiterima =
  'Toko menerima dua bentuk. Bentuk referensi: event payment.success dengan qris_id, amount, dan paid_at sebagai field datar tanpa pembungkus data. Bentuk dashboard: event payment.received dengan qris_id, received_amount, dan paid_at di dalam data. Di kedua bentuk, qris_id berupa teks, nominal berupa rupiah bulat lebih dari 0 dalam angka atau teks seperti "50123.00", dan paid_at berupa waktu ISO 8601 dengan zona waktu.';

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
 * Baris log bentuk webhook (ADR-0004), supaya pembayaran sungguhan pertama menunjukkan bentuk yang dipakai
 * Qrispy. Isinya hanya bentuk dan nama event-nya; qris_id, nominal, dan secret sengaja tidak dicatat. Nama
 * event ditulis sebagai teks JSON, supaya isinya tetap satu baris.
 */
function catatBentuk(bentuk: string, event: string | undefined) {
  console.info(
    `Webhook Qrispy diterima: bentuk ${bentuk}, event ${event === undefined ? "-" : JSON.stringify(event)}.`,
  );
}

// Webhook Qrispy (ADR-0004). Alamat ini didaftarkan pemilik di Dashboard Qrispy → Webhook Settings.
// Signature diperiksa dari body mentah sebelum body di-parse. Kabar dari kedua bentuk diteruskan ke pemroses
// kabar pembayaran yang sama dengan jalur cek status, yang memprosesnya dalam satu transaksi dan hanya
// sekali untuk qris_id yang sama, apa pun bentuk kabarnya.
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
  const event = webhook.success ? webhook.data.event : undefined;
  const bentuk = event === undefined ? undefined : BENTUK_WEBHOOK.get(event);
  catatBentuk(bentuk?.nama ?? "tidak dikenal", event);

  if (event === undefined) {
    return tolak(
      `Body webhook bukan JSON dengan field event berupa teks, jadi tidak ada yang diproses. ${BentukDiterima}`,
      400,
    );
  }
  if (bentuk === undefined) {
    return teks(
      `Event ${event} diabaikan, karena toko hanya memproses payment.success dan payment.received.`,
      200,
    );
  }
  const kabar = bentuk.Kabar.safeParse(payload);
  if (!kabar.success) {
    return tolak(
      `Payload ${event} tidak sesuai bentuk ${bentuk.nama} (${z.prettifyError(kabar.error)}), jadi tidak ada yang diproses. ${BentukDiterima}`,
      400,
    );
  }

  await prosesKabarPembayaran(kabar.data);
  return teks(`Kabar pembayaran QRIS ${kabar.data.qrisId} diterima.`, 200);
}
