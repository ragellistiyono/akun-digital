import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

// Bahan test bersama. DATABASE_URL dan UPLOAD_DIR berasal dari .env.ci yang dimuat playwright.config.ts,
// jadi data ini masuk ke database app_test dan folder unggahan test.
import { sisipkanKategori, sisipkanProduk } from "../src/server/uji-katalog";
import { FOLDER_UNGGAHAN_TEST, PNG } from "../src/server/uji-unggahan";

// Data persiapan bersama docs/UAT.md, yang bertanda [CONTOH], dengan akhiran unik per run supaya
// Kategori dan Produk dari test lain di app_test tidak mengganggu asersi.
const akhiran = randomUUID().slice(0, 8);
const KATEGORI = {
  streaming: `Streaming ${akhiran}`,
  musik: `Musik ${akhiran}`,
  // Kategori Game hanya berisi Produk nonaktif.
  game: `Game ${akhiran}`,
};
const PRODUK = {
  netflix: `Netflix Premium ${akhiran}`,
  youtube: `YouTube Premium ${akhiran}`,
  spotify: `Spotify Premium ${akhiran}`,
  ujiBayar: `Uji Bayar ${akhiran}`,
  gameLama: `Game Lama ${akhiran}`,
};
const ikon = `${randomUUID()}.png`;

test.beforeAll(async () => {
  await mkdir(FOLDER_UNGGAHAN_TEST, { recursive: true });
  await writeFile(path.join(FOLDER_UNGGAHAN_TEST, ikon), PNG);

  const streaming = await sisipkanKategori({ nama: KATEGORI.streaming, ikon });
  const musik = await sisipkanKategori({ nama: KATEGORI.musik, ikon });
  const game = await sisipkanKategori({ nama: KATEGORI.game, ikon });

  await sisipkanProduk({
    nama: PRODUK.netflix,
    kategoriId: streaming,
    unggulan: true,
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, hargaNormal: 75000, Tersedia: 10 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
    ],
  });
  await sisipkanProduk({
    nama: PRODUK.youtube,
    kategoriId: streaming,
    varian: [
      { nama: "1 Bulan", hargaJual: 20000 },
      { nama: "3 Bulan", hargaJual: 55000, Tersedia: 3 },
    ],
  });
  await sisipkanProduk({
    nama: PRODUK.spotify,
    kategoriId: musik,
    varian: [{ nama: "1 Bulan", hargaJual: 25000 }],
  });
  await sisipkanProduk({
    nama: PRODUK.ujiBayar,
    kategoriId: streaming,
    varian: [{ nama: "Uji", hargaJual: 1000, Tersedia: 10 }],
  });
  await sisipkanProduk({
    nama: PRODUK.gameLama,
    kategoriId: game,
    aktif: false,
    varian: [{ nama: "1 Bulan", hargaJual: 15000, Tersedia: 2 }],
  });
});

// Koneksi database tidak ditutup di afterAll. Satu worker Playwright bisa menjalankan beberapa berkas spec
// yang memakai koneksi bersama ini, dan worker itu mengakhiri prosesnya sendiri setelah semua selesai.

test.use({ viewport: { width: 390, height: 800 } });

// Pencarian dan saringan memuat ulang Beranda dari server. app_test lokal bisa berisi ribuan Produk sisa
// run sebelumnya, jadi perpindahan alamat diberi waktu lebih longgar dari bawaan 5 detik.
const NAVIGASI = { timeout: 15_000 };

const kotakCari = (page: Page) =>
  page.getByRole("searchbox", { name: "Cari nama Produk" });

const deretKategori = (page: Page) =>
  page.getByRole("group", { name: "Saring menurut Kategori" });

const chip = (page: Page, nama: string) =>
  deretKategori(page).getByRole("button", { name: nama, exact: true });

const bagian = (page: Page, nama: string) =>
  page.getByRole("region", { name: nama, exact: true });

/** Nama Produk berakhiran unik run ini yang kartunya tampil di sebuah bagian. */
const produkRunIni = async (page: Page, namaBagian: string) =>
  (
    await bagian(page, namaBagian)
      .getByRole("heading", { level: 3 })
      .allInnerTexts()
  )
    .filter((nama) => nama.endsWith(akhiran))
    .sort();

async function cari(page: Page, kataCari: string) {
  await kotakCari(page).fill(kataCari);
  await kotakCari(page).press("Enter");
  await expect(page).toHaveURL(new RegExp(`/\\?q=${kataCari}$`), NAVIGASI);
  await expect(bagian(page, "Hasil pencarian")).toBeVisible();
}

test("UAT-C1: urutan Beranda dari atas adalah kotak cari, deret Kategori, Produk Unggulan, lalu semua Produk", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    bagian(page, "Produk Unggulan")
      .getByRole("link")
      .filter({ hasText: PRODUK.netflix }),
  ).toBeVisible();

  const atas = async (elemen: Locator) => (await elemen.boundingBox())!.y;
  const urutan = [
    await atas(kotakCari(page)),
    await atas(deretKategori(page)),
    await atas(bagian(page, "Produk Unggulan")),
    await atas(bagian(page, "Semua Produk")),
  ];
  expect(urutan).toEqual([...urutan].sort((a, b) => a - b));
  expect(new Set(urutan).size).toBe(4);
});

