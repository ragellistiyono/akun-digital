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
import { cekStatusPembayaran } from "@/server/kabar-pembayaran";
import { buatPesanan } from "@/server/pesanan";
import { bayarQrisTiruan, qrispyTiruan } from "@/server/qrispy-tiruan";
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
  vi.restoreAllMocks();
});

/** Menyadap console.info, tempat webhook menulis baris log bentuknya, tanpa mencetaknya saat test. */
function sadapLogBentuk() {
  return vi.spyOn(console, "info").mockImplementation(() => {});
}

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
      tautan: pesanan.tautan,
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

/** Waktu bayar di contoh bentuk dashboard, yang ditulis dengan zona +00:00 seperti di referensi bagian 6. */
const PAID_AT_DASHBOARD = "2026-11-11T03:07:00+00:00";

/**
 * Payload payment.received untuk Pesanan itu dalam bentuk dashboard, mengikuti contoh di
 * docs/referensi/qrispy-api.md bagian 6: field-nya ada di dalam data. Seperti di contoh itu, amount adalah
 * nominal tanpa Kode unik, sedangkan received_amount adalah Total bayar. Isi data bisa ditimpa per test.
 */
function paymentReceived(dipesan: Dipesan, data: Record<string, unknown> = {}) {
  return {
    event: "payment.received",
    data: {
      qris_id: dipesan.qrisId,
      amount: dipesan.hargaJual,
      received_amount: dipesan.totalBayar,
      payment_reference: dipesan.nomorPesanan,
      paid_at: PAID_AT_DASHBOARD,
      unique_id: dipesan.kodeUnik,
      ...data,
    },
  };
}

/**
 * Payload payment.success untuk Pesanan itu dalam bentuk referensi dari dokumentasi publik
 * (docs/referensi/qrispy-api.md bagian 6): field datar tanpa pembungkus data. Bentuk ini tidak lagi
 * diproses (ADR-0004).
 */
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

/**
 * Body webhook uji dari tombol Test Webhook, persis seperti contoh di docs/referensi/qrispy-api.md bagian 6.
 * qris_id-nya tidak dimiliki Pesanan mana pun.
 */
const BODY_PAYMENT_TEST = `{
  "event": "payment.test",
  "data": {
    "qris_id": "test-a62c12ad-56f1-4a90-aa40-cc588327aebe",
    "amount": 15000,
    "received_amount": 15000,
    "payment_reference": "TEST-REF-7063",
    "paid_at": "2026-11-15T13:14:02+07:00",
    "unique_id": 836
  },
  "message": "This is a test webhook from Qrispy to verify your integration."
}`;

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

/** Keadaan Pesanan yang belum tersentuh kabar pembayaran apa pun. */
const BELUM_DIBAYAR = {
  status: "Menunggu Pembayaran",
  waktuBayar: null,
  itemStok: ["Ditahan"],
};

/** Teks yang hanya ada di pesan yang masih menyebut bentuk referensi. */
const SEBUTAN_BENTUK_REFERENSI = /payment\.success|referensi|datar/;

