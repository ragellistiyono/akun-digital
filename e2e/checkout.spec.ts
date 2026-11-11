import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";

// Bahan test bersama. DATABASE_URL berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini
// masuk ke database app_test. Server e2e juga memakai Qrispy tiruan dari .env.ci (QRISPY_MODE=tiruan).
import { db } from "../src/server/db";
import { pesanan, riwayatStatusPesanan, varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";

// Data persiapan bersama docs/UAT.md, yang bertanda [CONTOH], dengan akhiran unik per run supaya Produk
// dan Pesanan dari test lain di app_test tidak mengganggu asersi. Produk yang disisipkan di tengah test
// tidak bernama Netflix, supaya tidak mengubah hasil pencarian "netflix" di cari-kategori-beranda.spec.ts
// yang berjalan bersamaan.
const akhiran = randomUUID().slice(0, 8);
const NAMA = {
  netflix: `Netflix Premium ${akhiran}`,
  youtube: `YouTube Premium ${akhiran}`,
  spotify: `Spotify Premium ${akhiran}`,
  ujiBayar: `Uji Bayar ${akhiran}`,
  semuaHabis: `Disney Plus ${akhiran}`,
  varianNonaktif: `Varian Nonaktif ${akhiran}`,
};
const produk = {
  netflix: "",
  youtube: "",
  spotify: "",
  ujiBayar: "",
  semuaHabis: "",
};

test.beforeAll(async () => {
  produk.netflix = await sisipkanProduk({
    nama: NAMA.netflix,
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, hargaNormal: 75000, Tersedia: 10 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
    ],
  });
  produk.youtube = await sisipkanProduk({
    nama: NAMA.youtube,
    varian: [
      { nama: "1 Bulan", hargaJual: 20000 },
      { nama: "3 Bulan", hargaJual: 55000, Tersedia: 3 },
    ],
  });
  produk.spotify = await sisipkanProduk({
    nama: NAMA.spotify,
    varian: [{ nama: "1 Bulan", hargaJual: 25000 }],
  });
  produk.ujiBayar = await sisipkanProduk({
    nama: NAMA.ujiBayar,
    varian: [{ nama: "Uji", hargaJual: 1000, Tersedia: 10 }],
  });
  produk.semuaHabis = await sisipkanProduk({
    nama: NAMA.semuaHabis,
    varian: [
      { nama: "1 Bulan", hargaJual: 50000 },
      { nama: "3 Bulan", hargaJual: 135000 },
    ],
  });
});

// Koneksi database tidak ditutup di afterAll. Satu worker Playwright bisa menjalankan beberapa berkas spec
// yang memakai koneksi bersama ini, dan worker itu mengakhiri prosesnya sendiri setelah semua selesai.

const emailUnik = () => `budi-${randomUUID()}@example.test`;

/** id Varian bernama itu di sebuah Produk. */
async function idVarian(produkId: string, nama: string) {
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(and(eq(varian.produkId, produkId), eq(varian.nama, nama)));
  return id;
}

function pesananDenganEmail(email: string) {
  return db.select().from(pesanan).where(eq(pesanan.email, email));
}

const tombolUtama = (page: Page) =>
  page.getByRole("button", { name: /^(Beli|Habis|Bayar dengan QRIS)/ });

const rincian = (page: Page) =>
  page.getByRole("region", { name: "Rincian pembayaran" });

/** Nilai satu baris rincian, misalnya "Rp 50.000" untuk baris Harga jual. */
const nilaiRincian = (page: Page, label: string) =>
  rincian(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) })
    .getByRole("cell");

const bisaDigulirKeSamping = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );

/** Membuka form checkout dari Halaman Produk dengan Varian yang sudah terpilih. */
async function bukaCheckout(page: Page, produkId: string) {
  await page.goto(`/produk/${produkId}`);
  await tombolUtama(page).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Checkout" }),
  ).toBeVisible();
}

/** Mengisi email lalu menekan "Bayar dengan QRIS", sampai Halaman bayar terbuka. */
async function bayar(page: Page, email: string) {
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();
}

test.use({ viewport: { width: 390, height: 800 } });

