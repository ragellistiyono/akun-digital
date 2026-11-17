import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dan ITEM_STOK_KEY berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk
// ke database app_test dan Item stok-nya dienkripsi dengan kunci uji.
import type { StatusPesanan } from "../src/domain/status-pesanan";
import { db } from "../src/server/db";
import { varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

// Riwayat Pesanan Member di tab Riwayat (T45, PRD §7.4, DESIGN.md Status Pesanan). Pendaftaran tidak
// diuji di sini, jadi Member terverifikasi ditulis langsung ke database.

const akhiran = randomUUID().slice(0, 8);
const NAMA_PRODUK = `Riwayat Member ${akhiran}`;
const PASSWORD_MEMBER = "sandi-uji-member-123";
let varianId = "";

test.beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: NAMA_PRODUK,
    formatItemStok: ["Kode"],
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
});

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

const isi = (page: Page) => page.getByRole("main");
const daftarRiwayat = (page: Page) =>
  isi(page).getByRole("list", { name: "Riwayat Pesanan" });
const barisRiwayat = (page: Page) => daftarRiwayat(page).getByRole("listitem");

/** Member baru dengan email unik, yang langsung login lewat halaman Masuk dan dibawa ke Riwayat Pesanan. */
async function masukSebagaiMemberBaru(page: Page) {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");
  return email;
}

/** Pesanan beremail itu dengan status itu, dibuat pada waktu itu. */
const pesananPada = (
  email: string,
  status: StatusPesanan,
  dibuatPada: string,
  itemStok?: Parameters<typeof sisipkanPesanan>[0]["itemStok"],
) =>
  sisipkanPesanan({
    varianId,
    status,
    email,
    dibuatPada: new Date(dibuatPada),
    itemStok,
  });

// UAT-G1 hasil 3 dan UAT-G7 langkah 2.
test("Member melihat Pesanan semua status miliknya, termasuk Pesanan Tamu dengan email huruf besar, terbaru di atas, tanpa Pesanan email lain", async ({
  page,
}) => {
  const email = await masukSebagaiMemberBaru(page);
  const kembali = await pesananPada(
    email,
    "Dana Dikembalikan",
    "2026-11-02T21:10:00+07:00",
  );
  const batal = await pesananPada(
    email,
    "Dibatalkan",
    "2026-11-08T13:22:00+07:00",
  );
  const kedaluwarsa = await pesananPada(
    email,
    "Kedaluwarsa",
    "2026-11-09T08:40:00+07:00",
  );
  const masalah = await pesananPada(
    email,
    "Bermasalah",
    "2026-11-10T22:05:00+07:00",
  );
  const menunggu = await pesananPada(
    email,
    "Menunggu Pembayaran",
    "2026-11-11T19:52:00+07:00",
  );
  const selesaiTamu = await pesananPada(
    email.toUpperCase(),
    "Selesai",
    "2026-11-11T20:14:00+07:00",
  );
  const lain = await pesananPada(
    `lain-${randomUUID()}@example.test`,
    "Selesai",
    "2026-11-12T10:00:00+07:00",
  );

  await page.reload();

  const baris = barisRiwayat(page);
  await expect(baris).toHaveCount(6);
  const urutan = [
    [selesaiTamu, "Selesai"],
    [menunggu, "Menunggu Pembayaran"],
    [masalah, "Bermasalah"],
    [kedaluwarsa, "Kedaluwarsa"],
    [batal, "Dibatalkan"],
    [kembali, "Dana Dikembalikan"],
  ] as const;
  for (const [i, [dipesan, status]] of urutan.entries()) {
    await expect(baris.nth(i)).toContainText(dipesan.nomorPesanan);
    await expect(baris.nth(i)).toContainText(status);
  }
  await expect(daftarRiwayat(page)).not.toContainText(lain.nomorPesanan);

  // Baris Riwayat (DESIGN.md Status Pesanan): pil status, Total bayar, Produk dan Varian, lalu Nomor
  // Pesanan dalam mono 13 px diikuti tanggal WIB.
  const pertama = baris.first();
  await expect(pertama).toContainText("Rp 45.123");
  await expect(pertama).toContainText(`${NAMA_PRODUK} · 1 Bulan`);
  await expect(pertama).toContainText("11 Nov 2026 20.14 WIB");
  const nomorPesanan = pertama.getByText(selesaiTamu.nomorPesanan, {
    exact: true,
  });
  await expect(nomorPesanan).toHaveCSS("font-size", "13px");
  expect(
    await nomorPesanan.evaluate((el) => getComputedStyle(el).fontFamily),
  ).toMatch(/JetBrains Mono/i);
});

// PRD §7.4 ▶ Keputusan 2026-11-17, UAT-G7 langkah 2.
test("baris Pesanan Selesai membuka Halaman Pesanan dengan Item stok dan tombol Salin", async ({
  page,
}) => {
  const email = await masukSebagaiMemberBaru(page);
  const { tautan } = await pesananPada(
    email,
    "Selesai",
    "2026-11-11T20:14:00+07:00",
    {
      status: "Terkirim",
      nilai: ["KODE-RIWAYAT-1"],
      formatSaatTerkirim: ["Kode"],
    },
  );
  await page.reload();

  await barisRiwayat(page).first().getByRole("link").click();

  await expect(page).toHaveURL(`/pesanan/${tautan}`);
  const blokItemStok = isi(page).getByRole("region", {
    name: "Item stok Anda",
  });
  await expect(blokItemStok).toContainText("KODE-RIWAYAT-1");
  await expect(
    blokItemStok.getByRole("button", { name: "Salin Kode" }),
  ).toBeVisible();
});

test('baris Pesanan Menunggu Pembayaran membuka Halaman bayar dengan tombol "Batalkan"', async ({
  page,
}) => {
  const email = await masukSebagaiMemberBaru(page);
  const { tautan } = await pesananPada(
    email,
    "Menunggu Pembayaran",
    new Date().toISOString(),
  );
  await page.reload();

  await barisRiwayat(page).first().getByRole("link").click();

  await expect(page).toHaveURL(`/pesanan/${tautan}`);
  await expect(page.getByRole("button", { name: "Batalkan" })).toBeVisible();
});

test('Riwayat Pesanan Member tanpa Pesanan berbunyi "Belum ada Pesanan dengan email ini."', async ({
  page,
}) => {
  await masukSebagaiMemberBaru(page);

  await expect(
    isi(page).getByText("Belum ada Pesanan dengan email ini.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(daftarRiwayat(page)).toHaveCount(0);
});

// PRD §11.1.
test("di lebar 360 px, Riwayat Pesanan dengan nama Produk dan Varian yang panjang tidak bisa digulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const email = await masukSebagaiMemberBaru(page);
  const produkId = await sisipkanProduk({
    nama: `Produk Dengan Nama Yang Sangat Panjang Sekali ${"Premium".repeat(6)} ${akhiran}`,
    varian: [{ nama: `Varian${"Panjang".repeat(8)}`, hargaJual: 1500000 }],
  });
  const [{ id: varianPanjang }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  await sisipkanPesanan({
    varianId: varianPanjang,
    status: "Menunggu Pembayaran",
    email,
    dibuatPada: new Date(),
    rincian: {
      hargaJual: 1500000,
      potonganVoucher: 0,
      kodeUnik: 499,
      totalBayar: 1500499,
    },
  });
  await page.reload();
  await expect(barisRiwayat(page)).toHaveCount(1);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});
