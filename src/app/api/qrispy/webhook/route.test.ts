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
import {
  itemStok,
  pesanan,
  riwayatSaldo,
  topUp,
  user,
  varian,
} from "@/server/db/schema";
import { cekStatusPembayaran } from "@/server/kabar-pembayaran";
import { buatPesanan } from "@/server/pesanan";
import type { Qrispy } from "@/server/qrispy";
import { bayarQrisTiruan, qrispyTiruan } from "@/server/qrispy-tiruan";
import { buatTopUp } from "@/server/top-up";
import { sisipkanProduk } from "@/server/uji-katalog";
import { sisipkanMember } from "@/server/uji-member";

import { POST } from "./route";
import { kolomQris } from "@/server/uji-pesanan";

// Test integrasi dengan database app_test dari .env.ci, yang dipakai bersama test lain. Setiap test
// membuat Pesanannya sendiri lewat checkout dengan Qrispy tiruan; data Produknya bertanda [CONTOH]. Cek status yang
// dipicu webhook dijawab Qrispy tiruan (QRISPY_MODE=tiruan di .env.ci), kecuali test yang menggantinya.
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
  vi.unstubAllGlobals();
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

/** Qrispy tiruan yang menerbitkan QRIS dengan Kode unik itu. */
function qrispyKodeUnik(kodeUnik: number): Qrispy {
  return {
    ...qrispyTiruan,
    buatQris: async (masukan) => ({
      ...(await qrispyTiruan.buatQris(masukan)),
      amount: masukan.amount + kodeUnik,
      uniqueId: kodeUnik,
    }),
  };
}

/**
 * Checkout Canva Pro 1 Bulan Rp 50.000 [CONTOH], atau dengan Harga jual itu, lewat Qrispy tiruan, sehingga ada
 * Pesanan Menunggu Pembayaran yang menahan satu Item stok.
 */