test("checkout Netflix Premium 1 Bulan membuat satu Pesanan Menunggu Pembayaran, lalu membuka Halaman bayar", async ({
  page,
}) => {
  const email = emailUnik();
  await page.goto(`/produk/${produk.netflix}`);
  await expect(tombolUtama(page)).toHaveText("Beli · Rp 50.000");
  await tombolUtama(page).click();

  const satuBulan = await idVarian(produk.netflix, "1 Bulan");
  await expect(page).toHaveURL(`/checkout?varianId=${satuBulan}`);
  const isi = page.getByRole("main");
  await expect(isi).toContainText(`${NAMA.netflix} · 1 Bulan`);
  await bayar(page, email);

  // Nomor Pesanan dalam huruf mono: MIWE- diikuti 6 karakter tanpa O, 0, I, dan 1.
  const nomor = isi.getByText(/^MIWE-/);
  await expect(nomor).toHaveText(
    /^MIWE-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,
  );
  const huruf = await nomor.evaluate((el) => ({
    nomor: getComputedStyle(el).fontFamily,
    mono: getComputedStyle(document.documentElement).getPropertyValue(
      "--font-jetbrains",
    ),
  }));
  expect(huruf.nomor).toContain(huruf.mono.split(",")[0].trim());
  await expect(
    isi.getByText("Menunggu Pembayaran", { exact: true }),
  ).toBeVisible();
  await expect(isi.locator("svg.lucide-clock")).toBeVisible();

  const qr = isi.getByRole("img", {
    name: `QRIS Pesanan ${await nomor.textContent()}`,
  });
  await expect(qr).toBeVisible();
  await expect
    .poll(() => qr.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);

  // Rincian PRD §5.5: Kode unik dari Qrispy tiruan, Rp 1–499, dan Total bayar Rp 50.000 ditambah Kode
  // unik itu (contoh literal di issue T14).
  await expect(nilaiRincian(page, "Harga jual")).toHaveText("Rp 50.000");
  await expect(nilaiRincian(page, "Potongan voucher")).toHaveText("Rp 0");
  const teksKodeUnik = await nilaiRincian(page, "Kode unik").textContent();
  const kodeUnik = Number(teksKodeUnik?.replace("Rp ", ""));
  expect(kodeUnik).toBeGreaterThanOrEqual(1);
  expect(kodeUnik).toBeLessThanOrEqual(499);
  await expect(nilaiRincian(page, "Total bayar")).toHaveText(
    `Rp 50.${String(kodeUnik).padStart(3, "0")}`,
  );

  // Tepat satu Pesanan Menunggu Pembayaran, dengan satu baris Riwayat status Pesanan.
  const tersimpan = await pesananDenganEmail(email);
  expect(tersimpan).toMatchObject([
    {
      nomorPesanan: await nomor.textContent(),
      varianId: satuBulan,
      status: "Menunggu Pembayaran",
      hargaJual: 50000,
      potonganVoucher: 0,
      kodeUnik,
    },
  ]);
  expect(page.url()).toContain(`/pesanan/${tersimpan[0].tautan}`);
  const riwayat = await db
    .select({ status: riwayatStatusPesanan.status })
    .from(riwayatStatusPesanan)
    .where(eq(riwayatStatusPesanan.pesananId, tersimpan[0].id));
  expect(riwayat).toEqual([{ status: "Menunggu Pembayaran" }]);
});

// UAT-E1 langkah 1–3 dan PRD §5.3: Item stok yang ditahan Pesanan tidak dihitung di Stok Varian.
test("setelah checkout, Stok Varian di Halaman Produk berkurang satu, juga bila dilihat dari browser lain", async ({
  page,
  browser,
  baseURL,
}) => {
  // Produk sendiri, karena Stok Varian-nya dihitung di test ini.
  const id = await sisipkanProduk({
    nama: `Stok Ditahan ${akhiran}`,
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, Tersedia: 10 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
    ],
  });
  const stokVarian = (halaman: Page, nama: string) =>
    halaman
      .getByRole("radiogroup", { name: "Pilih Varian" })
      .locator("label")
      .filter({ hasText: nama })
      .getByText(/^Stok \d+$/);

  await page.goto(`/produk/${id}`);
  await expect(stokVarian(page, "1 Bulan")).toHaveText("Stok 10");
  await tombolUtama(page).click();
  await bayar(page, emailUnik());

  const browserLain = await browser.newContext({ baseURL });
  try {
    const halamanLain = await browserLain.newPage();
    await halamanLain.goto(`/produk/${id}`);
    await expect(stokVarian(halamanLain, "1 Bulan")).toHaveText("Stok 9");
    await expect(stokVarian(halamanLain, "3 Bulan")).toHaveText("Stok 4");
  } finally {
    await browserLain.close();
  }
});

