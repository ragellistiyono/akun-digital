import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dan ITEM_STOK_KEY berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk
// ke database app_test dan Item stok-nya dienkripsi dengan kunci uji. Kode verifikasi dibaca dari email
// tiruan lewat /api/email-tiruan.
import { db } from "../src/server/db";
import { varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

// Ajakan buat akun di Halaman Pesanan Selesai (T52, PRD §7.1 ▶ Keputusan 2026-11-17, UAT-G1, UAT-G2).
// Pesanan dan Member ditulis langsung ke database. Data Produk dan Member sintetis.
const akhiran = randomUUID().slice(0, 8);
const PASSWORD = "sandi-uji-ajakan-1";
let varianId = "";

test.beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: `Ajakan Akun ${akhiran}`,
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
const blokItemStok = (page: Page) =>
  isi(page).getByRole("region", { name: "Item stok Anda" });
const panelAjakan = (page: Page) =>
  isi(page).getByRole("region", {
    name: "Buat akun untuk menyimpan riwayat",
  });
const tautanLogin = (page: Page) =>
  isi(page).getByRole("link", { name: "Login untuk melihat riwayat" });
const tautanRiwayat = (page: Page) =>
  isi(page).getByRole("link", { name: "Lihat Riwayat Pesanan" });

const emailBaru = (awalan: string) => `${awalan}-${randomUUID()}@example.test`;

/**
 * Pesanan Selesai beremail itu dengan Item stok Terkirim berisi kode unik, karena isi Item stok tidak boleh
 * kembar dalam satu Varian. Hasilnya Tautan dan Nomor Pesanan beserta kode itu.
 */
async function pesananSelesai(email: string) {
  const kode = `KODE-AJAKAN-${randomUUID().slice(0, 8)}`;
  const dipesan = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    email,
    dibuatPada: new Date(),
    itemStok: {
      status: "Terkirim",
      nilai: [kode],
      formatSaatTerkirim: ["Kode"],
    },
  });
  return { ...dipesan, kode };
}

/** Kode dari email "Kode verifikasi: <kode>" terakhir yang dikirim server e2e ke alamat itu. */
async function kodeTerakhir(request: APIRequestContext, kepada: string) {
  const respons = await request.get(
    `/api/email-tiruan?kepada=${encodeURIComponent(kepada)}`,
  );
  const surat = (await respons.json()) as { subjek: string }[];
  const cocok = /^Kode verifikasi: (\d{6})$/.exec(surat.at(-1)?.subjek ?? "");
  if (!cocok) throw new Error(`Belum ada email Kode verifikasi ke ${kepada}.`);
  return cocok[1];
}

async function masukSebagai(page: Page, email: string) {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");
}

// UAT-G1.
test("Tamu dengan email yang belum Member melihat Item stok lalu panel ajakan di bawahnya, membuat password, memasukkan Kode verifikasi, lalu langsung masuk ke Riwayat Pesanan yang memuat Pesanan itu", async ({
  page,
  request,
}) => {
  const email = emailBaru("tamu");
  const kedaluwarsa = await sisipkanPesanan({
    varianId,
    status: "Kedaluwarsa",
    email,
    dibuatPada: new Date(Date.now() - 60 * 60 * 1000),
  });
  const selesai = await pesananSelesai(email);

  await page.goto(`/pesanan/${selesai.tautan}`);

  await expect(blokItemStok(page)).toContainText(selesai.kode);
  const panel = panelAjakan(page);
  await expect(panel).toBeVisible();
  // Panel ajakan berbingkai 2 px monogram (DESIGN.md Cards / Containers), di bawah Item stok.
  await expect(panel).toHaveCSS("border-top-width", "2px");
  await expect(panel).toHaveCSS("border-top-color", "rgb(143, 97, 255)");
  const kotakItemStok = await blokItemStok(page).boundingBox();
  const kotakPanel = await panel.boundingBox();
  expect(kotakPanel!.y).toBeGreaterThanOrEqual(
    kotakItemStok!.y + kotakItemStok!.height,
  );
  // Email Pesanan tampil dan tidak bisa diubah: panel hanya punya isian password.
  await expect(panel).toContainText(email);
  await expect(panel.getByRole("textbox")).toHaveCount(1);
  await expect(panel.getByRole("textbox")).toHaveAttribute("type", "password");
  await expect(tautanLogin(page)).toHaveCount(0);

  await panel.getByLabel("Password").fill(PASSWORD);
  await panel.getByRole("button", { name: "Buat akun" }).click();

  await expect(page).toHaveURL("/daftar/verifikasi");
  await expect(isi(page)).toContainText(email);
  await page
    .getByLabel("Kode verifikasi")
    .fill(await kodeTerakhir(request, email));
  await page.getByRole("button", { name: "Verifikasi" }).click();

  await expect(page).toHaveURL("/riwayat");
  const riwayat = isi(page).getByRole("list", { name: "Riwayat Pesanan" });
  await expect(riwayat.getByRole("listitem")).toHaveCount(2);
  await expect(riwayat.getByRole("listitem").first()).toContainText(
    selesai.nomorPesanan,
  );
  await expect(riwayat).toContainText(kedaluwarsa.nomorPesanan);
});