async function checkout({
  hargaJual = 50000,
  qrispy = qrispyTiruan,
}: { hargaJual?: number; qrispy?: Qrispy } = {}) {
  const produkId = await sisipkanProduk({
    nama: `Canva Pro ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual, Tersedia: 5 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const hasil = await buatPesanan(
    { varianId, email: `budi-${randomUUID()}@example.test` },
    { qrispy },
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
  return { ...dibuat, qrisId: kolomQris(dibuat.qrisId) };
}

type Dipesan = Awaited<ReturnType<typeof checkout>>;

/** Waktu bayar di contoh bentuk dashboard, yang ditulis dengan zona +00:00 seperti di referensi bagian 6. */
const PAID_AT_DASHBOARD = "2026-11-11T03:07:00+00:00";

/**
 * Payload payment.received untuk Pesanan itu dalam bentuk dashboard, mengikuti contoh di
 * docs/referensi/qrispy-api.md bagian 6: field-nya ada di dalam data. Seperti di contoh itu, amount adalah
 * nominal tanpa Kode unik, sedangkan received_amount di sini Total bayar. Keduanya tidak menentukan hasilnya, karena
 * nominal diterima dan waktu bayar diambil dari cek status (T82). Isi data bisa ditimpa per test.
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

/**
 * Keadaan Pesanan yang dibayar penuh lewat bayar(): Selesai dengan waktu bayar dari cek status, dan Item stok yang
 * ditahannya Terkirim.
 */
const SELESAI = {
  status: "Selesai",
  waktuBayar: new Date(PAID_AT),
  itemStok: ["Terkirim"],
};

/**
 * Pembeli tiruan membayar QRIS itu sebesar Total bayar, atau sebesar nominal itu, pada PAID_AT. Sesudahnya cek status
 * QRIS itu di Qrispy tiruan menjawab paid dengan amount tersebut dan paid_at PAID_AT.
 */
function bayar(
  dibayar: { qrisId: string; totalBayar: number },
  amount = dibayar.totalBayar,
) {
  bayarQrisTiruan(
    { qrisId: dibayar.qrisId, amount },
    { sekarang: new Date(PAID_AT) },
  );
}

/**
 * Membuat webhook memakai Qrispy sungguhan (QRISPY_MODE=sungguhan) yang fetch-nya diganti, sehingga cek status QRIS
 * itu dijawab dengan data itu dalam bentuk jawaban sungguhan (docs/referensi/qrispy-api.md bagian 4 dan 9). Qrispy
 * sungguhan tidak pernah dipanggil. Hasilnya fetch pengganti itu.
 */
function qrispySungguhanMenjawab(
  qrisId: string,
  data: Record<string, unknown>,
) {
  vi.stubEnv("QRISPY_MODE", "sungguhan");
  vi.stubEnv("QRISPY_BASE_URL", "https://qrispy.example");
  vi.stubEnv("QRISPY_API_TOKEN", "token-uji-bukan-token-asli");
  const fetchPengganti = vi.fn<typeof fetch>(async () =>
    Response.json({
      status: "success",
      data: { qris_id: qrisId, payment_reference: null, ...data },
    }),
  );
  vi.stubGlobal("fetch", fetchPengganti);
  return fetchPengganti;
}

/** Teks yang hanya ada di pesan yang masih menyebut bentuk referensi. */
const SEBUTAN_BENTUK_REFERENSI = /payment\.success|referensi|datar/;

// Issue T82 (ADR-0004 ▶ Keputusan 2026-11-22, docs/referensi/qrispy-api.md bagian 9): webhook hanya memicu cek
// status, dan nominal diterima serta waktu bayarnya diambil dari jawaban cek status, bukan dari received_amount.
describe("webhook Qrispy memicu cek status", () => {
  it('received_amount 1000 untuk Total bayar Rp 1.212, sedangkan cek status menjawab paid dengan amount "1212.00": Pesanan Selesai, dan Item stok yang ditahannya Terkirim', async () => {
    const dipesan = await checkout({
      hargaJual: 1000,
      qrispy: qrispyKodeUnik(212),
    });
    expect(dipesan.totalBayar).toBe(1212);
    const fetchQrispy = qrispySungguhanMenjawab(dipesan.qrisId, {
      payment_status: "paid",
      amount: "1212.00",
      paid_at: "2026-11-22T22:27:10+07:00",
    });
    const body = JSON.stringify(
      paymentReceived(dipesan, { amount: 1000, received_amount: 1000 }),
    );
    sadapLogBentuk();

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(fetchQrispy.mock.calls.map(([alamat]) => String(alamat))).toEqual([
      `https://qrispy.example/api/payment/qris/${dipesan.qrisId}/status`,
    ]);
    expect(await keadaan(dipesan)).toEqual({
      status: "Selesai",
      waktuBayar: new Date("2026-11-22T22:27:10+07:00"),
      itemStok: ["Terkirim"],
    });
  });

  // PRD §5.9 butir 2, dengan angka kasus "Nominal kurang" di tests/golden/hasil-kabar-pembayaran.json.
  it("cek status menjawab paid dengan amount Rp 45.000 untuk Total bayar Rp 45.123: Pesanan Bermasalah dan Item stok yang ditahannya dilepas, walaupun received_amount sama dengan Total bayar", async () => {
    const dipesan = await checkout({
      hargaJual: 45000,
      qrispy: qrispyKodeUnik(123),
    });
    expect(dipesan.totalBayar).toBe(45123);
    bayar(dipesan, 45000);
    const body = JSON.stringify(
      paymentReceived(dipesan, { received_amount: 45123 }),
    );
    sadapLogBentuk();

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual({
      status: "Bermasalah",
      waktuBayar: new Date(PAID_AT),
      itemStok: [],
    });
  });

  it("cek status yang masih pending: webhook dijawab 200, Pesanan tetap Menunggu Pembayaran, dan log mencatat bahwa cek statusnya menjawab pending", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentReceived(dipesan));
    sadapLogBentuk();
    const peringatan = vi.spyOn(console, "warn").mockImplementation(() => {});

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual(BELUM_DIBAYAR);
    expect(peringatan.mock.calls).toEqual([
      [expect.stringMatching(/cek status menjawab pending.*tidak diubah/)],
    ]);
  });

  it("cek status yang gagal, misalnya Qrispy menjawab 429: webhook dijawab 200, Pesanan tetap Menunggu Pembayaran, dan kegagalannya tercatat di log", async () => {
    const dipesan = await checkout();
    bayar(dipesan);
    const galatQrispy = new Error("Qrispy menolak cek status dengan HTTP 429.");
    vi.spyOn(qrispyTiruan, "cekStatusQris").mockRejectedValue(galatQrispy);
    const body = JSON.stringify(paymentReceived(dipesan));
    sadapLogBentuk();
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual(BELUM_DIBAYAR);
    expect(galat.mock.calls).toEqual([
      [
        expect.stringMatching(/cek status itu gagal.*tidak diubah/),
        galatQrispy,
      ],
    ]);
  });

  // ADR-0004 ▶ Keputusan 2026-11-22: cek dari webhook tidak menunggu giliran 15 detik jalur halaman bayar.
  it("webhook yang datang tepat setelah cek status halaman Pesanan tetap menanyakan status QRIS itu sendiri, lalu membuat Pesanan Selesai", async () => {
    const dipesan = await checkout();
    await cekStatusPembayaran(dipesan.tautan, { qrispy: qrispyTiruan });
    expect(await keadaan(dipesan)).toEqual(BELUM_DIBAYAR);
    bayar(dipesan);
    const cekStatus = vi.spyOn(qrispyTiruan, "cekStatusQris");
    const body = JSON.stringify(paymentReceived(dipesan));
    sadapLogBentuk();

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(cekStatus.mock.calls).toEqual([[dipesan.qrisId]]);
    expect(await keadaan(dipesan)).toEqual(SELESAI);
  });

  it("cek status dari webhook dicatat sebagai cek terakhir Pesanan itu, jadi cek status halaman Pesanan tepat sesudahnya tidak menanyakan Qrispy lagi", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentReceived(dipesan));
    sadapLogBentuk();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await kirimWebhook(body, signatureQrispy(body, "hex"));
    const cekStatus = vi.spyOn(qrispyTiruan, "cekStatusQris");

    await cekStatusPembayaran(dipesan.tautan, { qrispy: qrispyTiruan });

    expect(cekStatus).not.toHaveBeenCalled();
  });

  // ADR-0004 ▶ Keputusan 2026-11-22: baris ini memastikan arti received_amount pada pembayaran sungguhan berikutnya.
  it("webhook yang memicu cek status paid menulis satu baris log berisi received_amount dari webhook dan amount dari cek status, tanpa qris_id dan secret", async () => {
    const dipesan = await checkout({
      hargaJual: 1000,
      qrispy: qrispyKodeUnik(212),
    });
    bayar(dipesan);
    const body = JSON.stringify(
      paymentReceived(dipesan, { amount: 1000, received_amount: 1000 }),
    );
    const log = sadapLogBentuk();

    await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(log.mock.calls).toEqual([
      [
        'Webhook Qrispy diterima: bentuk dashboard, event "payment.received", signature hex.',
      ],
      [
        "Webhook Qrispy memicu cek status: received_amount 1000 dari webhook, amount 1212 dari cek status.",
      ],
    ]);
    for (const [baris] of log.mock.calls) {
      for (const rahasia of [
        dipesan.qrisId,
        RAHASIA,
        signatureQrispy(body, "hex"),
      ]) {
        expect(baris).not.toContain(rahasia);
      }
    }
  });

  it("payment.received untuk QRIS yang tidak dimiliki Pesanan atau Top up mana pun dijawab 200 tanpa menanyakan statusnya ke Qrispy", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(
      paymentReceived(dipesan, {
        qris_id: randomUUID(),
        payment_reference: undefined,
      }),
    );
    const cekStatus = vi.spyOn(qrispyTiruan, "cekStatusQris");
    sadapLogBentuk();
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(cekStatus).not.toHaveBeenCalled();
    expect(galat.mock.calls).toEqual([
      [expect.stringMatching(/diabaikan, karena tidak ada Pesanan/)],
    ]);
    expect(await keadaan(dipesan)).toEqual(BELUM_DIBAYAR);
  });
});