test('UAT-C1: mencari "netflix" menampilkan Netflix Premium', async ({
  page,
}) => {
  await page.goto("/");

  await cari(page, "netflix");

  expect(await produkRunIni(page, "Hasil pencarian")).toEqual([PRODUK.netflix]);
  // Selama mencari, hanya hasil pencarian yang tampil.
  await expect(bagian(page, "Produk Unggulan")).toHaveCount(0);
  await expect(chip(page, "Semua")).toHaveAttribute("aria-pressed", "true");
});

// Spec lain yang berjalan bersamaan bisa membuat Produk "Netflix Premium …" miliknya sendiri di sela dua
// pencarian, sehingga hasil pencarian seluruh toko bisa berbeda walaupun pencariannya benar. Jadi yang
// dibandingkan hanya Produk run ini: Netflix Premium harus ditemukan oleh kedua pencarian, sedangkan YouTube
// Premium, Spotify Premium, dan Uji Bayar run ini tidak.
test('mencari "NETFLIX" memberi hasil yang sama dengan "netflix"', async ({
  page,
}) => {
  const hasil = async (kataCari: string) => {
    await page.goto("/");
    await cari(page, kataCari);
    return produkRunIni(page, "Hasil pencarian");
  };

  const kecil = await hasil("netflix");
  const besar = await hasil("NETFLIX");

  expect(besar).toEqual(kecil);
  expect(kecil).toEqual([PRODUK.netflix]);
  await expect(kotakCari(page)).toHaveValue("NETFLIX");
});

test("pencarian tanpa hasil menjelaskan sebabnya dan langkah berikutnya", async ({
  page,
}) => {
  await page.goto("/");

  await cari(page, `tidak-ada-${akhiran}`);

  await expect(bagian(page, "Hasil pencarian")).toContainText(
    `Produk "tidak-ada-${akhiran}" belum ada`,
  );
  await expect(bagian(page, "Hasil pencarian")).toContainText(
    "Coba nama lain, atau lihat semua Kategori.",
  );
});

test("UAT-C1: saringan Musik hanya menampilkan Spotify Premium, dan Kategori Game tidak tampil", async ({
  page,
}) => {
  await page.goto("/");

  await expect(chip(page, KATEGORI.streaming)).toBeVisible();
  await expect(chip(page, KATEGORI.game)).toHaveCount(0);

  await chip(page, KATEGORI.musik).click();

  await expect(page).toHaveURL(/\/\?kategori=[0-9a-f-]{36}$/, NAVIGASI);
  await expect(chip(page, KATEGORI.musik)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(chip(page, "Semua")).toHaveAttribute("aria-pressed", "false");
  const hasil = bagian(page, KATEGORI.musik);
  await expect(hasil.getByRole("link")).toHaveCount(1);
  await expect(hasil.getByRole("link")).toContainText(PRODUK.spotify);
  await expect(bagian(page, "Produk Unggulan")).toHaveCount(0);

  // Chip Semua menghapus saringan.
  await chip(page, "Semua").click();
  await expect(page).toHaveURL(/:\d+\/$/, NAVIGASI);
  await expect(bagian(page, "Semua Produk")).toBeVisible();
  await expect(chip(page, KATEGORI.musik)).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("tab Kategori menampilkan Kategori yang sama dengan deret Kategori di Beranda, beserta ikonnya", async ({
  page,
}) => {
  await page.goto("/");
  const diBeranda = await deretKategori(page)
    .getByRole("button")
    .allInnerTexts();

  await page.goto("/kategori");
  const tautan = (nama: string) =>
    page.getByRole("main").getByRole("link", { name: nama, exact: true });

  for (const nama of [KATEGORI.streaming, KATEGORI.musik]) {
    expect(diBeranda).toContain(nama);
    await expect(tautan(nama)).toBeVisible();
    await expect(tautan(nama).locator("img")).toHaveAttribute(
      "src",
      `/unggahan/${ikon}`,
    );
  }
  expect(diBeranda).not.toContain(KATEGORI.game);
  await expect(tautan(KATEGORI.game)).toHaveCount(0);
});

test("Kategori di tab Kategori membuka daftar Produk Kategori itu", async ({
  page,
}) => {
  await page.goto("/kategori");

  await page
    .getByRole("main")
    .getByRole("link", { name: KATEGORI.musik, exact: true })
    .click();

  await expect(page).toHaveURL(/\/\?kategori=[0-9a-f-]{36}$/, NAVIGASI);
  await expect(chip(page, KATEGORI.musik)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const hasil = bagian(page, KATEGORI.musik);
  await expect(hasil.getByRole("link")).toHaveCount(1);
  await expect(hasil.getByRole("link")).toContainText(PRODUK.spotify);
});

test("di lebar 360 px, deret chip bisa digeser ke samping tanpa membuat halaman ikut bergulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const deret = deretKategori(page);
  await expect(chip(page, KATEGORI.musik)).toBeAttached();
  // Deret selebar layar, dari tepi ke tepi.
  expect(await deret.boundingBox()).toMatchObject({ x: 0, width: 360 });
  expect(await deret.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );

  const kotak = (await deret.boundingBox())!;
  await page.mouse.move(kotak.x + kotak.width / 2, kotak.y + kotak.height / 2);
  await page.mouse.wheel(200, 0);

  await expect
    .poll(() => deret.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
