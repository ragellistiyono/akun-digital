import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dan QRISPY_WEBHOOK_SECRET berasal dari .env.ci yang dimuat playwright.config.ts, sama
// seperti server e2e. Data ini masuk ke database app_test.
import { nomorPesanan } from "../src/domain/nomor-pesanan";
import { db } from "../src/server/db";
import { itemStok, pesanan, varian } from "../src/server/db/schema";
import { isiItemStokUji, sisipkanProduk } from "../src/server/uji-katalog";

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

// Issue T17 dan ADR-0004: Qrispy mengirim webhook payment.success ke alamat yang didaftarkan pemilik di
// Dashboard Qrispy. Pesanan disiapkan langsung di database dengan QRIS yang tidak pernah dibayar di
// Qrispy tiruan, sehingga cek status saat halaman dibuka tetap menjawab pending, dan Pesanan hanya bisa
// Selesai lewat webhook.
test("webhook payment.success bersignature benar ke /api/qrispy/webhook membuat pil status di Tautan Pesanan menjadi Selesai", async ({
  page,
  request,
}) => {
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
  const secret = process.env.QRISPY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "QRISPY_WEBHOOK_SECRET kosong, jadi webhook uji tidak bisa ditandatangani. Isi QRISPY_WEBHOOK_SECRET di .env.ci, lalu jalankan ulang `pnpm test:e2e`.",
    );
  }
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const respons = await request.post("/api/qrispy/webhook", {
    headers: {
      "Content-Type": "application/json",
      "X-Qrispy-Signature": signature,
    },
    data: body,
  });
  expect(respons.status()).toBe(200);

  await page.goto(`/pesanan/${tautan}`);
  const isi = page.getByRole("main");
  await expect(isi.getByText("Selesai", { exact: true })).toBeVisible();
  await expect(isi.locator("svg.lucide-check")).toBeVisible();
});
