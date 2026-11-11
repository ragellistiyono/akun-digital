import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

// Bahan test bersama. DATABASE_URL dan UPLOAD_DIR berasal dari .env.ci yang dimuat playwright.config.ts,
// jadi data ini masuk ke database app_test dan folder unggahan test.
import { koneksi } from "../src/server/db";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { FOLDER_UNGGAHAN_TEST, PNG } from "../src/server/uji-unggahan";

// Data persiapan bersama docs/UAT.md, yang bertanda [CONTOH], dengan akhiran unik per run supaya
// Produk dari test lain di app_test tidak mengganggu asersi.
const akhiran = randomUUID().slice(0, 8);
const NAMA = {
  netflix: `Netflix Premium ${akhiran}`,
  youtube: `YouTube Premium ${akhiran}`,
  spotify: `Spotify Premium ${akhiran}`,
  ujiBayar: `Uji Bayar ${akhiran}`,
  gameLama: `Game Lama ${akhiran}`,
  // tests/golden/harga-kartu-produk.json, kasus "Varian nonaktif lebih murah diabaikan".
  varianNonaktif: `Disney Plus ${akhiran}`,
  // Nama panjang dan Harga normal yang sangat besar (tanpa batas maksimum, PRD §3.2) untuk menguji
  // lebar 360 px.
  panjang: `Langganan Keluarga Premium Sepanjang Tahun Tanpa Iklan ${akhiran}`,
};
const fotoNetflix = `${randomUUID()}.png`;
let idNetflix = "";

test.beforeAll(async () => {
  await mkdir(FOLDER_UNGGAHAN_TEST, { recursive: true });
  await writeFile(path.join(FOLDER_UNGGAHAN_TEST, fotoNetflix), PNG);

  idNetflix = await sisipkanProduk({
    nama: NAMA.netflix,
    unggulan: true,
    foto: [fotoNetflix],
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, hargaNormal: 75000, Tersedia: 10 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
    ],
  });
  await sisipkanProduk({
    nama: NAMA.youtube,
    varian: [
      { nama: "1 Bulan", hargaJual: 20000 },
      { nama: "3 Bulan", hargaJual: 55000, Tersedia: 3 },
    ],
  });
  await sisipkanProduk({
    nama: NAMA.spotify,
    varian: [{ nama: "1 Bulan", hargaJual: 25000 }],
  });
  await sisipkanProduk({
    nama: NAMA.ujiBayar,
    varian: [{ nama: "Uji", hargaJual: 1000, Tersedia: 10 }],
  });
  await sisipkanProduk({
    nama: NAMA.gameLama,
    aktif: false,
    varian: [{ nama: "1 Bulan", hargaJual: 15000, Tersedia: 2 }],
  });
  await sisipkanProduk({
    nama: NAMA.varianNonaktif,
    varian: [
      { nama: "Promo", hargaJual: 10000, aktif: false, Tersedia: 9 },
      { nama: "1 Bulan", hargaJual: 50000, Tersedia: 2 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 1 },
    ],
  });
  await sisipkanProduk({
    nama: NAMA.panjang,
    unggulan: true,
    varian: [
      {
        nama: "Keluarga 12 Bulan",
        hargaJual: 499000,
        hargaNormal: 9_000_000_000_000_000,
      },
    ],
  });
});

test.afterAll(async () => {
  await koneksi.end();
});

const bagian = (page: Page, nama: "Produk Unggulan" | "Semua Produk") =>
  page.getByRole("region", { name: nama });

const kartu = (page: Page, nama: string) =>
  bagian(page, "Semua Produk").getByRole("link").filter({ hasText: nama });

const bisaDigulirKeSamping = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );

test.use({ viewport: { width: 390, height: 800 } });

test("dengan data UAT-C5, kartu Produk menampilkan harga sesuai PRD §3.8", async ({
  page,
}) => {
  await page.goto("/");

  const netflix = kartu(page, NAMA.netflix);
  await expect(netflix).toContainText("Mulai Rp 50.000");
  // Harga normal dan Hemat dari Varian sumber harga, yaitu 1 Bulan (DESIGN.md).
  await expect(netflix.locator("s")).toHaveText("Harga normal Rp 75.000");
  await expect(netflix.getByText("Hemat 33%", { exact: true })).toBeVisible();

  const youtube = kartu(page, NAMA.youtube);
  await expect(youtube).toContainText("Mulai Rp 55.000");
  await expect(youtube.getByText("Habis", { exact: true })).toHaveCount(0);

  const ujiBayar = kartu(page, NAMA.ujiBayar);
  await expect(ujiBayar).toContainText("Rp 1.000");
  await expect(ujiBayar).not.toContainText("Mulai");

  const spotify = kartu(page, NAMA.spotify);
  await expect(spotify.getByText("Habis", { exact: true })).toBeVisible();
  await expect(spotify).toContainText("Rp 25.000");
  await expect(spotify).not.toContainText("Mulai");
});

