import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { asc, eq } from "drizzle-orm";

// DATABASE_URL berasal dari .env.ci yang dimuat playwright.config.ts, jadi data dan pekerjaan latar ini
// masuk ke database app_test. Pekerja pg-boss berjalan di server e2e (src/instrumentation.ts) dengan Qrispy
// tiruan dari .env.ci (QRISPY_MODE=tiruan), yang menjawab QRIS yang belum dibayar dengan `pending`.
import { db } from "../src/server/db";
import { pesanan, riwayatStatusPesanan, varian } from "../src/server/db/schema";
import { jadwalkanKedaluwarsaPesanan } from "../src/server/pekerjaan-latar";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

// Produk bertanda [CONTOH] dengan akhiran unik per run. Namanya bukan Netflix, supaya tidak mengubah hasil
// pencarian "netflix" di cari-kategori-beranda.spec.ts yang berjalan bersamaan.
const akhiran = randomUUID().slice(0, 8);

// Koneksi database dan pg-boss tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

const isi = (page: Page) => page.getByRole("main");

/** Stok Varian yang tampil di Halaman Produk yang hanya punya satu Varian. */
const stokVarian = (page: Page) => isi(page).getByText(/^Stok \d+$/);

// UAT-E4 dan PRD §5.3, §5.8. Masa berlaku QRIS tiruan 15 menit, jadi Pesanan Menunggu Pembayaran disiapkan
// langsung di database dengan waktu kedaluwarsa beberapa detik lagi, lalu pekerjaan kedaluwarsanya
// dijadwalkan seperti saat checkout.
test("Pesanan yang tidak dibayar menjadi Kedaluwarsa di Halaman bayar begitu waktunya tercapai, dan Stok Varian kembali", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const produkId = await sisipkanProduk({
    nama: `Kedaluwarsa ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 3 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const kedaluwarsaPada = new Date(Date.now() + 10_000);
  const dipesan = await sisipkanPesanan({
    varianId,
    status: "Menunggu Pembayaran",
    itemStok: { status: "Ditahan", nilai: ["Kode uji ditahan"] },
    kedaluwarsaPada,
  });
  await jadwalkanKedaluwarsaPesanan({ pesananId: dipesan.id, kedaluwarsaPada });

  // Selama Pesanan menunggu, satu Item stok ditahan, jadi Stok Varian 3.
  await page.goto(`/produk/${produkId}`);
  await expect(stokVarian(page)).toHaveText("Stok 3");

  await page.goto(`/pesanan/${dipesan.tautan}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();

  // Halaman bayar menanyakan status setiap 5 detik, lalu berpindah sendiri ke Halaman Pesanan.
  await expect(
    page.getByRole("heading", { level: 1, name: "Pesanan" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    isi(page).getByText("Kedaluwarsa", { exact: true }),
  ).toBeVisible();

  // Item stok yang ditahan kembali Tersedia.
  await page.goto(`/produk/${produkId}`);
  await expect(stokVarian(page)).toHaveText("Stok 4");

  const [kedaluwarsa] = await db
    .select({ status: pesanan.status })
    .from(pesanan)
    .where(eq(pesanan.id, dipesan.id));
  expect(kedaluwarsa.status).toBe("Kedaluwarsa");
  expect(
    await db
      .select({
        status: riwayatStatusPesanan.status,
        pelaku: riwayatStatusPesanan.pelaku,
      })
      .from(riwayatStatusPesanan)
      .where(eq(riwayatStatusPesanan.pesananId, dipesan.id))
      .orderBy(asc(riwayatStatusPesanan.waktu)),
  ).toEqual([{ status: "Kedaluwarsa", pelaku: "Sistem" }]);
});
