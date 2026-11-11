import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

// Bahan test bersama. DATABASE_URL dan UPLOAD_DIR berasal dari .env.ci yang dimuat playwright.config.ts,
// jadi data ini masuk ke database app_test dan folder unggahan test.
import { sisipkanKategori, sisipkanProduk } from "../src/server/uji-katalog";
import { FOLDER_UNGGAHAN_TEST, PNG } from "../src/server/uji-unggahan";

// Data persiapan bersama docs/UAT.md, yang bertanda [CONTOH], dengan akhiran unik per run supaya
// Produk dari test lain di app_test tidak mengganggu asersi.
// Tombol WhatsApp Halaman Produk diuji di pengaturan-toko.spec.ts, karena nomor WhatsApp berlaku untuk
// seluruh toko dan hanya berkas itu yang mengubahnya secara berurutan.
const akhiran = randomUUID().slice(0, 8);
const NAMA = {
  streaming: `Streaming ${akhiran}`,
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
  panjangSatu: `Langganan Keluarga Premium Sepanjang Tahun Satu Varian ${akhiran}`,
};
const DESKRIPSI = "Akun Netflix Premium satu profil, kualitas Ultra HD.";
const GARANSI =
  "Garansi 30 hari. Bila akun tidak bisa dipakai, hubungi WhatsApp MIWE dengan Nomor Pesanan.";
const foto = [`${randomUUID()}.png`, `${randomUUID()}.png`];
const id = {
  streaming: "",
  netflix: "",
  youtube: "",
  spotify: "",
  ujiBayar: "",
  gameLama: "",
  varianNonaktif: "",
  panjang: "",
  panjangSatu: "",
};

test.beforeAll(async () => {
  await mkdir(FOLDER_UNGGAHAN_TEST, { recursive: true });
  for (const nama of foto) {
    await writeFile(path.join(FOLDER_UNGGAHAN_TEST, nama), PNG);
  }

  id.streaming = await sisipkanKategori({ nama: NAMA.streaming });
  id.netflix = await sisipkanProduk({
    nama: NAMA.netflix,
    kategoriId: id.streaming,
    unggulan: true,
    foto,
    deskripsi: DESKRIPSI,
    ketentuanGaransi: GARANSI,
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, hargaNormal: 75000, Tersedia: 10 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
    ],
  });
  id.youtube = await sisipkanProduk({
    nama: NAMA.youtube,
    kategoriId: id.streaming,
    varian: [
      { nama: "1 Bulan", hargaJual: 20000 },
      { nama: "3 Bulan", hargaJual: 55000, Tersedia: 3 },
    ],
  });
  id.spotify = await sisipkanProduk({
    nama: NAMA.spotify,
    varian: [{ nama: "1 Bulan", hargaJual: 25000 }],
  });
  id.ujiBayar = await sisipkanProduk({
    nama: NAMA.ujiBayar,
    kategoriId: id.streaming,
    varian: [{ nama: "Uji", hargaJual: 1000, Tersedia: 10 }],
  });
  id.gameLama = await sisipkanProduk({
    nama: NAMA.gameLama,
    aktif: false,
    varian: [{ nama: "1 Bulan", hargaJual: 15000, Tersedia: 2 }],
  });
  id.varianNonaktif = await sisipkanProduk({
    nama: NAMA.varianNonaktif,
    varian: [
      { nama: "Promo", hargaJual: 10000, aktif: false, Tersedia: 9 },
      { nama: "1 Bulan", hargaJual: 50000, Tersedia: 2 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 1 },
    ],
  });
  id.panjang = await sisipkanProduk({
    nama: NAMA.panjang,
    foto,
    deskripsi: "Deskripsi-panjang-tanpa-spasi-".repeat(8),
    ketentuanGaransi: "Garansi-panjang-tanpa-spasi-".repeat(8),
    varian: [
      {
        nama: "Paket Keluarga Dua Belas Bulan Tanpa Iklan",
        hargaJual: 499000,
        hargaNormal: 9_000_000_000_000_000,
        Tersedia: 1,
      },
      {
        nama: "Paket Keluarga Dua Puluh Empat Bulan",
        hargaJual: 498000,
        hargaNormal: 8_000_000_000_000_000,
      },
    ],
  });
  id.panjangSatu = await sisipkanProduk({
    nama: NAMA.panjangSatu,
    varian: [
      {
        nama: "Keluarga 12 Bulan",
        hargaJual: 499000,
        hargaNormal: 9_000_000_000_000_000,
        Tersedia: 1,
      },
    ],
  });
});