// Issue T17, T37, T38 dan ADR-0004: webhook Qrispy diperiksa signature-nya, lalu kabar pembayaran dalam
// bentuk dashboard memicu cek status, yang diteruskan ke pemroses kabar pembayaran yang sama dengan jalur cek status
// halaman Pesanan (T82). Pesanan yang harus Selesai dibayar dulu di Qrispy tiruan lewat bayar().
describe("webhook Qrispy POST /api/qrispy/webhook", () => {
  it("signature hex yang benar untuk Pesanan Menunggu Pembayaran yang sudah dibayar membuat Pesanan itu Selesai dengan waktu bayar dari cek status, dan Item stok yang ditahannya Terkirim", async () => {
    const dipesan = await checkout();
    bayar(dipesan);
    const body = JSON.stringify(paymentReceived(dipesan));

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual(SELESAI);
  });

  // ADR-0004: selama formatnya belum dipastikan, signature hex dan base64 sama-sama diterima.
  it("signature base64 yang benar juga diterima, dan membuat Pesanan Selesai", async () => {
    const dipesan = await checkout();
    bayar(dipesan);
    const body = JSON.stringify(paymentReceived(dipesan));

    const respons = await kirimWebhook(body, signatureQrispy(body, "base64"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual(SELESAI);
  });

  // ADR-0004: signature dihitung dari body mentah, bukan dari payload yang di-parse lalu ditulis ulang.
  it("body yang spasinya berbeda dari hasil JSON.stringify diterima bila signature-nya dihitung dari body itu, dan ditolak bila signature-nya dari hasil JSON.stringify", async () => {
    const dipesan = await checkout();
    bayar(dipesan);
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
    expect(await keadaan(dipesan)).toEqual(SELESAI);
  });

  // PRD §5.7: satu Pesanan hanya pernah mendapat satu Item stok, walaupun kabarnya datang berulang kali.
  it("webhook yang sama untuk QRIS yang sudah dibayar dikirim dua kali: keduanya dijawab 200, dan Pesanan tetap hanya punya satu Item stok", async () => {
    const dipesan = await checkout();
    bayar(dipesan);
    const body = JSON.stringify(paymentReceived(dipesan));
    const signature = signatureQrispy(body, "hex");

    const pertama = await kirimWebhook(body, signature);
    const kedua = await kirimWebhook(body, signature);

    expect([pertama.status, kedua.status]).toEqual([200, 200]);
    expect(await keadaan(dipesan)).toEqual(SELESAI);
  });

  // PRD §5.7 dan ADR-0004: webhook dan cek status memanggil pemroses kabar pembayaran yang sama, jadi
  // kabar untuk qris_id yang sama hanya diproses sekali, apa pun jalur yang lebih dulu sampai.
  it("webhook payment.received lalu cek status halaman Pesanan untuk qris_id yang sama: Pesanan Selesai, dan hanya punya satu Item stok", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentReceived(dipesan));
    bayar(dipesan);

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));
    await cekStatusPembayaran(dipesan.tautan, { qrispy: qrispyTiruan });

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual(SELESAI);
  });

  it("cek status paid lalu webhook payment.received untuk qris_id yang sama: webhook dijawab 200 tanpa perubahan, dan Pesanan hanya punya satu Item stok", async () => {
    const dipesan = await checkout();
    const body = JSON.stringify(paymentReceived(dipesan));
    bayar(dipesan);

    await cekStatusPembayaran(dipesan.tautan, { qrispy: qrispyTiruan });
    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(await keadaan(dipesan)).toEqual(SELESAI);
  });

  // ADR-0004: nominal dari Qrispy bisa berupa teks desimal, seperti di jawaban API (referensi bagian 9).
  // received_amount tetap diperiksa supaya bentuk dashboard dikenali, walaupun tidak lagi dipakai sebagai nominal.
  for (const [kasus, nominal] of [
    ["teks angka bulat", (d: Dipesan) => String(d.totalBayar)],
    ["teks desimal", (d: Dipesan) => `${d.totalBayar}.00`],
  ] as const) {
    it(`received_amount berupa ${kasus} diterima seperti angka: webhook memicu cek status, dan Pesanan Selesai`, async () => {
      const dipesan = await checkout();
      bayar(dipesan);
      const body = JSON.stringify(
        paymentReceived(dipesan, {
          amount: nominal(dipesan),
          received_amount: nominal(dipesan),
        }),
      );

      const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

      expect(respons.status).toBe(200);
      expect(await keadaan(dipesan)).toEqual(SELESAI);
    });
  }

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

