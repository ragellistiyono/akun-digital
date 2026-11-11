import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database
// app_test. Server e2e memakai Qrispy tiruan dari .env.ci (QRISPY_MODE=tiruan): QRIS-nya kedaluwarsa 15
// menit setelah terbit, dan pemicu bayarnya ada di POST /api/qrispy-tiruan/bayar.
import { db } from "../src/server/db";
import { pesanan } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";

// Produk bertanda [CONTOH] dengan akhiran unik per run. Namanya bukan Netflix, supaya tidak mengubah
// hasil pencarian "netflix" di cari-kategori-beranda.spec.ts yang berjalan bersamaan.
const akhiran = randomUUID().slice(0, 8);
let produkId = "";

test.beforeAll(async () => {
  produkId = await sisipkanProduk({
    nama: `Halaman Bayar ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 20 }],
  });
});

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

// Galat hidrasi React: pesan lengkap di build pengembangan, nomor galat 418–425 di build produksi.
const GALAT_HIDRASI = /hydrat|(errors\/|error #)4(18|19|2[1-5])\b/i;

/** Checkout dari Halaman Produk sampai Halaman bayar terbuka. Hasilnya Pesanan yang baru dibuat. */
async function checkoutSampaiHalamanBayar(page: Page) {
  const email = `budi-${randomUUID()}@example.test`;
  await page.goto(`/produk/${produkId}`);
  await page.getByRole("button", { name: /^Beli/ }).click();
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();
  const [dipesan] = await db
    .select({
      tautan: pesanan.tautan,
      nomorPesanan: pesanan.nomorPesanan,
      qrisId: pesanan.qrisId,
      totalBayar: pesanan.totalBayar,
      kedaluwarsaPada: pesanan.kedaluwarsaPada,
      gambarQr: pesanan.gambarQr,
    })
    .from(pesanan)
    .where(eq(pesanan.email, email));
  return dipesan;
}

const isi = (page: Page) => page.getByRole("main");

/** Kartu senja: wadah pemandangan senja Halaman bayar beserta tulisan di atas langitnya. */
const kartuSenja = (page: Page) =>
  isi(page).locator('[data-pemandangan="bayar"]').locator("xpath=..");

/** Angka hitung mundur "mm:ss" di kartu senja. */
const angkaWaktu = (page: Page) => kartuSenja(page).getByText(/^\d{2}:\d{2}$/);

/** Elemen yang mengumumkan sisa menit ke pembaca layar. */
const pengumumanSisa = (page: Page) =>
  isi(page).locator('[aria-live="polite"]');

/** Sisa detik yang ditunjukkan hitung mundur. */
async function detikTersisa(page: Page) {
  const [menit, detik] = ((await angkaWaktu(page).textContent()) ?? "")
    .split(":")
    .map(Number);
  return menit * 60 + detik;
}

const mmss = (detik: number) =>
  `${String(Math.floor(detik / 60)).padStart(2, "0")}:${String(detik % 60).padStart(2, "0")}`;

/** Membuka Halaman bayar itu lagi dengan jam browser yang dikendalikan test, mulai dari jam sekarang. */
async function bukaDenganJamUji(page: Page, tautan: string) {
  await page.clock.install();
  await page.goto(`/pesanan/${tautan}`);
  await expect(kartuSenja(page).locator("svg")).toBeVisible();
}

/**
 * Kontras setiap baris teks di kartu senja terhadap pemandangan yang benar-benar ada di belakangnya. Teks
 * disembunyikan sebentar, kartu difoto, lalu untuk setiap baris dihitung kotak tinta hurufnya dari ukuran
 * huruf (canvas measureText). Latar diwakili petak 4 × 4 piksel paling terang di dalam kotak tinta itu,
 * supaya butiran derau satu piksel tidak dihitung sendiri-sendiri, dan kontrasnya dihitung terhadap warna
 * teks yang sedang dipakai (WCAG).
 */
async function kontrasTeksKartu(page: Page) {
  const kartu = kartuSenja(page);
  const baris = await kartu.evaluate((wadah) => {
    const konteks = document.createElement("canvas").getContext("2d")!;
    const dasar = wadah.getBoundingClientRect();
    return Array.from(wadah.querySelectorAll("p")).map((el) => {
      const gaya = getComputedStyle(el);
      konteks.font = `${gaya.fontWeight} ${gaya.fontSize} ${gaya.fontFamily}`;
      konteks.letterSpacing = gaya.letterSpacing;
      const ukuran = konteks.measureText(el.textContent ?? "");
      const kotak = el.getBoundingClientRect();
      const garisDasar =
        kotak.top -
        dasar.top +
        (kotak.height -
          ukuran.fontBoundingBoxAscent -
          ukuran.fontBoundingBoxDescent) /
          2 +
        ukuran.fontBoundingBoxAscent;
      const awal =
        (gaya.textAlign === "right" ? kotak.right - ukuran.width : kotak.left) -
        dasar.left;
      return {
        teks: el.textContent ?? "",
        warna: gaya.color,
        x1: awal - ukuran.actualBoundingBoxLeft,
        x2: awal + ukuran.actualBoundingBoxRight,
        y1: garisDasar - ukuran.actualBoundingBoxAscent,
        y2: garisDasar + ukuran.actualBoundingBoxDescent,
      };
    });
  });
  const lapisTeks = kartu.locator("div:has(> div > p)");
  await lapisTeks.evaluate((el) => (el.style.visibility = "hidden"));
  const foto = (await kartu.screenshot()).toString("base64");
  await lapisTeks.evaluate((el) => (el.style.visibility = ""));

  return page.evaluate(
    async ({ foto, baris }) => {
      const gambar = new Image();
      gambar.src = `data:image/png;base64,${foto}`;
      await gambar.decode();
      const { width: L, height: T } = gambar;
      const kanvas = document.createElement("canvas");
      kanvas.width = L;
      kanvas.height = T;
      const konteks = kanvas.getContext("2d")!;
      konteks.drawImage(gambar, 0, 0);
      const piksel = konteks.getImageData(0, 0, L, T).data;
      const linear = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const luminans = (r: number, g: number, b: number) =>
        0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
      return baris.map(({ teks, warna, x1, x2, y1, y2 }) => {
        let latar = 0;
        for (let y = Math.floor(y1); y < Math.ceil(y2); y += 4) {
          for (let x = Math.floor(x1); x < Math.ceil(x2); x += 4) {
            let jumlah = 0;
            let n = 0;
            for (let dy = y; dy < Math.min(y + 4, Math.ceil(y2)); dy++) {
              for (let dx = x; dx < Math.min(x + 4, Math.ceil(x2)); dx++) {
                const i = (dy * L + dx) * 4;
                jumlah += luminans(piksel[i], piksel[i + 1], piksel[i + 2]);
                n++;
              }
            }
            latar = Math.max(latar, jumlah / n);
          }
        }
        const [r, g, b] = (warna.match(/\d+/g) ?? []).map(Number);
        const depan = luminans(r, g, b);
        const kontras =
          (Math.max(depan, latar) + 0.05) / (Math.min(depan, latar) + 0.05);
        return { teks, warna, kontras: Math.round(kontras * 100) / 100 };
      });
    },
    { foto, baris },
  );
}

// Issue T18: hitung mundur dihitung dari waktu kedaluwarsa QRIS yang tersimpan di Pesanan, dan
// menggerakkan waktu senja pemandangan (DESIGN.md "Pemandangan senja").
test("hitung mundur di kartu senja menunjukkan sisa waktu sampai waktu kedaluwarsa QRIS dari Qrispy tiruan", async ({
  page,
}) => {
  const galat: string[] = [];
  page.on("pageerror", (error) => galat.push(error.message));
  page.on("console", (pesan) => {
    if (pesan.type() === "error" && GALAT_HIDRASI.test(pesan.text())) {
      galat.push(pesan.text());
    }
  });
  const dipesan = await checkoutSampaiHalamanBayar(page);
  const kedaluwarsa = dipesan.kedaluwarsaPada.getTime();

  // Tepat setelah checkout, sisa waktunya hampir 15 menit, sesuai waktu kedaluwarsa dari Qrispy tiruan.
  await expect(kartuSenja(page).locator("svg")).toBeVisible();
  const harapan = Math.ceil((kedaluwarsa - Date.now()) / 1000);
  expect(Math.abs((await detikTersisa(page)) - harapan)).toBeLessThanOrEqual(2);
  // Total bayar ditulis di atas langit, sama dengan Total bayar Pesanan.
  await expect(kartuSenja(page)).toContainText("Total bayar");
  await expect(kartuSenja(page)).toContainText(
    `Rp ${dipesan.totalBayar.toLocaleString("id-ID")}`,
  );

  await bukaDenganJamUji(page, dipesan.tautan);
  await page.clock.pauseAt(kedaluwarsa - 450_000);
  await expect(angkaWaktu(page)).toHaveText("07:30");
  await page.clock.runFor(1_000);
  await expect(angkaWaktu(page)).toHaveText("07:29");
  // Di tengah masa berlaku, langitnya masih senja tanpa bintang: hanya pendar dan cakram matahari.
  await expect(kartuSenja(page).locator("svg circle")).toHaveCount(2);

  expect(galat).toEqual([]);
});

test('saat sisa waktu habis, label kartu senja menjadi "QRIS kedaluwarsa" dan langitnya malam berbintang', async ({
  page,
}) => {
  const dipesan = await checkoutSampaiHalamanBayar(page);
  const kedaluwarsa = dipesan.kedaluwarsaPada.getTime();
  await bukaDenganJamUji(page, dipesan.tautan);

  await page.clock.pauseAt(kedaluwarsa - 2_000);
  await expect(angkaWaktu(page)).toHaveText("00:02");
  await expect(kartuSenja(page).getByText("sisa waktu bayar")).toBeVisible();
  await page.clock.runFor(2_000);

  await expect(angkaWaktu(page)).toHaveText("00:00");
  await expect(
    kartuSenja(page).getByText("QRIS kedaluwarsa", { exact: true }),
  ).toBeVisible();
  await expect(kartuSenja(page).getByText("sisa waktu bayar")).toHaveCount(0);
  await expect(pengumumanSisa(page)).toHaveText("QRIS kedaluwarsa");
  // Malam tiba saat waktu habis: 46 bintang muncul di samping pendar dan cakram matahari (DESIGN.md).
  await expect(kartuSenja(page).locator("svg circle")).toHaveCount(2 + 46);
});

// DESIGN.md: pembaca layar mendapat sisa menit lewat aria-live sekali per menit, bukan setiap detik.
test("elemen aria-live berubah sekali per menit, sementara hitung mundur berganti setiap detik", async ({
  page,
}) => {
  const dipesan = await checkoutSampaiHalamanBayar(page);
  const kedaluwarsa = dipesan.kedaluwarsaPada.getTime();
  await bukaDenganJamUji(page, dipesan.tautan);
  await page.clock.pauseAt(kedaluwarsa - 725_000);
  await expect(angkaWaktu(page)).toHaveText("12:05");
  await expect(pengumumanSisa(page)).toHaveText("Sisa waktu bayar 13 menit");

  // Setiap perubahan isi elemen aria-live dicatat.
  await pengumumanSisa(page).evaluate((el) => {
    const catatan: string[] = [];
    Object.assign(window, { catatanPengumuman: catatan });
    new MutationObserver(() => catatan.push(el.textContent ?? "")).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  // 65 detik, dari 12:05 sampai 11:00, satu detik demi satu detik.
  for (let detik = 724; detik >= 660; detik--) {
    await page.clock.runFor(1_000);
    await expect(angkaWaktu(page)).toHaveText(mmss(detik));
  }

  const catatan = await page.evaluate(
    () =>
      (window as unknown as { catatanPengumuman: string[] }).catatanPengumuman,
  );
  expect(catatan).toEqual([
    "Sisa waktu bayar 12 menit",
    "Sisa waktu bayar 11 menit",
  ]);
});

test('"Simpan gambar QR" mengunduh berkas PNG berisi gambar QR Pesanan itu', async ({
  page,
}) => {
  const dipesan = await checkoutSampaiHalamanBayar(page);
  const tombol = isi(page).getByRole("link", { name: "Simpan gambar QR" });
  await expect(tombol.locator("svg.lucide-download")).toBeVisible();

  const [unduhan] = await Promise.all([
    page.waitForEvent("download"),
    tombol.click(),
  ]);

  expect(unduhan.suggestedFilename()).toBe(`QRIS-${dipesan.nomorPesanan}.png`);
  const berkas = await readFile(await unduhan.path());
  // Tanda tangan berkas PNG.
  expect(berkas.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  // Gambar QR dari Qrispy yang tersimpan di Pesanan itu (data URL PNG).
  expect(berkas).toEqual(
    Buffer.from(
      dipesan.gambarQr.replace(/^data:image\/png;base64,/, ""),
      "base64",
    ),
  );
});

// Issue T18 dan PRD §5.6: begitu pembayaran masuk, halaman berpindah sendiri ke Halaman Pesanan.
test("setelah pembayaran dipicu lewat Qrispy tiruan, halaman berpindah sendiri ke tampilan Selesai dalam 15 detik, tanpa dimuat ulang", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const dipesan = await checkoutSampaiHalamanBayar(page);
  // Pembeli memindai QR dan membayar beberapa detik setelah Halaman bayar terbuka. Status QRIS ditanyakan
  // ke Qrispy paling sering sekali per 15 detik, dan sekali sudah ditanyakan saat halaman dibuka
  // (ADR-0004), jadi pembayaran yang masuk tepat saat halaman terbuka baru terbaca sekitar 15 detik
  // setelah halaman dibuka.
  await expect(kartuSenja(page).locator("svg")).toBeVisible();
  const awal = await detikTersisa(page);
  await expect
    .poll(() => detikTersisa(page), { timeout: 15_000 })
    .toBeLessThanOrEqual(awal - 5);
  // Penanda di halaman ini hilang bila halaman dimuat ulang.
  await page.evaluate(() => Object.assign(window, { penandaHalaman: true }));

  const respons = await request.post("/api/qrispy-tiruan/bayar", {
    data: { qrisId: dipesan.qrisId, amount: dipesan.totalBayar },
  });
  expect(respons.status()).toBe(200);

  await expect(isi(page).getByText("Selesai", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("heading", { level: 1, name: "Pesanan" }),
  ).toBeVisible();
  await expect(
    isi(page).getByRole("img", { name: /^QRIS Pesanan/ }),
  ).toHaveCount(0);
  await expect(page.locator('[data-pemandangan="bayar"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { penandaHalaman?: boolean }).penandaHalaman,
    ),
  ).toBe(true);
});

test('di ponsel, "Simpan gambar QR" menempel di bilah lekat tepat di atas navigasi bawah', async ({
  page,
}) => {
  await checkoutSampaiHalamanBayar(page);

  const bilah = page.locator("[data-bilah-lekat]");
  await expect(bilah).toHaveCSS("position", "fixed");
  await expect(
    bilah.getByRole("link", { name: "Simpan gambar QR" }),
  ).toBeInViewport();
  const navigasi = page
    .getByRole("navigation", { name: "Navigasi utama" })
    .last();
  const kotakBilah = (await bilah.boundingBox())!;
  const kotakNavigasi = (await navigasi.boundingBox())!;
  expect(kotakBilah.y + kotakBilah.height).toBeCloseTo(kotakNavigasi.y, 0);
});

test("di layar lebar, bilah lekat Halaman bayar menjadi blok biasa di kolomnya", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await checkoutSampaiHalamanBayar(page);

  await expect(page.locator("[data-bilah-lekat]")).toHaveCSS(
    "position",
    "static",
  );
});

// DESIGN.md "Pemandangan senja": warna angka waktu dan Total bayar berganti antara #2A1F4D dan putih
// mengikuti luminans langit, supaya kontrasnya selalu minimal 4,5:1.
test("di lebar 360 px, teks kartu senja kontrasnya minimal 4,5:1 terhadap pemandangan di belakangnya sepanjang hitung mundur", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const dipesan = await checkoutSampaiHalamanBayar(page);
  const kedaluwarsa = dipesan.kedaluwarsaPada.getTime();
  await bukaDenganJamUji(page, dipesan.tautan);
  await page.evaluate(() => document.fonts.ready);

  // t ≈ 0,02; 0,25; 0,5; 0,75; dan 1.
  for (const sisa of [880, 675, 450, 225, 0]) {
    await page.clock.pauseAt(kedaluwarsa - sisa * 1000);
    await expect(angkaWaktu(page)).toHaveText(mmss(sisa));

    const kontras = await kontrasTeksKartu(page);
    expect(kontras.map(({ teks }) => teks)).toEqual([
      sisa === 0 ? "QRIS kedaluwarsa" : "sisa waktu bayar",
      mmss(sisa),
      "Total bayar",
      `Rp ${dipesan.totalBayar.toLocaleString("id-ID")}`,
    ]);
    for (const baris of kontras) {
      expect(baris.kontras, JSON.stringify(baris)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("di lebar 360 px, Halaman bayar dengan kartu senja tidak bisa digulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await checkoutSampaiHalamanBayar(page);
  await expect(kartuSenja(page).locator("svg")).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
