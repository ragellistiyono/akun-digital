import { randomBytes, randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database
// app_test. Server e2e memakai Qrispy tiruan dari .env.ci (QRISPY_MODE=tiruan), yang pemicu bayarnya
// ada di POST /api/qrispy-tiruan/bayar.
import { nomorPesanan } from "../src/domain/nomor-pesanan";
import { db } from "../src/server/db";
import { itemStok, pesanan, varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";

// Produk bertanda [CONTOH] dengan akhiran unik per run. Namanya bukan Netflix, supaya tidak mengubah
// hasil pencarian "netflix" di cari-kategori-beranda.spec.ts yang berjalan bersamaan.
const akhiran = randomUUID().slice(0, 8);
const emailUnik = () => `budi-${randomUUID()}@example.test`;

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

// ADR-0004 dan issue T16: cek status ke Qrispy dipicu saat halaman di Tautan Pesanan dimuat, dan pil
// status menampilkan status terkini.
test("setelah Total bayar dibayar lewat Qrispy tiruan, pil status di Tautan Pesanan menjadi Selesai", async ({
  page,
  request,
}) => {
  // Halaman bayar menanyakan status saat dibuka, jadi cek berikutnya baru terjadi 15 detik kemudian.
  test.setTimeout(60_000);
  const id = await sisipkanProduk({
    nama: `Bayar Tiruan ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 3 }],
  });
  const email = emailUnik();
  await page.goto(`/produk/${id}`);
  await page.getByRole("button", { name: /^Beli/ }).click();
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  const isi = page.getByRole("main");
  await expect(
    isi.getByText("Menunggu Pembayaran", { exact: true }),
  ).toBeVisible();

  const [dipesan] = await db
    .select({ qrisId: pesanan.qrisId, totalBayar: pesanan.totalBayar })
    .from(pesanan)
    .where(eq(pesanan.email, email));
  const respons = await request.post("/api/qrispy-tiruan/bayar", {
    data: { qrisId: dipesan.qrisId, amount: dipesan.totalBayar },
  });
  expect(respons.status()).toBe(200);

  await expect(async () => {
    await page.reload();
    await expect(isi.getByText("Selesai", { exact: true })).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 30_000, intervals: [2_000] });
  await expect(isi.locator("svg.lucide-check")).toBeVisible();
  await expect(
    isi.getByText("Menunggu Pembayaran", { exact: true }),
  ).toHaveCount(0);
  // QRIS Pesanan yang sudah dibayar tidak ditampilkan lagi.
  await expect(isi.getByRole("img", { name: /^QRIS Pesanan/ })).toHaveCount(0);
});

// PRD §5.9 butir 2. Pesanan Menunggu Pembayaran disiapkan langsung di database, supaya cek status
// pertama terjadi saat halamannya dibuka setelah pembayaran dipicu.
test("nominal kurang dari Total bayar membuat pil status di Tautan Pesanan menjadi Bermasalah", async ({
  page,
  request,
}) => {
  const produkId = await sisipkanProduk({
    nama: `Bayar Kurang ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 45000, Tersedia: 3 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const tautan = randomBytes(32).toString("base64url");
  const qrisId = randomUUID();
  const [{ id }] = await db
    .insert(pesanan)
    .values({
      nomorPesanan: nomorPesanan(randomBytes(6)),
      tautan,
      email: emailUnik(),
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
    isiTerenkripsi: "isi-uji",
    sidikJari: randomUUID(),
  });

  const respons = await request.post("/api/qrispy-tiruan/bayar", {
    data: { qrisId, amount: 45000 },
  });
  expect(respons.status()).toBe(200);
  await page.goto(`/pesanan/${tautan}`);

  const isi = page.getByRole("main");
  await expect(isi.getByText("Bermasalah", { exact: true })).toBeVisible();
  await expect(isi.locator("svg.lucide-triangle-alert")).toBeVisible();
});
