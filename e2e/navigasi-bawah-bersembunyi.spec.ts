import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { sisipkanKategori, sisipkanProduk } from "../src/server/uji-katalog";

// Navigasi bawah bersembunyi saat digulir ke bawah (T63, PRD §11.2, DESIGN.md Layout "Gerak responsif",
// Navigation "Navigasi bawah" dan "Bilah lekat", UAT-K2).

// Tinggi layar dibuat pendek, dan beberapa Produk disisipkan, supaya Beranda dan Halaman Produk pasti
// bisa digulir lebih dari 400 px walau katalog sedang sedikit.
const TINGGI_LAYAR = 480;
const TINGGI_NAVIGASI = 76;

const akhiran = randomUUID().slice(0, 8);
let idProduk = "";

test.beforeAll(async () => {
  const kategoriId = await sisipkanKategori({ nama: `Gulir ${akhiran}` });
  for (let i = 1; i <= 4; i++) {
    const id = await sisipkanProduk({
      nama: `Gulir ${i} ${akhiran}`,
      kategoriId,
      deskripsi: "Deskripsi panjang uji gulir. ".repeat(40),
      varian: [
        { nama: "1 Bulan", hargaJual: 25_000, Tersedia: 1 },
        { nama: "3 Bulan", hargaJual: 65_000, Tersedia: 1 },
      ],
    });
    if (i === 1) idProduk = id;
  }
});

function navigasiBawah(page: Page) {
  return page.getByRole("navigation", { name: "Navigasi utama" }).last();
}

async function gulirKe(page: Page, y: number) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y);
}

// Halaman dibuka lalu ditunggu sampai pembaca posisi gulir di klien aktif. Gulir sebelum itu tidak
// terbaca sebagai gerakan ke bawah. Tandanya: bilah atas ciut saat digulir 60 px (T61) dan utuh lagi di
// paling atas, posisi yang tidak mengubah navigasi bawah.
async function buka(page: Page, alamat: string, lebar = 375) {
  await page.setViewportSize({ width: lebar, height: TINGGI_LAYAR });
  await page.goto(alamat);
  const bilahAtas = page.getByRole("banner");
  await gulirKe(page, 60);
  await expect(bilahAtas).toHaveAttribute("data-ciut");
  await gulirKe(page, 0);
  await expect(bilahAtas).not.toHaveAttribute("data-ciut");
}

async function kotak(locator: Locator) {
  const hasil = await locator.boundingBox();
  expect(hasil).not.toBeNull();
  return hasil!;
}

// Tepi atas navigasi bawah, ditunggu sampai transisinya selesai.
async function harusTersembunyi(page: Page) {
  await expect
    .poll(async () => (await kotak(navigasiBawah(page))).y)
    .toBeGreaterThanOrEqual(TINGGI_LAYAR);
}

async function harusTampilUtuh(page: Page) {
  await expect
    .poll(async () => (await kotak(navigasiBawah(page))).y)
    .toBe(TINGGI_LAYAR - TINGGI_NAVIGASI);
}

// Menunggu dua frame supaya pembaca posisi gulir sempat bereaksi sebelum memeriksa yang tidak berubah.
async function tungguDuaFrame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((selesai) =>
        requestAnimationFrame(() => requestAnimationFrame(() => selesai())),
      ),
  );
}

test("di lebar 375 px navigasi bawah bersembunyi setelah Beranda digulir ke 400 px dan tampil utuh lagi setelah digulir ke atas 60 px", async ({
  page,
}) => {
  await buka(page, "/");
  await harusTampilUtuh(page);

  await gulirKe(page, 400);
  await harusTersembunyi(page);

  await gulirKe(page, 340);
  await harusTampilUtuh(page);
});

test("navigasi bawah tetap tampil setelah Beranda digulir ke 100 px", async ({
  page,
}) => {
  await buka(page, "/");

  await gulirKe(page, 100);
  await tungguDuaFrame(page);
  await harusTampilUtuh(page);

  // Dari keadaan tersembunyi pun, posisi 100 px menampilkan navigasi lagi.
  await gulirKe(page, 400);
  await harusTersembunyi(page);
  await gulirKe(page, 500);
  await harusTersembunyi(page);
  await gulirKe(page, 100);
  await harusTampilUtuh(page);
});

