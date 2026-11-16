import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { type APIRequestContext, expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dan QRISPY_WEBHOOK_SECRET berasal dari .env.ci yang dimuat playwright.config.ts, sama
// seperti server e2e. Data ini masuk ke database app_test.
import { nomorPesanan } from "../src/domain/nomor-pesanan";
import { db } from "../src/server/db";
import { itemStok, pesanan, varian } from "../src/server/db/schema";
import { isiItemStokUji, sisipkanProduk } from "../src/server/uji-katalog";

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

/**
 * Pesanan Menunggu Pembayaran Canva Pro 1 Bulan Rp 45.000 [CONTOH] dengan Kode unik 123 dan Total bayar
 * Rp 45.123, yang menahan satu Item stok. Pesanan disiapkan langsung di database dengan QRIS yang tidak
 * pernah dibayar di Qrispy tiruan, sehingga cek status saat halaman dibuka tetap menjawab pending, dan
 * Pesanan hanya bisa Selesai lewat webhook.
 */
async function siapkanPesanan() {
  // Produk Canva Pro [CONTOH] dengan akhiran unik per run.
  const produkId = await sisipkanProduk({
    nama: `Canva Pro ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 45000, Tersedia: 3 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const tautan = randomBytes(32).toString("base64url");
  const qrisId = randomUUID();
  const nomor = nomorPesanan(randomBytes(6));
  const [{ id }] = await db
    .insert(pesanan)
    .values({
      nomorPesanan: nomor,
      tautan,
      email: `budi-${randomUUID()}@example.test`,
      varianId,
      hargaJual: 45000,
      potonganVoucher: 0,
      kodeUnik: 123,
      totalBayar: 45123,
      qrisId,
      kedaluwarsaPada: new Date(Date.now() + 15 * 60 * 1000),
      gambarQr: "data:image/png;base64,iVBORw0KGgo=",
      status: "Menunggu Pembayaran",
    })
    .returning({ id: pesanan.id });
  await db.insert(itemStok).values({
    varianId,
    status: "Ditahan",
    pesananId: id,
    // Item stok yang Terkirim tampil di halaman Pesanan Selesai, jadi isinya harus bisa dibuka.
    ...isiItemStokUji([`Kode uji ${randomUUID()}`]),
  });
  return { tautan, qrisId, nomor };
}

/** Mengirim body itu ke /api/qrispy/webhook dengan signature hex seperti yang dikirim Qrispy. */
async function kirimWebhook(request: APIRequestContext, body: string) {
  const secret = process.env.QRISPY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "QRISPY_WEBHOOK_SECRET kosong, jadi webhook uji tidak bisa ditandatangani. Isi QRISPY_WEBHOOK_SECRET di .env.ci, lalu jalankan ulang `pnpm test:e2e`.",
    );
  }
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return request.post("/api/qrispy/webhook", {
    headers: {
      "Content-Type": "application/json",
      "X-Qrispy-Signature": signature,
    },
    data: body,
  });
}

// Issue T37, T38 dan ADR-0004: Qrispy mengirim kabar pembayaran dalam bentuk dashboard, yaitu event
// payment.received dengan field di dalam data, seperti contoh di docs/referensi/qrispy-api.md bagian 6.
// Nominal diterima-nya received_amount, yang di sini sama dengan Total bayar.
test("webhook payment.received bentuk dashboard bersignature benar ke /api/qrispy/webhook membuat pil status di Tautan Pesanan menjadi Selesai", async ({
  page,
  request,
}) => {
  const { tautan, qrisId, nomor } = await siapkanPesanan();

  const body = JSON.stringify({
    event: "payment.received",
    data: {
      qris_id: qrisId,
      amount: 45000,
      received_amount: 45123,
      payment_reference: nomor,
      paid_at: new Date().toISOString().replace("Z", "+00:00"),
      unique_id: 123,
    },
  });
  const respons = await kirimWebhook(request, body);
  expect(respons.status()).toBe(200);

  await page.goto(`/pesanan/${tautan}`);
  const isi = page.getByRole("main");
  await expect(isi.getByText("Selesai", { exact: true })).toBeVisible();
  await expect(isi.locator("svg.lucide-check")).toBeVisible();
});

// Issue T38 dan ADR-0004: bentuk referensi dari dokumentasi publik tidak lagi diproses, jadi
// payment.success dijawab 200 seperti event lain yang tidak dikenal, dan Pesanan tidak berubah.
test("webhook payment.success berfield datar bersignature benar dijawab 200, dan pil status di Tautan Pesanan tetap Menunggu Pembayaran", async ({
  page,
  request,
}) => {
  const { tautan, qrisId, nomor } = await siapkanPesanan();

  const body = JSON.stringify({
    event: "payment.success",
    qris_id: qrisId,
    amount: 45123,
    requested_amount: 45000,
    unique_id: 123,
    payment_reference: nomor,
    paid_at: new Date().toISOString(),
    merchant_id: 42,
  });
  const respons = await kirimWebhook(request, body);
  expect(respons.status()).toBe(200);

  await page.goto(`/pesanan/${tautan}`);
  const isi = page.getByRole("main");
  await expect(
    isi.getByText("Menunggu Pembayaran", { exact: true }),
  ).toBeVisible();
  await expect(isi.getByText("Selesai", { exact: true })).toHaveCount(0);
});

// Issue T38 dan ADR-0004: tombol Test Webhook di Dashboard Qrispy mengirim webhook uji payment.test,
// persis seperti contoh di docs/referensi/qrispy-api.md bagian 6. qris_id-nya tidak dimiliki Pesanan mana
// pun, dan toko menjawabnya 200 tanpa mengubah apa pun.
test("webhook uji payment.test dari tombol Test Webhook bersignature benar dijawab 200", async ({
  request,
}) => {
  const body = `{
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
  const respons = await kirimWebhook(request, body);

  expect(respons.status()).toBe(200);
  expect(
    await db
      .select({ id: pesanan.id })
      .from(pesanan)
      .where(eq(pesanan.qrisId, "test-a62c12ad-56f1-4a90-aa40-cc588327aebe")),
  ).toEqual([]);
});