/** Member baru dengan Top up Rp 10.000 Menunggu Pembayaran lewat Qrispy tiruan. */
async function topUpMenunggu() {
  const email = `budi-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  const [{ id: idMember }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  const hasil = await buatTopUp(
    { idMember, nominal: "10000" },
    { qrispy: qrispyTiruan },
  );
  if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);
  const [dibuat] = await db
    .select({
      id: topUp.id,
      nomorTopUp: topUp.nomorTopUp,
      qrisId: topUp.qrisId,
      kodeUnik: topUp.kodeUnik,
      totalBayar: topUp.totalBayar,
    })
    .from(topUp)
    .where(eq(topUp.nomorTopUp, hasil.nomorTopUp));
  return { ...dibuat, idMember };
}

type DiTopUp = Awaited<ReturnType<typeof topUpMenunggu>>;

/** Payload payment.received bentuk dashboard untuk Top up itu, dengan Nomor Top up sebagai payment_reference. */
function paymentReceivedTopUp(
  diTopUp: DiTopUp,
  data: Record<string, unknown> = {},
) {
  return {
    event: "payment.received",
    data: {
      qris_id: diTopUp.qrisId,
      amount: 10000,
      received_amount: diTopUp.totalBayar,
      payment_reference: diTopUp.nomorTopUp,
      paid_at: PAID_AT_DASHBOARD,
      unique_id: diTopUp.kodeUnik,
      ...data,
    },
  };
}

/** Status Top up itu, saldo Member-nya, dan baris Riwayat saldo-nya. */
async function keadaanTopUp(diTopUp: DiTopUp) {
  const [{ status }] = await db
    .select({ status: topUp.status })
    .from(topUp)
    .where(eq(topUp.id, diTopUp.id));
  const [{ saldo }] = await db
    .select({ saldo: user.saldo })
    .from(user)
    .where(eq(user.id, diTopUp.idMember));
  const riwayat = await db
    .select({ nominal: riwayatSaldo.nominal, rujukan: riwayatSaldo.rujukan })
    .from(riwayatSaldo)
    .where(eq(riwayatSaldo.userId, diTopUp.idMember));
  return { status, saldo, riwayatSaldo: riwayat };
}

// Issue T78 (PRD §15.5, ADR-0004): webhook untuk QRIS Top up dikenali dari awalan TOPUP- pada payment_reference, atau
// dari qris_id, lalu memicu cek status yang diteruskan ke pemroses kabar pembayaran Top up (T82).
describe("webhook Qrispy untuk Top up", () => {
  // ADR-0004 ▶ Keputusan 2026-11-22: kasus Pesanan Rp 1.212 di atas, untuk Top up.
  it("received_amount Rp 10.000 lebih kecil dari Total bayar, sedangkan cek status menjawab paid dengan amount sama dengan Total bayar: Top up Berhasil, dan saldo bertambah sebesar Nominal top up Rp 10.000", async () => {
    const diTopUp = await topUpMenunggu();
    bayar(diTopUp);
    const body = JSON.stringify(
      paymentReceivedTopUp(diTopUp, { received_amount: 10000 }),
    );
    sadapLogBentuk();

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect(await keadaanTopUp(diTopUp)).toEqual({
      status: "Berhasil",
      saldo: 10000,
      riwayatSaldo: [{ nominal: 10000, rujukan: diTopUp.nomorTopUp }],
    });
  });

  it("webhook yang sama untuk QRIS yang sudah dibayar dikirim dua kali bersamaan, lalu sekali lagi: semuanya dijawab 200, saldo bertambah Rp 10.000 satu kali, dan Riwayat saldo punya satu baris", async () => {
    const diTopUp = await topUpMenunggu();
    bayar(diTopUp);
    const body = JSON.stringify(paymentReceivedTopUp(diTopUp));
    sadapLogBentuk();

    const respons = await Promise.all([
      kirimWebhook(body, signatureQrispy(body, "hex")),
      kirimWebhook(body, signatureQrispy(body, "hex")),
    ]);
    respons.push(await kirimWebhook(body, signatureQrispy(body, "hex")));

    expect(respons.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await keadaanTopUp(diTopUp)).toEqual({
      status: "Berhasil",
      saldo: 10000,
      riwayatSaldo: [{ nominal: 10000, rujukan: diTopUp.nomorTopUp }],
    });
  });

  it("webhook tanpa payment_reference dikenali sebagai Top up dari qris_id-nya", async () => {
    const diTopUp = await topUpMenunggu();
    bayar(diTopUp);
    // payment_reference yang undefined tidak ikut ditulis JSON.stringify.
    const body = JSON.stringify(
      paymentReceivedTopUp(diTopUp, { payment_reference: undefined }),
    );
    expect(body).not.toContain("payment_reference");
    sadapLogBentuk();

    const respons = await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(respons.status).toBe(200);
    expect((await keadaanTopUp(diTopUp)).status).toBe("Berhasil");
  });

  // PRD §15.5 butir 2.
  it("cek status menjawab paid dengan amount Rp 10.000, kurang dari Total bayar: Top up Bermasalah tanpa mengubah saldo, walaupun received_amount sama dengan Total bayar", async () => {
    const diTopUp = await topUpMenunggu();
    bayar(diTopUp, 10000);
    const body = JSON.stringify(paymentReceivedTopUp(diTopUp));
    sadapLogBentuk();

    await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect(await keadaanTopUp(diTopUp)).toEqual({
      status: "Bermasalah",
      saldo: 0,
      riwayatSaldo: [],
    });
  });

  it("webhook untuk Pesanan yang payment_reference-nya Nomor Pesanan tetap diproses sebagai Pesanan", async () => {
    const dipesan = await checkout();
    bayar(dipesan);
    const body = JSON.stringify(paymentReceived(dipesan));
    sadapLogBentuk();

    await kirimWebhook(body, signatureQrispy(body, "hex"));

    expect((await keadaan(dipesan)).status).toBe("Selesai");
  });
});