test("kartu Produk menaut ke Halaman Produk dan menampilkan foto sampul", async ({
  page,
}) => {
  await page.goto("/");

  const netflix = kartu(page, NAMA.netflix);
  await expect(netflix).toHaveAttribute("href", `/produk/${idNetflix}`);
  const foto = netflix.locator("img");
  await expect(foto).toHaveAttribute("src", `/unggahan/${fotoNetflix}`);
  // Foto kartu dimuat malas (loading="lazy"), jadi kartunya digulir ke layar dulu.
  await netflix.scrollIntoViewIfNeeded();
  await expect
    .poll(() => foto.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
});

test("Produk nonaktif tidak tampil, dan Varian nonaktif tidak ikut menentukan harga", async ({
  page,
}) => {
  await page.goto("/");

  await expect(kartu(page, NAMA.netflix)).toBeVisible();
  await expect(page.getByText(NAMA.gameLama)).toHaveCount(0);
  await expect(kartu(page, NAMA.varianNonaktif)).toContainText(
    "Mulai Rp 50.000",
  );
});

test("Produk Unggulan tampil di bagian Produk Unggulan, sebelum semua Produk", async ({
  page,
}) => {
  await page.goto("/");

  const unggulan = bagian(page, "Produk Unggulan");
  await expect(
    unggulan.getByRole("link").filter({ hasText: NAMA.netflix }),
  ).toBeVisible();
  await expect(
    unggulan.getByRole("link").filter({ hasText: NAMA.spotify }),
  ).toHaveCount(0);
  // Produk Unggulan tetap termasuk semua Produk aktif (PRD §3.6).
  await expect(kartu(page, NAMA.netflix)).toBeVisible();

  const atas = async (nama: "Produk Unggulan" | "Semua Produk") =>
    (await bagian(page, nama).boundingBox())!.y;
  expect(await atas("Produk Unggulan")).toBeLessThan(
    await atas("Semua Produk"),
  );
});

test("di layar lebar, kartu Produk Unggulan menampilkan daftar Varian dengan Harga normal dicoret atau label Habis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const daftar = bagian(page, "Produk Unggulan").getByRole("list", {
    name: `Varian ${NAMA.netflix}`,
  });
  await expect(daftar.getByRole("listitem")).toHaveText([
    "1 BulanHarga normal Rp 75.000Rp 50.000",
    "3 BulanRp 135.000",
  ]);

  const daftarHabis = bagian(page, "Produk Unggulan").getByRole("list", {
    name: `Varian ${NAMA.panjang}`,
  });
  await expect(daftarHabis.getByRole("listitem")).toHaveText([
    "Keluarga 12 BulanHabis",
  ]);
});

test("kartu tidak menampilkan angka stok gabungan, dan Beranda tidak punya banner promo", async ({
  page,
}) => {
  await page.goto("/");

  // Netflix Premium punya 10 + 4 Item stok Tersedia.
  const teks = (await kartu(page, NAMA.netflix).innerText()).replace(
    NAMA.netflix,
    "",
  );
  expect(teks).not.toMatch(/stok|\b14\b|\b10\b|\b4\b/i);

  // Di bawah pita langit hanya ada judul halaman, bagian Produk Unggulan, dan bagian Semua Produk.
  const isi = await page
    .getByRole("main")
    .locator(":scope > *")
    .evaluateAll((anak) =>
      anak.map((el) =>
        el.tagName === "SECTION"
          ? `bagian ${el.querySelector("h2")?.textContent}`
          : el.tagName,
      ),
    );
  expect(isi).toEqual(["H1", "bagian Produk Unggulan", "bagian Semua Produk"]);
});

test("di lebar 360 px, Beranda tidak bisa digulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(kartu(page, NAMA.panjang)).toBeVisible();
  expect(await bisaDigulirKeSamping(page)).toBe(false);
});