// UAT-E5 dan PRD §5.1.
test("mengubah Harga jual setelah checkout tidak mengubah rincian Pesanan itu", async ({
  page,
}) => {
  // Produk sendiri, karena Harga jualnya diubah di test ini.
  const id = await sisipkanProduk({
    nama: `Harga Terkunci ${akhiran}`,
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, Tersedia: 10 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
    ],
  });
  await page.goto(`/produk/${id}`);
  await page
    .getByRole("radiogroup", { name: "Pilih Varian" })
    .locator("label")
    .filter({ hasText: "3 Bulan" })
    .click();
  await expect(tombolUtama(page)).toHaveText("Beli · Rp 135.000");
  await tombolUtama(page).click();
  await expect(page.getByRole("main")).toContainText("· 3 Bulan");
  await expect(nilaiRincian(page, "Harga jual")).toHaveText("Rp 135.000");
  await bayar(page, emailUnik());
  const totalAwal = await nilaiRincian(page, "Total bayar").textContent();

  await db
    .update(varian)
    .set({ hargaJual: 140000 })
    .where(eq(varian.id, await idVarian(id, "3 Bulan")));
  await page.reload();

  await expect(nilaiRincian(page, "Harga jual")).toHaveText("Rp 135.000");
  await expect(nilaiRincian(page, "Total bayar")).toHaveText(totalAwal ?? "");
});

// UAT-E7 dan PRD §5.2, tanpa isian voucher di M1.
test("form checkout hanya berisi isian email, dengan kalimat Syarat & Ketentuan bertaut dan tanpa kotak centang", async ({
  page,
}) => {
  await bukaCheckout(page, produk.ujiBayar);
  const isi = page.getByRole("main");

  await expect(isi.getByRole("textbox")).toHaveCount(1);
  const email = isi.getByRole("textbox", { name: "Email" });
  await expect(email).toHaveAttribute("type", "email");
  await expect(email).toHaveAccessibleDescription(
    "Pastikan email benar, detail pesanan dikirim ke sini.",
  );
  await expect(isi.getByRole("checkbox")).toHaveCount(0);
  await expect(isi.getByText(/voucher/i)).toHaveCount(0);
  await expect(isi.getByText(/WhatsApp/)).toHaveCount(0);

  await expect(
    isi.getByText("Dengan membayar, Anda menyetujui Syarat & Ketentuan."),
  ).toBeVisible();
  await expect(
    isi.getByRole("link", { name: "Syarat & Ketentuan" }),
  ).toHaveAttribute("href", "/syarat-ketentuan");

  // Rincian perkiraan (DESIGN.md "Rincian Total bayar").
  await expect(nilaiRincian(page, "Harga jual")).toHaveText("Rp 1.000");
  await expect(nilaiRincian(page, "Kode unik")).toHaveText(
    "Rp 1–499, dari Qrispy",
  );
  await expect(nilaiRincian(page, "Perkiraan bayar")).toHaveText(
    "Rp 1.000 + Kode unik",
  );
});

test("email yang tidak valid ditolak dengan pesan, dan Pesanan tidak dibuat", async ({
  page,
}) => {
  await bukaCheckout(page, produk.ujiBayar);
  const email = page.getByRole("textbox", { name: "Email" });

  await email.fill("budi@");
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();

  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAccessibleDescription(
    "Email ini belum lengkap atau salah tulis. Tulis email yang lengkap, misalnya nama@email.com.",
  );
  await expect(page).toHaveURL(/\/checkout\?varianId=/);
  expect(await pesananDenganEmail("budi@")).toEqual([]);
});

test('tombol utama mengikuti Varian terpilih, dan berbunyi "Habis" tanpa bisa ditekan bila Varian itu habis', async ({
  page,
}) => {
  // Varian habis tidak bisa dipilih, jadi Varian ber-stok pertama yang terpilih.
  await page.goto(`/produk/${produk.youtube}`);
  await expect(tombolUtama(page)).toHaveText("Beli · Rp 55.000");
  await expect(tombolUtama(page)).toBeEnabled();

  for (const produkHabis of [produk.spotify, produk.semuaHabis]) {
    await page.goto(`/produk/${produkHabis}`);
    await expect(tombolUtama(page)).toHaveText("Habis");
    await expect(tombolUtama(page)).toBeDisabled();
  }

  // Produk dengan satu Varian aktif membuka checkout Varian itu.
  await bukaCheckout(page, produk.ujiBayar);
  await expect(page.getByRole("main")).toContainText(`${NAMA.ujiBayar} · Uji`);
});