// Issue T17, T37, T38 dan ADR-0004: webhook Qrispy diperiksa signature-nya, lalu kabar pembayaran dalam
// bentuk dashboard diproses lewat pemroses kabar pembayaran yang sama dengan jalur cek status.
describe("webhook Qrispy POST /api/qrispy/webhook", () => {
  it("signature hex yang benar untuk Pesanan Menunggu Pembayaran membuat Pesanan itu Selesai, dan Item stok yang ditahannya Terkirim", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentReceived(dipesan));

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual({
      status: "Selesai",
      waktuBayar: new Date(PAID_AT_DASHBOARD),
      itemStok: ["Terkirim"],
    });
  });

  // ADR-0004: selama formatnya belum dipastikan, signature hex dan base64 sama-sama diterima.
  it("signature base64 yang benar juga diterima, dan membuat Pesanan Selesai", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentReceived(dipesan));

    const respons = await kirimWebhook(body, signatureQrispy(body, "base64"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual({
      status: "Selesai",
      waktuBayar: new Date(PAID_AT_DASHBOARD),
      itemStok: ["Terkirim"],
    });
  });

  // ADR-0004: signature dihitung dari body mentah, bukan dari payload yang di-parse lalu ditulis ulang.
  it("body yang spasinya berbeda dari hasil JSON.stringify diterima bila signature-nya dihitung dari body itu, dan ditolak bila signature-nya dari hasil JSON.stringify", async () => {
    const dipesan = await checkout();
    const payload = paymentReceived(dipesan);
    const body = `${JSON.stringify(payload, null, 2).replaceAll('":', '" :')}\n`;
    expect(body).not.toBe(JSON.stringify(payload));

    const ditolak = await kirimWebhook(
      body,
      signatureQrispy(JSON.stringify(payload), "hex"),
    );
    expect(ditolak.status).toBe(401);
    expect(await keadaan(dipesan)).toEqual(BELUM_DIBAYAR);

    const diterima = await kirimWebhook(body, signatureQrispy(body, "hex"));
    expect(diterima.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual({
      status: "Selesai",
      waktuBayar: new Date(PAID_AT_DASHBOARD),
      itemStok: ["Terkirim"],
    });
  });

  // PRD §5.7: satu Pesanan hanya pernah mendapat satu Item stok, walaupun kabarnya datang berulang kali.
  it("webhook yang sama dikirim dua kali: keduanya dijawab 200, dan Pesanan tetap hanya punya satu Item stok", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentReceived(dipesan));
    const signature = signatureQrispy(body, "hex");

    const pertama = await kirimWebhook(body, signature);
    const kedua = await kirimWebhook(body, signature);

    expect([pertama.status, kedua.status]).toEqual([200, 200]);
    expect(await keadaan(dipesan)).toEqual({
      status: "Selesai",
      waktuBayar: new Date(PAID_AT_DASHBOARD),
      itemStok: ["Terkirim"],
    });
  });

  // PRD §5.7 dan ADR-0004: webhook dan cek status memanggil pemroses kabar pembayaran yang sama, jadi
  // kabar untuk qris_id yang sama hanya diproses sekali, apa pun jalur yang lebih dulu sampai.
  it("webhook payment.received lalu cek status paid untuk qris_id yang sama: hanya webhook yang diproses, dan Pesanan hanya punya satu Item stok", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentReceived(dipesan));
    bayarQrisTiruan(
      { qrisId: dipesan.qrisId, amount: dipesan.totalBayar },
      { sekarang: new Date(PAID_AT) },
    );

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));
    await cekStatusPembayaran(dipesan.tautan, { qrispy: qrispyTiruan });

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual({
      status: "Selesai",
      waktuBayar: new Date(PAID_AT_DASHBOARD),
      itemStok: ["Terkirim"],
    });
  });

  it("cek status paid lalu webhook payment.received untuk qris_id yang sama: webhook dijawab 200 tanpa perubahan, dan Pesanan hanya punya satu Item stok", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentReceived(dipesan));
    bayarQrisTiruan(
      { qrisId: dipesan.qrisId, amount: dipesan.totalBayar },
      { sekarang: new Date(PAID_AT) },
    );

    await cekStatusPembayaran(dipesan.tautan, { qrispy: qrispyTiruan });
    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual({
      status: "Selesai",
      waktuBayar: new Date(PAID_AT),
      itemStok: ["Terkirim"],
    });
  });

  // PRD §5.9 butir 2: yang dibandingkan dengan Total bayar adalah received_amount, bukan amount.
  it("received_amount kurang dari Total bayar membuat Pesanan Bermasalah dan melepas Item stok yang ditahannya, walaupun amount sama dengan Total bayar", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(
      paymentReceived(dipesan, {
        amount: dipesan.totalBayar,
        received_amount: dipesan.totalBayar - 1,
      }),
    );

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual({
      status: "Bermasalah",
      waktuBayar: new Date(PAID_AT_DASHBOARD),
      itemStok: [],
    });
  });

  // ADR-0004: nominal dari Qrispy bisa berupa teks desimal, seperti di jawaban API (referensi bagian 9).
  for (const [kasus, nominal] of [
    ["teks angka bulat", (d: Dipesan) => String(d.totalBayar)],
    ["teks desimal", (d: Dipesan) => `${d.totalBayar}.00`],
  ] as const) {
    it(`received_amount berupa ${kasus} yang sama dengan Total bayar diproses sama seperti angka: Pesanan Selesai`, async () => {
      const dipesan = await checkout();
      const body = JSON.stringify(
        paymentReceived(dipesan, {
          amount: nominal(dipesan),
          received_amount: nominal(dipesan),
        }),
      );

      const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

      expect(respons.status).toBe(200);
      expect(await keadaan(dipesan)).toEqual({
        status: "Selesai",
        waktuBayar: new Date(PAID_AT_DASHBOARD),
        itemStok: ["Terkirim"],
      });
    });
  }

  it("received_amount teks desimal yang Rp 1 kurang dari Total bayar dibaca sebagai nominalnya, sehingga Pesanan Bermasalah seperti bila nominal itu dikirim sebagai angka", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(
      paymentReceived(dipesan, {
        received_amount: `${dipesan.totalBayar - 1}.00`,
      }),
    );

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect((await keadaan(dipesan)).status).toBe("Bermasalah");
  });

  for (const [kasus, buatBody] of [
    ["body bukan JSON", () => "event=payment.received"],
    ["JSON null", () => "null"],
    [
      "JSON tanpa event",
      (d: Dipesan) => JSON.stringify(paymentReceived(d).data),
    ],
    // ADR-0004: tanpa received_amount, pembayarannya tetap tertangkap lewat cek status.
    [
      "payment.received tanpa received_amount",
      (d: Dipesan) =>
        JSON.stringify(paymentReceived(d, { received_amount: undefined })),
    ],
    [
      // Bentuk referensi dengan nama event dashboard, yang tidak punya data maupun received_amount.
      "payment.received berfield datar tanpa pembungkus data",
      (d: Dipesan) =>
        JSON.stringify({ ...paymentSuccess(d), event: "payment.received" }),
    ],
    [
      "payment.received dengan received_amount di luar data",
      (d: Dipesan) => {
        const { data } = paymentReceived(d);
        return JSON.stringify({ event: "payment.received", ...data });
      },
    ],
    [
      "payment.received tanpa qris_id",
      (d: Dipesan) =>
        JSON.stringify(paymentReceived(d, { qris_id: undefined })),
    ],
    [
      "payment.received dengan received_amount 0",
      (d: Dipesan) =>
        JSON.stringify(paymentReceived(d, { received_amount: 0 })),
    ],
    [
      "payment.received dengan received_amount bukan rupiah bulat",
      (d: Dipesan) =>
        JSON.stringify(
          paymentReceived(d, { received_amount: d.totalBayar + 0.5 }),
        ),
    ],
    [
      "payment.received dengan received_amount berupa teks yang punya sen",
      (d: Dipesan) =>
        JSON.stringify(
          paymentReceived(d, { received_amount: `${d.totalBayar}.50` }),
        ),
    ],
    [
      "payment.received dengan paid_at bukan waktu",
      (d: Dipesan) =>
        JSON.stringify(paymentReceived(d, { paid_at: "kemarin" })),
    ],
  ] as const) {
    it(`${kasus} dengan signature yang benar dijawab 400 dengan pesan yang hanya menyebut bentuk dashboard, dan Pesanan tetap Menunggu Pembayaran`, async () => {
      const dipesan = await checkout();
      const body = buatBody(dipesan);

      const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

      expect(respons.status).toBe(400);
      const isi = await respons.text();
      expect(isi).toMatch(/payment\.received.*data.*received_amount/s);
      expect(isi).not.toMatch(SEBUTAN_BENTUK_REFERENSI);
      expect(await keadaan(dipesan)).toEqual(BELUM_DIBAYAR);
    });
  }

  // ADR-0004: bentuk referensi tidak lagi diproses. payment.success, dalam bentuk apa pun, dijawab
  // 200 tanpa perubahan seperti event lain yang tidak dikenal.
  for (const [kasus, buatPayload] of [
    ["payment.success berfield datar seperti bentuk referensi", paymentSuccess],
    [
      "payment.success dengan field bentuk dashboard",
      (d: Dipesan) => ({ ...paymentReceived(d), event: "payment.success" }),
    ],
    [
      "payment.success dengan amount 0",
      (d: Dipesan) => ({ ...paymentSuccess(d), amount: 0 }),
    ],
    [
      "payment.expired yang bentuknya tidak dijelaskan dokumentasi",
      (d: Dipesan) => ({ event: "payment.expired", qris_id: d.qrisId }),
    ],
    [
      "payment.expired dengan field bentuk dashboard",
      (d: Dipesan) => ({ ...paymentReceived(d), event: "payment.expired" }),
    ],
  ] as const) {
    it(`event ${kasus} bersignature benar dijawab 200 dengan teks yang hanya menyebut bentuk dashboard, dan Pesanan tetap Menunggu Pembayaran`, async () => {
      const dipesan = await checkout();
      const body = JSON.stringify(buatPayload(dipesan));

      const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

      expect(respons.status).toBe(200);
      const isi = await respons.text();
      expect(isi).toMatch(/diabaikan.*payment\.received/s);
      expect(isi.replace(/^Event \S+/, "")).not.toMatch(
        SEBUTAN_BENTUK_REFERENSI,
      );
      expect(await keadaan(dipesan)).toEqual(BELUM_DIBAYAR);
    });
  }

  // ADR-0004 dan referensi bagian 6: tombol Test Webhook mengirim payment.test, yang dikenali sebagai webhook
  // uji. Webhook uji tidak divalidasi sebagai kabar pembayaran dan tidak diteruskan ke pemrosesnya.
  it("payment.test persis seperti contoh di referensi bagian 6, dengan qris_id yang tidak dikenal, dijawab 200 tanpa diteruskan ke pemroses kabar pembayaran", async () => {
    const galat = vi.spyOn(console, "error");
    const peringatan = vi.spyOn(console, "warn");
    sadapLogBentuk();

    const respons = await kirimWebhook(
      BODY_PAYMENT_TEST,
      signatureQrispy(BODY_PAYMENT_TEST, "hex"),
    );

    expect(respons.status).toBe(200);
    expect(await respons.text()).toMatch(/payment\.test/);
    expect(galat).not.toHaveBeenCalled();
    expect(peringatan).not.toHaveBeenCalled();
  });

  for (const [kasus, buatPayload] of [
    [
      "dengan qris_id dan received_amount milik Pesanan Menunggu Pembayaran",
      (d: Dipesan) => ({ ...paymentReceived(d), event: "payment.test" }),
    ],
    [
      "tanpa data, sehingga tidak sah sebagai kabar pembayaran",
      () => ({ event: "payment.test" }),
    ],
  ] as const) {
    it(`payment.test ${kasus} dijawab 200, dan Pesanan tetap Menunggu Pembayaran`, async () => {
      const dipesan = await checkout();
      const body = JSON.stringify(buatPayload(dipesan));

      const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

      expect(respons.status).toBe(200);
      expect(await keadaan(dipesan)).toEqual(BELUM_DIBAYAR);
    });
  }

  // Tanpa secret, siapa pun bisa membuat signature dengan kunci kosong, jadi webhook tidak boleh diproses.
  for (const kosong of ["", "   "]) {
    it(`QRISPY_WEBHOOK_SECRET bernilai "${kosong}": webhook ditolak dengan pesan yang menyebut QRISPY_WEBHOOK_SECRET, dan Pesanan tidak berubah`, async () => {
      vi.stubEnv("QRISPY_WEBHOOK_SECRET", kosong);
      const dipesan = await checkout();
      const body = JSON.stringify(paymentReceived(dipesan));
      const signature = createHmac("sha256", kosong).update(body).digest("hex");

      await expect(kirimWebhook(body, signature)).rejects.toThrow(
        /QRISPY_WEBHOOK_SECRET/,
      );
      expect(await keadaan(dipesan)).toEqual(BELUM_DIBAYAR);
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
    [
      "signature base64 dari secret lain",
      (body: string) =>
        createHmac("sha256", "secret-lain").update(body).digest("base64"),
    ],
    ["signature kosong", () => ""],
    ["tanpa header X-Qrispy-Signature", () => undefined],
  ] as const) {
    for (const [event, buatBody] of [
      ["payment.received", (d: Dipesan) => JSON.stringify(paymentReceived(d))],
      ["payment.test", () => BODY_PAYMENT_TEST],
    ] as const) {
      it(`${event} dengan ${kasus} dijawab 401, tanpa baris log bentuk, dan Pesanan tidak berubah`, async () => {
        const dipesan = await checkout();
        const body = buatBody(dipesan);
        const logBentuk = sadapLogBentuk();

        const respons = await kirimWebhook(body, tandatangani(body));

        expect(respons.status).toBe(401);
        expect(logBentuk).not.toHaveBeenCalled();
        expect(await keadaan(dipesan)).toEqual(BELUM_DIBAYAR);
      });
    }
  }

  // ADR-0004: setiap webhook yang signature-nya cocok meninggalkan satu baris log berisi bentuk, event, dan
  // format signature yang cocok, supaya format signature Qrispy bisa dipastikan dari log.
  for (const [kasus, buatBody, format, baris] of [
    [
      "bentuk dashboard",
      (d: Dipesan) => JSON.stringify(paymentReceived(d)),
      "hex",
      'Webhook Qrispy diterima: bentuk dashboard, event "payment.received", signature hex.',
    ],
    [
      "bentuk dashboard",
      (d: Dipesan) => JSON.stringify(paymentReceived(d)),
      "base64",
      'Webhook Qrispy diterima: bentuk dashboard, event "payment.received", signature base64.',
    ],
    [
      "bentuk dashboard tanpa received_amount, yang dijawab 400",
      (d: Dipesan) =>
        JSON.stringify(paymentReceived(d, { received_amount: undefined })),
      "hex",
      'Webhook Qrispy diterima: bentuk dashboard, event "payment.received", signature hex.',
    ],
    [
      "bentuk dashboard dengan nominal teks yang punya sen, yang dijawab 400",
      (d: Dipesan) =>
        JSON.stringify(
          paymentReceived(d, { received_amount: `${d.totalBayar}.50` }),
        ),
      "base64",
      'Webhook Qrispy diterima: bentuk dashboard, event "payment.received", signature base64.',
    ],
    [
      "webhook uji",
      () => BODY_PAYMENT_TEST,
      "hex",
      'Webhook Qrispy diterima: bentuk uji, event "payment.test", signature hex.',
    ],
    [
      "webhook uji",
      () => BODY_PAYMENT_TEST,
      "base64",
      'Webhook Qrispy diterima: bentuk uji, event "payment.test", signature base64.',
    ],
    [
      "payment.success berfield datar",
      (d: Dipesan) => JSON.stringify(paymentSuccess(d)),
      "hex",
      'Webhook Qrispy diterima: bentuk tidak dikenal, event "payment.success", signature hex.',
    ],
    [
      "event lain",
      (d: Dipesan) =>
        JSON.stringify({ ...paymentReceived(d), event: "payment.expired" }),
      "base64",
      'Webhook Qrispy diterima: bentuk tidak dikenal, event "payment.expired", signature base64.',
    ],
    [
      "body bukan JSON",
      () => "event=payment.received",
      "hex",
      "Webhook Qrispy diterima: bentuk tidak dikenal, event -, signature hex.",
    ],
    [
      "JSON tanpa event",
      (d: Dipesan) => JSON.stringify(paymentReceived(d).data),
      "base64",
      "Webhook Qrispy diterima: bentuk tidak dikenal, event -, signature base64.",
    ],
  ] as const) {
    it(`webhook bersignature ${format} yang benar (${kasus}) menulis tepat satu baris log bentuk yang berakhir dengan "signature ${format}.", tanpa qris_id, nominal, atau secret`, async () => {
      const dipesan = await checkout();
      const body = buatBody(dipesan);
      const logBentuk = sadapLogBentuk();
      vi.spyOn(console, "warn").mockImplementation(() => {});

      await kirimWebhook(body, signatureQrispy(body, format));

      expect(logBentuk.mock.calls).toEqual([[baris]]);
      expect(baris.endsWith(`signature ${format}.`)).toBe(true);
      for (const rahasia of [
        dipesan.qrisId,
        String(dipesan.totalBayar),
        String(dipesan.hargaJual),
        "a62c12ad",
        "15000",
        RAHASIA,
        signatureQrispy(body, format),
      ]) {
        expect(baris).not.toContain(rahasia);
      }
    });
  }
});
