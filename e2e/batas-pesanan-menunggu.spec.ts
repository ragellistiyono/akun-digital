import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database
// app_test. Server e2e memakai Qrispy tiruan dari .env.ci (QRISPY_MODE=tiruan).
import { db } from "../src/server/db";
import { pesanan } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";

// Uji Bayar dan Netflix Premium dari persiapan bersama docs/UAT.md, bertanda [CONTOH], dengan akhiran unik
// per run. Netflix Premium diganti nama lain, supaya tidak mengubah hasil pencarian "netflix" di
// cari-kategori-beranda.spec.ts yang berjalan bersamaan.
const akhiran = randomUUID().slice(0, 8);

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

const POLA_TAUTAN_PESANAN = /\/pesanan\/([A-Za-z0-9_-]{43})$/;

/** Pesan PRD §5.4 ▶ Keputusan 2026-11-11, dengan jam kedaluwarsa "HH.MM" dalam WIB. */
const POLA_PESAN_PESANAN_MENUNGGU =
  /^Email ini masih punya Pesanan yang menunggu pembayaran sampai pukul \d{2}\.\d{2} WIB\. Lanjutkan dari perangkat tempat Anda memesan, atau checkout lagi setelah waktu itu\.$/;

/** Membuka form checkout Produk itu dari Halaman Produk, lalu menekan "Bayar dengan QRIS" dengan email itu. */
async function checkout(page: Page, produkId: string, email: string) {
  await page.goto(`/produk/${produkId}`);
  await page.getByRole("button", { name: /^Beli/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Checkout" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();
}

/** Menunggu Halaman bayar terbuka, lalu mengembalikan Tautan Pesanan di alamatnya. */
async function halamanBayar(page: Page) {
  await expect(page).toHaveURL(POLA_TAUTAN_PESANAN);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();
  return POLA_TAUTAN_PESANAN.exec(page.url())![1];
}

const statusPesananDenganEmail = (email: string) =>
  db
    .select({ status: pesanan.status })
    .from(pesanan)
    .where(eq(pesanan.email, email));

// UAT-E2 dan PRD §5.4 ▶ Keputusan 2026-11-11, §7.4.
test("satu email hanya punya satu Pesanan menunggu: browser pembuatnya diarahkan ke Pesanan itu, browser lain ditolak tanpa tautan", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const ujiBayar = await sisipkanProduk({
    nama: `Uji Bayar ${akhiran}`,
    varian: [{ nama: "Uji", hargaJual: 1000, Tersedia: 10 }],
  });
  const premium = await sisipkanProduk({
    nama: `Premium Satu Email ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 10 }],
  });
  const emailA = `budi-${randomUUID()}@example.test`;

  // Langkah 1: checkout Uji Bayar dengan Email A sampai Halaman bayar.
  await checkout(page, ujiBayar, emailA);
  const tautan = await halamanBayar(page);

  // Langkah 2: di tab baru browser yang sama, checkout dengan Email A yang ditulis huruf besar. Pembeli
  // diarahkan ke Pesanan Email A yang masih menunggu, dengan pilihan untuk membatalkannya.
  const tabBaru = await context.newPage();
  await checkout(tabBaru, premium, emailA.toUpperCase());
  expect(await halamanBayar(tabBaru)).toBe(tautan);
  await expect(
    tabBaru.getByRole("main").getByText(`Uji Bayar ${akhiran}`),
  ).toBeVisible();
  await expect(
    tabBaru.getByRole("main").getByRole("button", { name: "Batalkan" }),
  ).toBeVisible();
  await tabBaru.close();

  // Langkah 3: di browser lain, checkout dengan Email A ditolak dengan pesan berisi jam kedaluwarsanya,
  // tanpa tautan ke Pesanan itu dan tanpa tombol batal.
  const browserLain = await browser.newContext({ baseURL });
  try {
    const halamanLain = await browserLain.newPage();
    await checkout(halamanLain, premium, emailA);

    const isi = halamanLain.getByRole("main");
    await expect(isi.getByRole("alert")).toHaveText(
      POLA_PESAN_PESANAN_MENUNGGU,
    );
    await expect(halamanLain).toHaveURL(/\/checkout\?varianId=/);
    await expect(halamanLain.locator('a[href*="/pesanan/"]')).toHaveCount(0);
    await expect(isi.getByRole("button", { name: "Batalkan" })).toHaveCount(0);
    expect(await halamanLain.content()).not.toContain(tautan);
    expect(await statusPesananDenganEmail(emailA)).toEqual([
      { status: "Menunggu Pembayaran" },
    ]);

    // Langkah 4: batalkan Pesanan Email A dari browser pertama. Setelah itu Email A bisa checkout lagi
    // dari browser lain.
    await page
      .getByRole("main")
      .getByRole("button", { name: "Batalkan" })
      .click();
    await expect(
      page.getByRole("main").getByText("Dibatalkan", { exact: true }),
    ).toBeVisible();

    await checkout(halamanLain, premium, emailA);
    expect(await halamanBayar(halamanLain)).not.toBe(tautan);
    expect(await statusPesananDenganEmail(emailA)).toEqual(
      expect.arrayContaining([
        { status: "Dibatalkan" },
        { status: "Menunggu Pembayaran" },
      ]),
    );
  } finally {
    await browserLain.close();
  }
});