test("password kurang dari 8 karakter di panel ajakan ditolak dengan sebabnya", async ({
  page,
}) => {
  const { tautan } = await pesananSelesai(emailBaru("tamu"));
  await page.goto(`/pesanan/${tautan}`);

  await panelAjakan(page).getByLabel("Password").fill("1234567");
  await panelAjakan(page).getByRole("button", { name: "Buat akun" }).click();

  await expect(panelAjakan(page)).toContainText(
    "Password kurang dari 8 karakter. Buat password dengan minimal 8 karakter.",
  );
  await expect(page).toHaveURL(`/pesanan/${tautan}`);
});

test("email Pendaftar yang belum memasukkan Kode verifikasi tetap mendapat panel ajakan", async ({
  page,
}) => {
  const email = emailBaru("pendaftar");
  await page.goto("/daftar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page).toHaveURL("/daftar/verifikasi");
  const { tautan } = await pesananSelesai(email);

  await page.goto(`/pesanan/${tautan}`);

  await expect(panelAjakan(page)).toBeVisible();
  await expect(tautanLogin(page)).toHaveCount(0);
});

// UAT-G2.
test('Pesanan dengan email Member menampilkan "Login untuk melihat riwayat" untuk Tamu, "Lihat Riwayat Pesanan" untuk Member itu, dan tanpa ajakan untuk Member lain, dengan Item stok yang selalu tampil', async ({
  page,
}) => {
  const emailMember = emailBaru("member");
  const emailLain = emailBaru("lain");
  await sisipkanMember({ email: emailMember, password: PASSWORD });
  await sisipkanMember({ email: emailLain, password: PASSWORD });
  const selesai = await pesananSelesai(emailMember.toUpperCase());
  const { tautan } = selesai;

  // Langkah 1: tanpa login.
  await page.goto(`/pesanan/${tautan}`);
  await expect(blokItemStok(page)).toContainText(selesai.kode);
  await expect(tautanLogin(page)).toHaveAttribute("href", "/masuk");
  await expect(panelAjakan(page)).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);

  // Langkah 2: login sebagai Member pemilik email Pesanan.
  await masukSebagai(page, emailMember);
  await page.goto(`/pesanan/${tautan}`);
  await expect(blokItemStok(page)).toContainText(selesai.kode);
  await expect(tautanRiwayat(page)).toHaveAttribute("href", "/riwayat");
  await expect(tautanLogin(page)).toHaveCount(0);
  await expect(panelAjakan(page)).toHaveCount(0);

  // Langkah 3: Member lain.
  await page.context().clearCookies();
  await masukSebagai(page, emailLain);
  await page.goto(`/pesanan/${tautan}`);
  await expect(blokItemStok(page)).toContainText(selesai.kode);
  await expect(tautanRiwayat(page)).toHaveCount(0);
  await expect(tautanLogin(page)).toHaveCount(0);
  await expect(panelAjakan(page)).toHaveCount(0);
});

// PRD §11.1.
test("di lebar 360 px, Halaman Pesanan dengan panel ajakan dan email yang panjang tidak bisa digulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const { tautan } = await pesananSelesai(
    `${"pembeli.dengan.nama.panjang".repeat(3)}-${randomUUID()}@example.test`,
  );

  await page.goto(`/pesanan/${tautan}`);

  await expect(panelAjakan(page)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});
