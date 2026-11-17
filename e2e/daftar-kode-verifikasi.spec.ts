import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { buatAdmin } from "../src/server/auth/buat-admin";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";

// Daftar sebagai Pendaftar dan kirim Kode verifikasi (T42, PRD §7.2, §7.3, §7.7, §10.2). Server e2e
// memakai email tiruan dari .env.ci (EMAIL_MODE=tiruan), yang menyimpan email di memori proses server,
// jadi email yang terkirim dibaca lewat /api/email-tiruan. Jeda 60 detik yang tepat diuji di test
// integrasi dengan jam palsu (src/server/auth/pendaftaran.test.ts); server e2e memakai jam asli.
const PASSWORD = "sandi-uji-daftar-1";
const PESAN_EMAIL_TERDAFTAR =
  "Email ini sudah terdaftar. Masuk dengan email ini, atau pakai Lupa password bila lupa password-nya.";
const PESAN_PASSWORD_SALAH =
  "Email atau password salah. Periksa keduanya, lalu coba masuk lagi.";
const PESAN_TUNGGU =
  /^Kode verifikasi baru bisa dikirim lagi dalam \d{1,2} detik\.$/;

const emailBaru = () => `pendaftar-${randomUUID()}@example.test`;

async function daftar(page: Page, email: string, password: string) {
  await page.goto("/daftar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Daftar" }).click();
}

/** Subjek email tiruan yang sudah dikirim server e2e ke alamat itu, urut menurut waktu kirim. */
async function subjekEmailKe(request: APIRequestContext, kepada: string) {
  const respons = await request.get(
    `/api/email-tiruan?kepada=${encodeURIComponent(kepada)}`,
  );
  expect(respons.status()).toBe(200);
  const isi = (await respons.json()) as { subjek: string }[];
  return isi.map(({ subjek }) => subjek);
}

const peringatan = (page: Page) => page.getByRole("main").getByRole("alert");

// UAT-G3 langkah 1–2.
test("password 7 karakter ditolak; password 8 karakter membawa ke halaman verifikasi dan mengirim email Kode verifikasi", async ({
  page,
  request,
}) => {
  const email = emailBaru();

  await daftar(page, email, "abc1234");
  await expect(page).toHaveURL("/daftar");
  await expect(
    page.getByText("Password kurang dari 8 karakter."),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  expect(await subjekEmailKe(request, email)).toEqual([]);

  await daftar(page, email, "abc12345");
  await expect(page).toHaveURL("/daftar/verifikasi");
  await expect(page.getByRole("main").getByText(email)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kirim ulang kode" }),
  ).toBeVisible();
  const subjek = await subjekEmailKe(request, email);
  expect(subjek).toHaveLength(1);
  expect(subjek[0]).toMatch(/^Kode verifikasi: \d{6}$/);
});

// UAT-G4 langkah 1.
test('"Kirim ulang kode" langsung setelah mendaftar ditolak dengan pesan untuk menunggu, tanpa email baru', async ({
  page,
  request,
}) => {
  const email = emailBaru();
  await daftar(page, email, PASSWORD);
  await expect(page).toHaveURL("/daftar/verifikasi");

  await page.getByRole("button", { name: "Kirim ulang kode" }).click();

  await expect(peringatan(page)).toHaveText(PESAN_TUNGGU);
  expect(await subjekEmailKe(request, email)).toHaveLength(1);
});

test("pendaftaran ulang sebelum 60 detik ditolak dengan pesan untuk menunggu, tanpa email baru", async ({
  page,
  request,
}) => {
  const email = emailBaru();
  await daftar(page, email, PASSWORD);
  await expect(page).toHaveURL("/daftar/verifikasi");

  await daftar(page, email, "sandi-uji-daftar-2");

  await expect(page).toHaveURL("/daftar");
  await expect(peringatan(page)).toHaveText(PESAN_TUNGGU);
  expect(await subjekEmailKe(request, email)).toHaveLength(1);
});

// UAT-G3 langkah 5.
test("email Member dan email Admin ditolak, juga bila ditulis huruf besar, dan tidak ada email yang terkirim", async ({
  page,
  request,
}) => {
  const emailMember = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email: emailMember, password: PASSWORD });
  const emailAdmin = `admin-${randomUUID()}@example.test`;
  await buatAdmin({ email: emailAdmin, password: PASSWORD });

  for (const email of [emailMember, emailAdmin]) {
    for (const diketik of [email, email.toUpperCase()]) {
      await daftar(page, diketik, "sandi-uji-daftar-2");
      await expect(page).toHaveURL("/daftar");
      await expect(peringatan(page)).toHaveText(PESAN_EMAIL_TERDAFTAR);
    }
    expect(await subjekEmailKe(request, email)).toEqual([]);
  }
});

// UAT-G3 langkah 2 dan PRD §7.5 ▶ Keputusan 2026-11-17.
test("login dengan email dan password Pendaftar ditolak dengan pesan password salah", async ({
  page,
}) => {
  const email = emailBaru();
  await daftar(page, email, PASSWORD);
  await expect(page).toHaveURL("/daftar/verifikasi");

  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(peringatan(page)).toHaveText(PESAN_PASSWORD_SALAH);
  await expect(page).toHaveURL("/masuk");
});

// PRD §13 ▶ Keputusan 2026-11-17: tautan ke halaman Daftar baru dipasang di T51.
test("tidak ada tautan ke halaman Daftar dari halaman toko yang dibuka Pembeli", async ({
  page,
}) => {
  const produkId = await sisipkanProduk({
    nama: `Uji Tautan Daftar ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 1 }],
  });

  for (const alamat of [
    "/",
    "/kategori",
    "/riwayat",
    "/akun",
    "/masuk",
    "/syarat-ketentuan",
    "/kebijakan-privasi",
    `/produk/${produkId}`,
  ]) {
    await page.goto(alamat);
    await expect(page.locator('a[href^="/daftar"]')).toHaveCount(0);
  }
});
