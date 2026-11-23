import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test. Database
// itu dipakai bersama test lain yang berjalan bersamaan, jadi setiap test memakai Produk dan email unik.
import { db } from "../src/server/db";
import { varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";

// Produk gratis di form Produk dan tampilan toko (T87, PRD §3.8, §7.3, §16.1, §16.3, §16.4, UAT-P1, UAT-P2, UAT-P4).
// Produknya meniru Akun Uji Gratis dari persiapan M6 di docs/UAT.md [CONTOH]: Format Item stok Email dan Password, satu
// Varian "Akun Baru" dengan Harga jual Rp 1.000, Harga normal Rp 15.000, Harga modal Rp 0, dan 5 Item stok Tersedia,
// dengan akhiran unik. Kode verifikasi dibaca dari email tiruan lewat /api/email-tiruan, seperti
// pilihan-saldo-tamu.spec.ts.
// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

const PASSWORD_ADMIN = "sandi-uji-admin-123";
const PASSWORD_MEMBER = "sandi-uji-member-123";
const AJAKAN_GRATIS = "Produk gratis khusus Member. Masuk atau Daftar dulu.";
const CATATAN_VARIAN =
  "Produk ini gratis. Harga jual dipakai lagi bila centang Produk gratis dilepas.";

// Daftar Produk di dasbor admin dan Beranda memuat semua Produk, dan app_test lokal bisa berisi ribuan Produk sisa
// test lain, jadi perpindahan ke halaman itu diberi waktu lebih longgar, sama seperti kelola-produk.spec.ts.
const NAVIGASI = { timeout: 15_000 };

test.use({ viewport: { width: 390, height: 800 } });

/**
 * Akun Uji Gratis baru [CONTOH]. Bila `batasPerMember` diisi, Produk itu langsung Produk gratis; bila tidak, Produk
 * itu Produk biasa. `nama` mengganti nama Produk dan `hargaNormal` mengganti Harga normal-nya.
 */
async function akunUjiGratis({
  batasPerMember = null,
  nama = `Akun Uji Gratis ${randomUUID().slice(0, 8)}`,
  hargaNormal = 15000,
}: {
  batasPerMember?: number | null;
  nama?: string;
  hargaNormal?: number;
} = {}) {
  const produkId = await sisipkanProduk({
    nama,
    formatItemStok: ["Email", "Password"],
    batasPerMember,
    varian: [
      {
        nama: "Akun Baru",
        hargaJual: 1000,
        hargaNormal,
        hargaModal: 0,
        Tersedia: 5,
      },
    ],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return { nama, produkId, varianId };
}

// Membuat Admin persis seperti pemilik di server: `pnpm admin:buat <email>`, password lewat input.
async function masukSebagaiAdmin(page: Page) {
  const email = `admin-${randomUUID()}@example.test`;
  const hasil = spawnSync("pnpm", ["--silent", "admin:buat", email], {
    input: `${PASSWORD_ADMIN}\n${PASSWORD_ADMIN}\n`,
    encoding: "utf8",
  });
  expect(hasil.status, hasil.stderr).toBe(0);
  await page.goto("/admin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_ADMIN);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/admin/ringkasan");
}

/** Menekan Simpan di form Produk dengan Batas per Member itu. */
async function simpanBatas(page: Page, batas: string) {
  await page.getByLabel("Batas per Member").fill(batas);
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
}

/** Kartu Produk itu di bagian hasil pencarian Beranda. */
async function kartuDiBeranda(page: Page, nama: string) {
  await page.goto(`/?${new URLSearchParams({ q: nama })}`, NAVIGASI);
  return page
    .getByRole("region", { name: "Hasil pencarian" })
    .getByRole("link")
    .filter({ hasText: nama });
}

/** Kode dari email "Kode verifikasi: <kode>" terakhir yang dikirim server e2e ke alamat itu. */
async function kodeTerakhir(request: APIRequestContext, kepada: string) {
  const respons = await request.get(
    `/api/email-tiruan?kepada=${encodeURIComponent(kepada)}`,
  );
  const isi = (await respons.json()) as { subjek: string }[];
  const cocok = /^Kode verifikasi: (\d{6})$/.exec(isi.at(-1)?.subjek ?? "");
  if (!cocok) throw new Error(`Belum ada email Kode verifikasi ke ${kepada}.`);
  return cocok[1];
}

const bisaDigulirKeSamping = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );

test("UAT-P1: Batas per Member kosong, 1000, dan 2.5 ditolak dengan pesan, 2 tersimpan dan Produk ditandai Gratis, form Varian menampilkan catatannya, lalu kartu dan Halaman Produk menampilkan Gratis", async ({
  page,
}) => {
  // Test ini membuka daftar Produk dan Beranda, yang memuat semua Produk, jadi diberi waktu tiga kali bawaan.
  test.slow();
  const { nama, produkId } = await akunUjiGratis();
  await masukSebagaiAdmin(page);

  // Langkah 1 dan 2.
  await page.goto(`/admin/produk/${produkId}`);
  const centang = page.getByLabel("Produk gratis", { exact: true });
  await expect(centang).not.toBeChecked();
  await centang.check();
  await simpanBatas(page, "");
  await expect(
    page.getByText(
      "Batas per Member belum diisi, padahal Produk gratis wajib punya Batas per Member. Tulis angka 1 sampai 999, misalnya 5, lalu simpan lagi.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Batas per Member")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(centang).toBeChecked();

  await simpanBatas(page, "1000");
  await expect(
    page.getByText(
      "Batas per Member hanya boleh 1 sampai 999. Tulis angka di rentang itu, lalu simpan lagi.",
    ),
  ).toBeVisible();

  await simpanBatas(page, "2.5");
  await expect(
    page.getByText(
      "Batas per Member harus bilangan bulat, tanpa koma, titik, atau huruf. Tulis angka 1 sampai 999, misalnya 5, lalu simpan lagi.",
    ),
  ).toBeVisible();

  await simpanBatas(page, "2");
  await expect(page).toHaveURL("/admin/produk", NAVIGASI);
  const baris = page
    .getByRole("row")
    .filter({ has: page.getByText(nama, { exact: true }) });
  await expect(baris.getByText("Gratis", { exact: true })).toBeVisible();

  // Langkah 3: Harga jual tetap terisi dan wajib, dengan catatan Produk gratis.
  await page.goto(`/admin/produk/${produkId}`);
  await expect(page.getByLabel("Batas per Member")).toHaveValue("2");
  await page.getByRole("button", { name: "Ubah Varian Akun Baru" }).click();
  const formVarian = page.getByRole("form", { name: "Ubah Varian Akun Baru" });
  await expect(formVarian.getByLabel("Harga jual")).toHaveValue("1.000");
  await expect(formVarian.getByText(CATATAN_VARIAN)).toBeVisible();

  // Langkah 4: kartu Produk menampilkan "Gratis" tanpa "Mulai", dengan Harga normal Rp 15.000 dicoret tanpa Hemat.
  const kartu = await kartuDiBeranda(page, nama);
  await expect(kartu).toContainText("Gratis");
  await expect(kartu).not.toContainText("Mulai");
  await expect(kartu).not.toContainText("Rp 1.000");
  await expect(kartu.locator("s")).toHaveText("Harga normal Rp 15.000");
  await expect(kartu.getByText(/Hemat/)).toHaveCount(0);

  await kartu.click();
  await expect(page).toHaveURL(`/produk/${produkId}`);
  await expect(
    page.getByText("Gratis khusus Member, maksimal 2 per Member"),
  ).toBeVisible();
  await expect(page.getByText("Gratis", { exact: true })).toBeVisible();
  await expect(page.locator("s")).toHaveText("Harga normal Rp 15.000");
  await expect(page.getByText(/Hemat/)).toHaveCount(0);
  await expect(page.getByText("Stok 5")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Beli · Gratis" }),
  ).toBeVisible();
});

test("UAT-P2: Tamu di Checkout Akun Uji Gratis melihat ajakan Masuk atau Daftar tanpa form, lalu setelah Daftar dan Kode verifikasi benar kembali ke Checkout yang sama dengan jatah sisa 2 dari 2", async ({
  page,
  request,
}) => {
  const { varianId } = await akunUjiGratis({ batasPerMember: 2 });
  const email = `pendaftar-${randomUUID()}@example.test`;
  const alamatCheckout = `/checkout?varianId=${varianId}`;

  // Langkah 1: ajakan tanpa form, isian voucher, maupun tombol bayar. Hanya "Masuk" dan "Daftar" yang menjadi tautan.
  await page.goto(alamatCheckout);
  const ajakan = page.getByText(AJAKAN_GRATIS);
  await expect(ajakan).toBeVisible();
  await expect(ajakan.getByRole("link")).toHaveText(["Masuk", "Daftar"]);
  await expect(ajakan.getByRole("link", { name: "Masuk" })).toHaveAttribute(
    "href",
    `/masuk?${new URLSearchParams({ kembali: alamatCheckout })}`,
  );
  await expect(page.getByRole("textbox", { name: "Email" })).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Kode voucher (opsional)" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Bayar|Ambil gratis/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("radiogroup", { name: "Bayar dengan" }),
  ).toHaveCount(0);

  // Langkah 2.
  await ajakan.getByRole("link", { name: "Daftar" }).click();
  await expect(page).toHaveURL(
    `/daftar?${new URLSearchParams({ tujuan: alamatCheckout })}`,
  );
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page).toHaveURL(/\/daftar\/verifikasi\?tujuan=/);
  await page
    .getByLabel("Kode verifikasi")
    .fill(await kodeTerakhir(request, email));
  await page.getByRole("button", { name: "Verifikasi" }).click();

  await expect(page).toHaveURL(alamatCheckout);
  await expect(page.getByText("Jatah Anda: sisa 2 dari 2")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(
    page.getByRole("button", { name: "Ambil gratis" }),
  ).toBeVisible();
  await expect(page.getByText(AJAKAN_GRATIS)).toHaveCount(0);
});

test("UAT-P4 langkah 4–5: setelah Admin melepas centang Produk gratis, Halaman Produk menampilkan Harga jual lagi dan Checkout membuat Pesanan QRIS seperti biasa", async ({
  page,
  browser,
}) => {
  test.slow();
  const { produkId, varianId } = await akunUjiGratis({ batasPerMember: 2 });

  const halamanAdmin = await (await browser.newContext()).newPage();
  await masukSebagaiAdmin(halamanAdmin);
  await halamanAdmin.goto(`/admin/produk/${produkId}`);
  await halamanAdmin.getByLabel("Produk gratis", { exact: true }).uncheck();
  await halamanAdmin
    .getByRole("button", { name: "Simpan", exact: true })
    .click();
  await expect(halamanAdmin).toHaveURL("/admin/produk", NAVIGASI);

  await page.goto(`/produk/${produkId}`);
  await expect(page.getByText("Rp 1.000", { exact: true })).toBeVisible();
  await expect(page.getByText(/Gratis khusus Member/)).toHaveCount(0);
  await expect(page.getByText("Hemat 93%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Beli · Rp 1.000" }).click();

  await expect(page).toHaveURL(`/checkout?varianId=${varianId}`);
  await expect(page.getByText(AJAKAN_GRATIS)).toHaveCount(0);
  await expect(
    page
      .getByRole("radiogroup", { name: "Bayar dengan" })
      .getByRole("radio", { name: "QRIS" }),
  ).toBeChecked();
  await page
    .getByRole("textbox", { name: "Email" })
    .fill(`budi-${randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();
});

test("di lebar 360 px, kartu dan Halaman Produk gratis dengan nama panjang dan Harga normal sangat besar tampil tanpa gulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const { nama, produkId } = await akunUjiGratis({
    batasPerMember: 999,
    nama: `Akun Uji Gratis Keluarga Premium Sepanjang Tahun ${randomUUID().slice(0, 8)}`,
    hargaNormal: 9_000_000_000_000_000,
  });

  const kartu = await kartuDiBeranda(page, nama);
  await expect(kartu).toContainText("Gratis");
  expect(await bisaDigulirKeSamping(page)).toBe(false);

  await page.goto(`/produk/${produkId}`);
  await expect(
    page.getByText("Gratis khusus Member, maksimal 999 per Member"),
  ).toBeVisible();
  expect(await bisaDigulirKeSamping(page)).toBe(false);
});
