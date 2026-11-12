// Qrispy sungguhan (ADR-0004): memanggil API Qrispy dengan fetch, tanpa dependency baru, menurut
// docs/referensi/qrispy-api.md. Setiap jawaban divalidasi dengan Zod sebelum dipakai. return_url tidak
// dikirim, karena Tautan Pesanan tidak boleh sampai ke pihak ketiga (ADR-0004). QRISPY_API_TOKEN hanya
// dikirim di header X-API-TOKEN dan tidak pernah ikut dalam pesan galat.
import { z } from "zod";

import type { Qrispy } from "./qrispy";

/** Respons membuat QRIS (bagian 3). Field yang tidak dipakai toko, misalnya checkout_url, tidak diperiksa. */
const QrisBaruQrispy = z.object({
  status: z.literal("success"),
  data: z.object({
    qris_id: z.string().min(1),
    qris_image_base64: z.string().startsWith("data:image/png;base64,"),
    amount: z.number().int().positive(),
    requested_amount: z.number().int().positive(),
    unique_id: z.number().int(),
    expired_at: z.iso.datetime({ offset: true }),
  }),
});

/**
 * Respons status QRIS (bagian 4). Status paid membawa nominal diterima dan waktu bayarnya; paid_at bernilai
 * null selama belum dibayar.
 */
const StatusQrisQrispy = z.object({
  status: z.literal("success"),
  data: z.discriminatedUnion("payment_status", [
    z.object({
      payment_status: z.literal("paid"),
      amount: z.number().int().positive(),
      paid_at: z.iso.datetime({ offset: true }),
    }),
    z.object({ payment_status: z.enum(["pending", "expired", "cancelled"]) }),
  ]),
});

/** Respons membatalkan QRIS (bagian 5). */
const PembatalanQrispy = z.object({ status: z.literal("success") });

/** Body error umum Qrispy (bagian 7). */
const ErrorQrispy = z.object({ message: z.string() });

/**
 * Batas waktu menunggu jawaban Qrispy, termasuk isi jawabannya, supaya checkout dan pekerjaan latar tidak
 * tertahan oleh Qrispy yang tidak menjawab.
 */
const BATAS_TUNGGU_MS = 10_000;

/** Panjang terbesar isi jawaban Qrispy yang ikut di pesan galat. */
const PANJANG_JAWABAN_DI_GALAT = 500;

/**
 * Kegagalan memanggil Qrispy: Qrispy menolak dengan kode HTTP error, tidak menjawab, atau menjawab dengan
 * isi yang tidak cocok skema. `statusHttp` berisi kode HTTP jawaban Qrispy, atau null bila Qrispy tidak
 * menjawab. Pesannya tidak pernah memuat QRISPY_API_TOKEN.
 */
export class GalatQrispy extends Error {
  override name = "GalatQrispy";