test("di ponsel, tombol utama menempel di bilah lekat tepat di atas navigasi bawah", async ({
  page,
}) => {
  for (const buka of [
    () => page.goto(`/produk/${produk.netflix}`),
    () => bukaCheckout(page, produk.netflix),
  ]) {
    await buka();
    const navigasi = page
      .getByRole("navigation", { name: "Navigasi utama" })
      .last();
    const bilah = page.locator("[data-bilah-lekat]");
    await expect(bilah).toHaveCSS("position", "fixed");
    const kotakBilah = (await bilah.boundingBox())!;
    const kotakNavigasi = (await navigasi.boundingBox())!;
    expect(kotakBilah.y + kotakBilah.height).toBeCloseTo(kotakNavigasi.y, 0);
    await expect(tombolUtama(page)).toBeInViewport();
  }
});

test("di layar lebar, tombol utama menjadi blok biasa di kolomnya", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/produk/${produk.netflix}`);

  await expect(page.locator("[data-bilah-lekat]")).toHaveCSS(
    "position",
    "static",
  );
});

// PRD §3.7.
test("checkout Varian nonaktif menampilkan halaman tidak ditemukan", async ({
  page,
}) => {
  const id = await sisipkanProduk({
    nama: NAMA.varianNonaktif,
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, aktif: false, Tersedia: 2 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 2 },
    ],
  });

  const respons = await page.goto(
    `/checkout?varianId=${await idVarian(id, "1 Bulan")}`,
  );

  expect(respons?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Varian tidak ditemukan" }),
  ).toBeVisible();
});

test("Varian yang dinonaktifkan setelah form checkout dibuka ditolak dengan pesan, tanpa Pesanan", async ({
  page,
}) => {
  const id = await sisipkanProduk({
    nama: `Varian Berubah ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 2 }],
  });
  await bukaCheckout(page, id);
  await db
    .update(varian)
    .set({ aktif: false })
    .where(eq(varian.id, await idVarian(id, "1 Bulan")));
  const email = emailUnik();

  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Produk atau Varian ini sedang tidak dijual, jadi Pesanan tidak dibuat. Pilih Produk lain di Beranda.",
  );
  expect(await pesananDenganEmail(email)).toEqual([]);
});

// PRD §5.2: checkout ditolak bila Stok Varian-nya 0.
test("Varian yang stoknya habis setelah form checkout dibuka ditolak dengan pesan, tanpa Pesanan", async ({
  page,
  browser,
  baseURL,
}) => {
  const id = await sisipkanProduk({
    nama: `Stok Terakhir ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 1 }],
  });
  await bukaCheckout(page, id);
  // Selagi form ini terbuka, Pembeli lain di browser lain checkout dan menahan Item stok terakhir.
  const browserLain = await browser.newContext({ baseURL });
  try {
    const halamanLain = await browserLain.newPage();
    await bukaCheckout(halamanLain, id);
    await bayar(halamanLain, emailUnik());
  } finally {
    await browserLain.close();
  }
  const email = emailUnik();

  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Stok Varian ini sudah habis, jadi Pesanan tidak dibuat. Pilih Varian lain, atau Produk lain di Beranda.",
  );
  await expect(page).toHaveURL(/\/checkout\?varianId=/);
  expect(await pesananDenganEmail(email)).toEqual([]);
});

test("Tautan Pesanan yang tidak dikenal menampilkan halaman tidak ditemukan", async ({
  page,
}) => {
  const respons = await page.goto(
    `/pesanan/${Buffer.alloc(32).toString("base64url")}`,
  );

  expect(respons?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pesanan tidak ditemukan" }),
  ).toBeVisible();
});

test("di lebar 360 px, form checkout dan Halaman bayar tidak bisa digulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });

  await bukaCheckout(page, produk.netflix);
  expect(await bisaDigulirKeSamping(page)).toBe(false);
  await bayar(page, emailUnik());
  expect(await bisaDigulirKeSamping(page)).toBe(false);
});
