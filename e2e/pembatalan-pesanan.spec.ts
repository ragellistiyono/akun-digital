import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { asc, eq } from "drizzle-orm";

// DATABASE_URL berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database
// app_test. Server e2e memakai Qrispy tiruan dari .env.ci (QRISPY_MODE=tiruan), yang menerima pembatalan
// QRIS yang belum dibayar.
import { db } from "../src/server/db";
import { pesanan, riwayatStatusPesanan } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";

// Varian Netflix Premium dari persiapan bersama docs/UAT.md, bertanda [CONTOH], dengan nama lain dan
// akhiran unik per run, supaya tidak mengubah hasil pencarian "netflix" di cari-kategori-beranda.spec.ts
// yang berjalan bersamaan.
const akhiran = randomUUID().slice(0, 8);

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

const isi = (page: Page) => page.getByRole("main");

/** Stok Varian 1 Bulan yang tampil di kartu Varian-nya di Halaman Produk. */
const stokSatuBulan = (page: Page) =>
  page
    .getByRole("radiogroup", { name: "Pilih Varian" })
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: /^1 Bulan/ }) })
    .getByText(/^Stok \d+$/);

// UAT-E1 dan PRD §5.3, §5.8.
test("setelah Pembeli menekan Batalkan di Halaman bayar, Pesanan menjadi Dibatalkan dan Stok Varian kembali seperti semula", async ({
  page,
  browser,
}) => {
  const produkId = await sisipkanProduk({
    nama: `Pembatalan ${akhiran}`,
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, Tersedia: 10 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
    ],
  });

  // Langkah 1: catat Stok Varian 1 Bulan.
  await page.goto(`/produk/${produkId}`);
  await expect(stokSatuBulan(page)).toHaveText("Stok 10");

  // Langkah 2: checkout Varian itu sampai Halaman bayar.
  const email = `budi-${randomUUID()}@example.test`;
  await page
    .getByRole("radiogroup", { name: "Pilih Varian" })
    .locator("label")
    .filter({ hasText: "1 Bulan" })
    .click();
  await page.getByRole("button", { name: /^Beli/ }).click();
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();

  // Langkah 3: di browser lain, stoknya berkurang satu.
  const browserLain = await browser.newContext();
  const halamanLain = await browserLain.newPage();
  await halamanLain.goto(`/produk/${produkId}`);
  await expect(stokSatuBulan(halamanLain)).toHaveText("Stok 9");

  // Langkah 4: tekan "Batalkan", lalu lihat stoknya lagi.
  const tombol = isi(page).getByRole("button", { name: "Batalkan" });
  await expect(tombol).toBeVisible();
  await tombol.click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Pesanan" }),
  ).toBeVisible();
  await expect(
    isi(page).getByText("Dibatalkan", { exact: true }),
  ).toBeVisible();
  await expect(isi(page).locator("svg.lucide-circle-x")).toBeVisible();
  await expect(isi(page).getByRole("button", { name: "Batalkan" })).toHaveCount(
    0,
  );
  await halamanLain.reload();
  await expect(stokSatuBulan(halamanLain)).toHaveText("Stok 10");

  const [dibatalkan] = await db
    .select({ id: pesanan.id, status: pesanan.status })
    .from(pesanan)
    .where(eq(pesanan.email, email));
  expect(dibatalkan.status).toBe("Dibatalkan");
  expect(
    await db
      .select({
        status: riwayatStatusPesanan.status,
        pelaku: riwayatStatusPesanan.pelaku,
      })
      .from(riwayatStatusPesanan)
      .where(eq(riwayatStatusPesanan.pesananId, dibatalkan.id))
      .orderBy(asc(riwayatStatusPesanan.waktu)),
  ).toEqual([
    { status: "Menunggu Pembayaran", pelaku: "Pembeli" },
    { status: "Dibatalkan", pelaku: "Pembeli" },
  ]);
  await browserLain.close();
});

// docs/DESIGN.md Buttons dan prototipe Halaman bayar: "Batalkan" adalah tombol garis di bilah lekat, di
// samping "Simpan gambar QR".
test('di ponsel, tombol garis "Batalkan" menempel di bilah lekat di samping "Simpan gambar QR"', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const produkId = await sisipkanProduk({
    nama: `Pembatalan Bilah ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 3 }],
  });
  await page.goto(`/produk/${produkId}`);
  await page.getByRole("button", { name: /^Beli/ }).click();
  await page
    .getByRole("textbox", { name: "Email" })
    .fill(`budi-${randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);

  const bilah = page.locator("[data-bilah-lekat]");
  const batalkan = bilah.getByRole("button", { name: "Batalkan" });
  const simpan = bilah.getByRole("link", { name: "Simpan gambar QR" });
  await expect(batalkan).toBeInViewport({ ratio: 1 });
  await expect(simpan).toBeInViewport({ ratio: 1 });
  const kotakBatalkan = (await batalkan.boundingBox())!;
  const kotakSimpan = (await simpan.boundingBox())!;
  expect(kotakBatalkan.x + kotakBatalkan.width).toBeLessThan(kotakSimpan.x);
  // Teks kedua tombol tidak terpotong dan halaman tidak bisa digulir ke samping.
  for (const tombol of [batalkan, simpan]) {
    expect(
      await tombol.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

// Issue T20: pembatalan dengan token Tautan Pesanan yang salah ditolak di server, walaupun isian form di
// browser diubah. Pesan penolakannya tampil di bilah lekat tepat di atas tombol "Batalkan", sehingga
// terlihat di ponsel tanpa menggulir halaman.
test("pembatalan dengan Tautan Pesanan yang diubah di browser ditolak, pesannya tampil di atas tombol Batalkan, dan Pesanan tetap Menunggu Pembayaran", async ({
  page,
}) => {
  const produkId = await sisipkanProduk({
    nama: `Pembatalan Ditolak ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 3 }],
  });
  const email = `budi-${randomUUID()}@example.test`;
  await page.goto(`/produk/${produkId}`);
  await page.getByRole("button", { name: /^Beli/ }).click();
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);

  await page
    .locator('input[name="tautan"]')
    .evaluate((el: HTMLInputElement) => (el.value = "bukan-tautan"));
  const bilah = page.locator("[data-bilah-lekat]");
  await bilah.getByRole("button", { name: "Batalkan" }).click();

  const pesan = bilah.getByRole("alert");
  await expect(pesan).toHaveText(
    "Tautan Pesanan ini tidak dikenal, jadi tidak ada Pesanan yang dibatalkan. Buka lagi Pesanan Anda lewat Tautan Pesanan-nya, lalu tekan Batalkan.",
  );
  await expect(pesan).toBeInViewport({ ratio: 1 });
  const kotakPesan = (await pesan.boundingBox())!;
  const kotakTombol = (await bilah
    .getByRole("button", { name: "Batalkan" })
    .boundingBox())!;
  expect(kotakPesan.y + kotakPesan.height).toBeLessThanOrEqual(kotakTombol.y);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();
  const [dipesan] = await db
    .select({ status: pesanan.status })
    .from(pesanan)
    .where(eq(pesanan.email, email));
  expect(dipesan.status).toBe("Menunggu Pembayaran");
});
