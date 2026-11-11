import { createHmac, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { db, koneksi } from "@/server/db";
import { itemStok, pesanan, varian } from "@/server/db/schema";
import { buatPesanan } from "@/server/pesanan";
import { qrispyTiruan } from "@/server/qrispy-tiruan";
import { sisipkanProduk } from "@/server/uji-katalog";

import { POST } from "./route";

// Test integrasi dengan database app_test dari .env.ci, yang dipakai bersama test lain. Setiap test
// membuat Pesanannya sendiri lewat checkout dengan Qrispy tiruan; data Produknya bertanda [CONTOH].
afterAll(async () => {
  await koneksi.end();
});

/** Secret webhook khusus test ini, yang juga dipakai "Qrispy" di test untuk menandatangani body. */
const RAHASIA = "rahasia-webhook-uji-bukan-rahasia-asli";
const PAID_AT = "2026-11-11T10:05:00+07:00";

beforeEach(() => {
  vi.stubEnv("QRISPY_WEBHOOK_SECRET", RAHASIA);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Signature seperti yang dikirim Qrispy: HMAC-SHA256 dari body dengan secret webhook sebagai kunci. */
function signatureQrispy(body: string, bentuk: "hex" | "base64") {
  return createHmac("sha256", RAHASIA).update(body).digest(bentuk);
}

/** Mengirim webhook dengan body mentah itu, dan header X-Qrispy-Signature bila ada. */
function kirimWebhook(body: string, signature?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (signature !== undefined) headers.set("X-Qrispy-Signature", signature);
  return POST(
    new Request("http://localhost/api/qrispy/webhook", {
      method: "POST",
      headers,
      body,
    }),
  );
}

/**
 * Checkout Canva Pro 1 Bulan Rp 50.000 [CONTOH] lewat Qrispy tiruan, sehingga ada Pesanan Menunggu
 * Pembayaran yang menahan satu Item stok.
 */
async function checkout() {
  const produkId = await sisipkanProduk({
    nama: `Canva Pro ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 5 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const hasil = await buatPesanan(
    { varianId, email: `budi-${randomUUID()}@example.test` },
    { qrispy: qrispyTiruan },
  );
  if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);
  const [dibuat] = await db
    .select({
      id: pesanan.id,
      nomorPesanan: pesanan.nomorPesanan,
      qrisId: pesanan.qrisId,
      hargaJual: pesanan.hargaJual,
      kodeUnik: pesanan.kodeUnik,
      totalBayar: pesanan.totalBayar,
    })
    .from(pesanan)
    .where(eq(pesanan.tautan, hasil.tautan));
  return dibuat;
}

type Dipesan = Awaited<ReturnType<typeof checkout>>;

/** Payload payment.success untuk Pesanan itu, berbentuk datar seperti docs/referensi/qrispy-api.md bagian 6. */
function paymentSuccess(dipesan: Dipesan) {
  return {
    event: "payment.success",
    qris_id: dipesan.qrisId,
    amount: dipesan.totalBayar,
    requested_amount: dipesan.hargaJual,
    unique_id: dipesan.kodeUnik,
    payment_reference: dipesan.nomorPesanan,
    paid_at: PAID_AT,
    merchant_id: 42,
  };
}

/** Status dan waktu bayar Pesanan itu, beserta status Item stok yang tercatat miliknya. */
async function keadaan(dipesan: Dipesan) {
  const [baris] = await db
    .select({ status: pesanan.status, waktuBayar: pesanan.waktuBayar })
    .from(pesanan)
    .where(eq(pesanan.id, dipesan.id));
  const milik = await db
    .select({ status: itemStok.status })
    .from(itemStok)
    .where(eq(itemStok.pesananId, dipesan.id));
  return { ...baris, itemStok: milik.map((i) => i.status) };
}

// Issue T17 dan ADR-0004: webhook payment.success dari Qrispy diperiksa signature-nya, lalu diproses
// lewat pemroses kabar pembayaran yang sama dengan jalur cek status.
describe("webhook Qrispy POST /api/qrispy/webhook", () => {
  it("signature hex yang benar untuk Pesanan Menunggu Pembayaran membuat Pesanan itu Selesai, dan Item stok yang ditahannya Terkirim", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentSuccess(dipesan));

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual({
      status: "Selesai",
      waktuBayar: new Date(PAID_AT),
      itemStok: ["Terkirim"],
    });
  });

  // ADR-0004: selama formatnya belum dipastikan, signature hex dan base64 sama-sama diterima.
  it("signature base64 yang benar juga diterima, dan membuat Pesanan Selesai", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentSuccess(dipesan));

    const respons = await kirimWebhook(body, signatureQrispy(body, "base64"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual({
      status: "Selesai",
      waktuBayar: new Date(PAID_AT),
      itemStok: ["Terkirim"],
    });
  });

  // ADR-0004: signature dihitung dari body mentah, bukan dari payload yang di-parse lalu ditulis ulang.
  it("body yang spasinya berbeda dari hasil JSON.stringify diterima bila signature-nya dihitung dari body itu, dan ditolak bila signature-nya dari hasil JSON.stringify", async () => {
    const dipesan = await checkout();
    const payload = paymentSuccess(dipesan);
    const body = `${JSON.stringify(payload, null, 2).replaceAll('":', '" :')}\n`;
    expect(body).not.toBe(JSON.stringify(payload));

    const ditolak = await kirimWebhook(
      body,
      signatureQrispy(JSON.stringify(payload), "hex"),
    );
    expect(ditolak.status).toBe(401);
    expect((await keadaan(dipesan)).status).toBe("Menunggu Pembayaran");

    const diterima = await kirimWebhook(body, signatureQrispy(body, "hex"));
    expect(diterima.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual({
      status: "Selesai",
      waktuBayar: new Date(PAID_AT),
      itemStok: ["Terkirim"],
    });
  });

  // PRD §5.7: satu Pesanan hanya pernah mendapat satu Item stok, walaupun kabarnya datang berulang kali.
  it("webhook yang sama dikirim dua kali: keduanya dijawab 200, dan Pesanan tetap hanya punya satu Item stok", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentSuccess(dipesan));
    const signature = signatureQrispy(body, "hex");

    const pertama = await kirimWebhook(body, signature);
    const kedua = await kirimWebhook(body, signature);

    expect([pertama.status, kedua.status]).toEqual([200, 200]);
    expect(await keadaan(dipesan)).toEqual({
      status: "Selesai",
      waktuBayar: new Date(PAID_AT),
      itemStok: ["Terkirim"],
    });
  });

  for (const [kasus, ubahPayload] of [
    ["bukan JSON", () => "event=payment.success"],
    ["JSON null", () => "null"],
    // JSON.stringify melewatkan field yang bernilai undefined.
    [
      "tanpa event",
      (d: Dipesan) =>
        JSON.stringify({ ...paymentSuccess(d), event: undefined }),
    ],
    [
      "tanpa qris_id",
      (d: Dipesan) =>
        JSON.stringify({ ...paymentSuccess(d), qris_id: undefined }),
    ],
    [
      "amount berupa teks",
      (d: Dipesan) =>
        JSON.stringify({ ...paymentSuccess(d), amount: String(d.totalBayar) }),
    ],
    [
      "amount bukan rupiah bulat",
      (d: Dipesan) =>
        JSON.stringify({ ...paymentSuccess(d), amount: d.totalBayar + 0.5 }),
    ],
    [
      "paid_at bukan waktu",
      (d: Dipesan) =>
        JSON.stringify({ ...paymentSuccess(d), paid_at: "kemarin" }),
    ],
    [
      // Bentuk draf awal yang dikoreksi di docs/referensi/qrispy-api.md bagian 8.
      "field dibungkus data",
      (d: Dipesan) => {
        const { event, ...isi } = paymentSuccess(d);
        return JSON.stringify({ event, data: isi });
      },
    ],
  ] as const) {
    it(`payload payment.success ${kasus} dengan signature yang benar dijawab 400, dan Pesanan tidak berubah`, async () => {
      const dipesan = await checkout();
      const body = ubahPayload(dipesan);

      const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

      expect(respons.status).toBe(400);
      expect(await keadaan(dipesan)).toEqual({
        status: "Menunggu Pembayaran",
        waktuBayar: null,
        itemStok: ["Ditahan"],
      });
    });
  }

  for (const [kasus, buatPayload] of [
    [
      // Nama event di draf awal yang dikoreksi di docs/referensi/qrispy-api.md bagian 8.
      "payment.received dengan field lengkap",
      (d: Dipesan) => ({ ...paymentSuccess(d), event: "payment.received" }),
    ],
    [
      "payment.expired yang bentuknya tidak dijelaskan dokumentasi",
      (d: Dipesan) => ({ event: "payment.expired", qris_id: d.qrisId }),
    ],
  ] as const) {
    it(`event ${kasus} dijawab 200, dan Pesanan tidak berubah`, async () => {
      const dipesan = await checkout();
      const body = JSON.stringify(buatPayload(dipesan));

      const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

      expect(respons.status).toBe(200);
      expect(await keadaan(dipesan)).toEqual({
        status: "Menunggu Pembayaran",
        waktuBayar: null,
        itemStok: ["Ditahan"],
      });
    });
  }

  // Tanpa secret, siapa pun bisa membuat signature dengan kunci kosong, jadi webhook tidak boleh diproses.
  for (const kosong of ["", "   "]) {
    it(`QRISPY_WEBHOOK_SECRET bernilai "${kosong}": webhook ditolak dengan pesan yang menyebut QRISPY_WEBHOOK_SECRET, dan Pesanan tidak berubah`, async () => {
      vi.stubEnv("QRISPY_WEBHOOK_SECRET", kosong);
      const dipesan = await checkout();
      const body = JSON.stringify(paymentSuccess(dipesan));
      const signature = createHmac("sha256", kosong).update(body).digest("hex");

      await expect(kirimWebhook(body, signature)).rejects.toThrow(
        /QRISPY_WEBHOOK_SECRET/,
      );
      expect(await keadaan(dipesan)).toEqual({
        status: "Menunggu Pembayaran",
        waktuBayar: null,
        itemStok: ["Ditahan"],
      });
    });
  }

  for (const [kasus, tandatangani] of [
    [
      "signature dari secret lain",
      (body: string) =>
        createHmac("sha256", "secret-lain").update(body).digest("hex"),
    ],
    [
      "signature dari body lain",
      (body: string) => signatureQrispy(`${body} `, "hex"),
    ],
    [
      "signature hex dengan huruf terakhir diganti",
      (body: string) =>
        signatureQrispy(body, "hex").slice(0, -1) +
        (signatureQrispy(body, "hex").endsWith("0") ? "1" : "0"),
    ],
    ["signature kosong", () => ""],
    ["tanpa header X-Qrispy-Signature", () => undefined],
  ] as const) {
    it(`${kasus} dijawab 401, dan Pesanan tidak berubah`, async () => {
      const dipesan = await checkout();
      const body = JSON.stringify(paymentSuccess(dipesan));

      const respons = await kirimWebhook(body, tandatangani(body));

      expect(respons.status).toBe(401);
      expect(await keadaan(dipesan)).toEqual({
        status: "Menunggu Pembayaran",
        waktuBayar: null,
        itemStok: ["Ditahan"],
      });
    });
  }
});