test("di Halaman Produk 375 px bilah lekat turun ke dasar layar saat navigasi bawah tersembunyi dan kembali tepat di atasnya saat navigasi muncul", async ({
  page,
}) => {
  await buka(page, `/produk/${idProduk}`);
  const bilah = page.locator("[data-bilah-lekat]");

  await gulirKe(page, 400);
  await harusTersembunyi(page);
  await expect
    .poll(async () => {
      const k = await kotak(bilah);
      return k.y + k.height;
    })
    .toBe(TINGGI_LAYAR);
  // Padding bawah 12 px, ditambah safe-area-inset-bottom yang 0 di browser test.
  await expect(bilah).toHaveCSS("padding-bottom", "12px");

  await gulirKe(page, 340);
  await harusTampilUtuh(page);
  await expect
    .poll(async () => {
      const k = await kotak(bilah);
      return k.y + k.height;
    })
    .toBe(TINGGI_LAYAR - TINGGI_NAVIGASI);
  await expect(bilah).toHaveCSS("padding-bottom", "26px");
});

test.describe("dengan kurangi gerakan", () => {
  test.use({ reducedMotion: "reduce" });

  test("navigasi bawah tetap bersembunyi dan muncul, tanpa transisi", async ({
    page,
  }) => {
    await buka(page, `/produk/${idProduk}`);
    const navigasi = navigasiBawah(page);
    const bilah = page.locator("[data-bilah-lekat]");
    await expect(navigasi).toHaveCSS("transition-duration", "0s");
    await expect(bilah).toHaveCSS("transition-duration", "0s");

    await gulirKe(page, 400);
    await harusTersembunyi(page);

    await gulirKe(page, 340);
    await harusTampilUtuh(page);
  });
});

test("saat navigasi bawah tersembunyi, Tab sampai tab Beranda di navigasi bawah menampilkan navigasi lagi", async ({
  page,
}) => {
  await buka(page, "/");
  const navigasi = navigasiBawah(page);
  const tabBeranda = navigasi.getByRole("link", {
    name: "Beranda",
    exact: true,
  });

  await gulirKe(page, 400);
  await harusTersembunyi(page);

  // Fokus dipasang tanpa menggulir di elemen terakhir sebelum navigasi bawah dalam urutan Tab, supaya
  // Tab berikutnya langsung menuju tab Beranda tanpa menggulir halaman ke atas lebih dulu.
  await page.evaluate(() => {
    const nav = document.querySelector("[data-navigasi-bawah]")!;
    const sebelumNav = Array.from(
      document.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select, textarea",
      ),
    ).filter(
      (el) =>
        el.checkVisibility() &&
        nav.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING,
    );
    sebelumNav.at(-1)!.focus({ preventScroll: true });
  });
  await harusTersembunyi(page);

  for (let i = 0; i < 5; i++) {
    if (await tabBeranda.evaluate((el) => el === document.activeElement)) {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await expect(tabBeranda).toBeFocused();
  await harusTampilUtuh(page);
});

// Posisi dan ukuran setiap anak <body> yang dirender selain bilah atas, relatif terhadap dokumen. Navigasi
// bawah tidak dirender di layar lebar, jadi tidak ikut.
function tataLetakSelainBilahAtas(page: Page) {
  return page.evaluate(() =>
    Array.from(document.body.children)
      .filter((el) => el.tagName !== "HEADER" && el.checkVisibility())
      .map((el) => {
        const k = el.getBoundingClientRect();
        return [k.left, k.top + window.scrollY, k.width, k.height];
      }),
  );
}

test("di lebar 1440 px menggulir Beranda tidak mengubah tata letak selain bilah atas", async ({
  page,
}) => {
  await buka(page, "/", 1440);
  await expect(page.locator("[data-navigasi-bawah]")).toBeHidden();
  const awal = await tataLetakSelainBilahAtas(page);

  await gulirKe(page, 400);
  await tungguDuaFrame(page);
  expect(await tataLetakSelainBilahAtas(page)).toEqual(awal);

  await gulirKe(page, 340);
  await tungguDuaFrame(page);
  expect(await tataLetakSelainBilahAtas(page)).toEqual(awal);
});

test("di lebar 1440 px bilah lekat Halaman Produk tetap blok biasa setelah digulir ke bawah", async ({
  page,
}) => {
  await buka(page, `/produk/${idProduk}`, 1440);
  const bilah = page.locator("[data-bilah-lekat]");
  const awal = await tataLetakSelainBilahAtas(page);

  await gulirKe(page, 400);
  await tungguDuaFrame(page);
  await expect(bilah).toHaveCSS("position", "static");
  await expect(bilah).toHaveCSS("padding-bottom", "0px");
  expect(await tataLetakSelainBilahAtas(page)).toEqual(awal);
});