// Koneksi database tidak ditutup di afterAll. Satu worker Playwright bisa menjalankan beberapa berkas spec
// yang memakai koneksi bersama ini, dan worker itu mengakhiri prosesnya sendiri setelah semua selesai.

const alamat = (idProduk: string) => `/produk/${idProduk}`;

const pilihanVarian = (page: Page) =>
  page.getByRole("radiogroup", { name: "Pilih Varian" });

/** Kartu satu Varian di pilihan Varian, yaitu label yang membungkus radionya. */
const kartuVarian = (page: Page, nama: string) =>
  pilihanVarian(page)
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: new RegExp(`^${nama}`) }) });

const bisaDigulirKeSamping = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );

test.use({ viewport: { width: 390, height: 800 } });

// UAT-C2.
test("Netflix Premium menampilkan nama, Kategori, foto, deskripsi, ketentuan garansi, dan kedua Variannya", async ({
  page,
}) => {
  await page.goto(alamat(id.netflix));
  const isi = page.getByRole("main");

  await expect(
    isi.getByRole("heading", { level: 1, name: NAMA.netflix }),
  ).toBeVisible();
  const kategori = isi.getByRole("link", { name: NAMA.streaming });
  await expect(kategori).toBeVisible();
  await expect(kategori).toHaveAttribute("href", `/?kategori=${id.streaming}`);

  const gambar = isi.getByRole("img", { name: new RegExp(NAMA.netflix) });
  await expect(gambar).toHaveCount(2);
  for (const [i, nama] of foto.entries()) {
    const img = gambar.nth(i);
    await expect(img).toHaveAttribute("src", `/unggahan/${nama}`);
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  }

  await expect(isi.getByRole("region", { name: "Deskripsi" })).toHaveText(
    DESKRIPSI,
  );
  const garansi = isi.getByRole("region", { name: "Ketentuan garansi" });
  await expect(garansi).toContainText(GARANSI);
  await expect(garansi.locator("svg.lucide-shield-check")).toBeVisible();

  const radio = pilihanVarian(page).getByRole("radio");
  await expect(radio).toHaveCount(2);
  await expect(pilihanVarian(page).locator("label")).toHaveText([
    "1 BulanStok 10Rp 50.000Harga normal Rp 75.000Hemat 33%",
    "3 BulanStok 4Rp 135.000",
  ]);
});

// UAT-C2 dan PRD §3.2: Produk yang hanya punya satu Varian aktif tidak menampilkan pilihan Varian.
test("Uji Bayar tidak menampilkan pilihan Varian, melainkan harga 28 px dan Stok Varian", async ({
  page,
}) => {
  await page.goto(alamat(id.ujiBayar));
  const isi = page.getByRole("main");

  await expect(
    isi.getByRole("heading", { level: 1, name: NAMA.ujiBayar }),
  ).toBeVisible();
  await expect(page.getByRole("radiogroup")).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  const harga = isi.getByText("Rp 1.000", { exact: true });
  await expect(harga).toBeVisible();
  await expect(harga).toHaveCSS("font-size", "28px");
  await expect(isi.getByText("Stok 10", { exact: true })).toBeVisible();
});

// UAT-C3.
test('Varian Netflix Premium 1 Bulan menampilkan "Stok 10"', async ({
  page,
}) => {
  await page.goto(alamat(id.netflix));

  await expect(
    kartuVarian(page, "1 Bulan").getByText("Stok 10", { exact: true }),
  ).toBeVisible();
});