  constructor(
    message: string,
    readonly statusHttp: number | null,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** Langkah berikutnya untuk pemilik, menurut kode HTTP error dari Qrispy (bagian 7). */
function langkahBerikutnya(statusHttp: number) {
  if (statusHttp === 400) {
    return "Periksa isi permintaannya, misalnya nominal yang melewati batas Qrispy (Rp 499.000 untuk merchant standar).";
  }
  if (statusHttp === 401) {
    return "Periksa QRISPY_API_TOKEN di server: isinya harus token API dari Client Dashboard Qrispy.";
  }
  if (statusHttp === 429) {
    return "Qrispy membatasi jumlah permintaan; coba lagi beberapa saat kemudian.";
  }
  return "Coba lagi beberapa saat kemudian; bila terus berulang, tanyakan ke Qrispy.";
}

/** Isi jawaban sebagai JSON, atau undefined bila bukan JSON. */
function bacaJson(isi: string): unknown {
  try {
    return JSON.parse(isi);
  } catch {
    return undefined;
  }
}

/** Pesan Qrispy dari isi jawaban error: field message bila ada, atau potongan isinya. */
function pesanErrorQrispy(isi: string) {
  const error = ErrorQrispy.safeParse(bacaJson(isi));
  return error.success
    ? error.data.message
    : isi.slice(0, PANJANG_JAWABAN_DI_GALAT);
}

/**
 * Bahan Qrispy sungguhan. fetch dan batas waktunya bisa diganti untuk test, supaya Qrispy sungguhan tidak
 * pernah dipanggil.
 */
type BahanQrispySungguhan = {
  /** Alamat dasar API Qrispy (QRISPY_BASE_URL). */
  alamatDasar: string;
  /** Token API dari Client Dashboard Qrispy (QRISPY_API_TOKEN). */
  token: string;
  fetch?: typeof fetch;
  batasTungguMs?: number;
};

export function qrispySungguhan({
  alamatDasar,
  token,
  fetch = globalThis.fetch,
  batasTungguMs = BATAS_TUNGGU_MS,
}: BahanQrispySungguhan): Qrispy {
  /**
   * Memanggil satu endpoint Qrispy dengan ketiga header (bagian 1), lalu memvalidasi isi jawabannya dengan
   * skema itu. Setiap kegagalan dilempar sebagai GalatQrispy.
   */
  async function minta<T>(
    aksi: string,
    path: string,
    { method, body }: { method: "GET" | "POST"; body?: unknown },
    skema: z.ZodType<T>,
  ): Promise<T> {
    let jawaban: Response;
    let isi: string;
    try {
      jawaban = await fetch(`${alamatDasar.replace(/\/+$/, "")}${path}`, {
        method,
        headers: {
          "X-API-TOKEN": token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(batasTungguMs),
      });
      isi = await jawaban.text();
    } catch (galat) {
      const habisWaktu =
        galat instanceof DOMException && galat.name === "TimeoutError";
      throw new GalatQrispy(
        habisWaktu
          ? `Qrispy tidak menjawab ${aksi} dalam ${batasTungguMs / 1000} detik, jadi permintaannya dihentikan. Coba lagi beberapa saat kemudian; bila terus berulang, periksa koneksi server ke Qrispy.`
          : `Qrispy tidak menjawab ${aksi}, karena koneksinya gagal: ${String(galat)}. Periksa QRISPY_BASE_URL dan koneksi server ke Qrispy, lalu coba lagi.`,
        null,
        { cause: galat },
      );
    }
    if (!jawaban.ok) {
      throw new GalatQrispy(
        `Qrispy menolak ${aksi} dengan HTTP ${jawaban.status}: "${pesanErrorQrispy(isi)}". ${langkahBerikutnya(jawaban.status)}`,
        jawaban.status,
      );
    }
    const hasil = skema.safeParse(bacaJson(isi));
    if (!hasil.success) {
      // Isi jawabannya tidak ikut di pesan, karena bisa memuat gambar QR yang panjang.
      throw new GalatQrispy(
        `Jawaban Qrispy untuk ${aksi} (HTTP ${jawaban.status}) tidak cocok dengan bentuk di docs/referensi/qrispy-api.md, jadi tidak dipakai: ${z.prettifyError(hasil.error)}. Periksa apakah API Qrispy berubah, lalu sesuaikan referensi dan src/server/qrispy-sungguhan.ts.`,
        jawaban.status,
      );
    }
    return hasil.data;
  }

  return {
    async buatQris({ amount, paymentReference }) {
      const { data } = await minta(
        `pembuatan QRIS untuk Pesanan ${paymentReference}`,
        "/api/payment/qris/generate",
        {
          method: "POST",
          body: { amount, payment_reference: paymentReference },
        },
        QrisBaruQrispy,
      );
      return {
        qrisId: data.qris_id,
        amount: data.amount,
        requestedAmount: data.requested_amount,
        uniqueId: data.unique_id,
        expiredAt: new Date(data.expired_at),
        gambarQr: data.qris_image_base64,
      };
    },
    async batalkanQris(qrisId) {
      await minta(
        `pembatalan QRIS ${qrisId}`,
        `/api/payment/qris/${encodeURIComponent(qrisId)}/cancel`,
        { method: "POST" },
        PembatalanQrispy,
      );
    },
    async cekStatusQris(qrisId) {
      const { data } = await minta(
        `cek status QRIS ${qrisId}`,
        `/api/payment/qris/${encodeURIComponent(qrisId)}/status`,
        { method: "GET" },
        StatusQrisQrispy,
      );
      if (data.payment_status !== "paid") {
        return { paymentStatus: data.payment_status };
      }
      return {
        paymentStatus: "paid",
        amount: data.amount,
        paidAt: new Date(data.paid_at),
      };
    },
  };
}