// UAT-C4 langkah 1.
test('Varian Netflix Premium 1 Bulan menampilkan Rp 75.000 dicoret dan "Hemat 33%"', async ({
  page,
}) => {
  await page.goto(alamat(id.netflix));

  const satuBulan = kartuVarian(page, "1 Bulan");
  await expect(satuBulan.locator("s")).toHaveText("Harga normal Rp 75.000");
  await expect(satuBulan.getByText("Hemat 33%", { exact: true })).toBeVisible();
  // Varian tanpa Harga normal tidak menampilkan harga coret maupun Hemat.
  const tigaBulan = kartuVarian(page, "3 Bulan");
  await expect(tigaBulan.locator("s")).toHaveCount(0);
  await expect(tigaBulan.getByText(/Hemat/)).toHaveCount(0);
});

// PRD §3.4.
test('Varian yang habis tampil "Habis" dan tidak bisa dipilih', async ({
  page,
}) => {
  await page.goto(alamat(id.youtube));

  const habis = pilihanVarian(page).getByRole("radio", { name: /^1 Bulan/ });
  const ada = pilihanVarian(page).getByRole("radio", { name: /^3 Bulan/ });
  await expect(
    kartuVarian(page, "1 Bulan").getByText("Habis", { exact: true }),
  ).toBeVisible();
  await expect(kartuVarian(page, "1 Bulan")).not.toContainText("Stok");
  await expect(habis).toBeDisabled();
  await expect(ada).toBeEnabled();
  // Varian ber-stok pertama sudah terpilih.
  await expect(ada).toBeChecked();

  await kartuVarian(page, "1 Bulan").click({ force: true });
  await expect(habis).not.toBeChecked();
  await expect(ada).toBeChecked();
});

test("Varian ber-stok bisa dipilih, dan hanya satu Varian terpilih", async ({
  page,
}) => {
  await page.goto(alamat(id.netflix));

  const satuBulan = pilihanVarian(page).getByRole("radio", {
    name: /^1 Bulan/,
  });
  const tigaBulan = pilihanVarian(page).getByRole("radio", {
    name: /^3 Bulan/,
  });
  await expect(satuBulan).toBeChecked();

  await kartuVarian(page, "3 Bulan").click();
  await expect(tigaBulan).toBeChecked();
  await expect(satuBulan).not.toBeChecked();
});

test('Produk dengan satu Varian aktif yang habis menampilkan "Habis"', async ({
  page,
}) => {
  await page.goto(alamat(id.spotify));
  const isi = page.getByRole("main");

  await expect(page.getByRole("radiogroup")).toHaveCount(0);
  await expect(isi.getByText("Rp 25.000", { exact: true })).toBeVisible();
  // Label Habis di bawah harga, dan tombol utama yang juga berbunyi "Habis" (T14).
  await expect(isi.getByText("Habis", { exact: true })).toHaveCount(2);
  await expect(isi.getByRole("button", { name: "Habis" })).toBeDisabled();
  await expect(isi.getByText(/Stok/)).toHaveCount(0);
});

// PRD §3.7.
test("Varian nonaktif tidak tampil di pilihan Varian", async ({ page }) => {
  await page.goto(alamat(id.varianNonaktif));

  const radio = pilihanVarian(page).getByRole("radio");
  await expect(radio).toHaveCount(2);
  await expect(pilihanVarian(page)).not.toContainText("Promo");
  await expect(pilihanVarian(page).locator("label")).toHaveText([
    "1 BulanStok 2Rp 50.000",
    "3 BulanStok 1Rp 135.000",
  ]);
});

// PRD §3.7: Produk nonaktif hilang dari katalog.
for (const [kasus, idProduk] of [
  ["Produk nonaktif", () => id.gameLama],
  ["Produk yang tidak ada", () => randomUUID()],
  ["alamat Produk yang tidak sah", () => "bukan-produk"],
] as const) {
  test(`${kasus} menampilkan halaman tidak ditemukan`, async ({ page }) => {
    const respons = await page.goto(alamat(idProduk()));

    expect(respons?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Produk tidak ditemukan" }),
    ).toBeVisible();
    await expect(page.getByText(NAMA.gameLama)).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Lihat Beranda" }),
    ).toHaveAttribute("href", "/");
  });
}

test("di lebar 360 px, Halaman Produk tidak bisa digulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });

  for (const idProduk of [
    id.netflix,
    id.panjang,
    id.panjangSatu,
    id.youtube,
    id.ujiBayar,
  ]) {
    await page.goto(alamat(idProduk));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await bisaDigulirKeSamping(page)).toBe(false);
  }
});
