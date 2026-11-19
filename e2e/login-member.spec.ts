import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { sisipkanMember } from "../src/server/uji-member";

// Login dan keluar Member (T41, PRD §7.5 ▶ Keputusan 2026-11-11 dan 2026-11-17). Pendaftaran baru
// dibangun di T42 dan T43, jadi Member terverifikasi ditulis langsung ke database.
const PASSWORD_MEMBER = "sandi-uji-member-123";
const PASSWORD_ADMIN = "sandi-uji-admin-123";
const PESAN_PASSWORD_SALAH =
  "Email atau password salah. Periksa keduanya, lalu coba masuk lagi.";

async function memberBaru() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  return email;
}

// Menjalankan `pnpm admin:buat <email>` persis seperti pemilik di server, dengan password diketik
// dua kali lewat input. DATABASE_URL dari .env.ci (app_test) ikut diwariskan ke perintah itu.
function jalankanAdminBuat(email: string, password: string) {
  return spawnSync("pnpm", ["--silent", "admin:buat", email], {
    input: `${password}\n${password}\n`,
    encoding: "utf8",
  });
}

async function masukMember(page: Page, email: string, password: string) {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

const peringatan = (page: Page) => page.getByRole("main").getByRole("alert");

// UAT-G7 langkah 1: email Member diketik dengan huruf besar.
test("Member dengan password benar masuk dan dibawa ke Riwayat Pesanan, juga bila email diketik Member@MIWE.example", async ({
  page,
}) => {
  await sisipkanMember({
    email: "member@miwe.example",
    password: PASSWORD_MEMBER,
  });

  await masukMember(page, "Member@MIWE.example", PASSWORD_MEMBER);

  await expect(page).toHaveURL("/riwayat");
  await expect(
    page.getByRole("heading", { level: 1, name: "Riwayat Pesanan" }),
  ).toBeVisible();

  await page.goto("/akun");
  await expect(page.getByText("member@miwe.example")).toBeVisible();
});

test("password salah ditolak dengan pesan password salah, dan email tetap terisi", async ({
  page,
}) => {
  const email = await memberBaru();

  await masukMember(page, email, "password-yang-salah");

  await expect(peringatan(page)).toHaveText(PESAN_PASSWORD_SALAH);
  await expect(page).toHaveURL("/masuk");
  await expect(page.getByLabel("Email")).toHaveValue(email);
});

// UAT-G6 langkah 1–2. Jam kunci yang tepat diuji di test integrasi dengan jam palsu; server e2e
// memakai jam asli, jadi di sini cukup bentuk jam WIB-nya.
test("setelah password salah 5 kali berturut-turut, password benar pun ditolak dengan pesan kunci", async ({
  page,
}) => {
  const email = await memberBaru();
  const pesanTerkunci =
    /^Password salah 5 kali berturut-turut, jadi login dengan email ini dikunci 15 menit\. Coba masuk lagi mulai pukul \d{2}\.\d{2} WIB\.$/;

  for (let i = 1; i <= 4; i++) {
    await masukMember(page, email, "password-yang-salah");
    await expect(peringatan(page)).toHaveText(PESAN_PASSWORD_SALAH);
  }
  await masukMember(page, email, "password-yang-salah");
  await expect(peringatan(page)).toHaveText(pesanTerkunci);

  await masukMember(page, email, PASSWORD_MEMBER);
  await expect(peringatan(page)).toHaveText(pesanTerkunci);
  await expect(page).toHaveURL("/masuk");
});

test("email dan password Admin yang benar ditolak di halaman Masuk Member dengan pesan password salah", async ({
  page,
}) => {
  const email = `admin-${randomUUID()}@example.test`;
  const dibuat = jalankanAdminBuat(email, PASSWORD_ADMIN);
  expect(dibuat.status, dibuat.stderr).toBe(0);

  await masukMember(page, email, PASSWORD_ADMIN);

  await expect(peringatan(page)).toHaveText(PESAN_PASSWORD_SALAH);
  await expect(page).toHaveURL("/masuk");
});

// UAT-B1 langkah 2.
test("Member yang login lalu membuka /admin/ringkasan diarahkan ke halaman login Admin", async ({
  page,
}) => {
  await masukMember(page, await memberBaru(), PASSWORD_MEMBER);
  await expect(page).toHaveURL("/riwayat");

  await page.goto("/admin/ringkasan");

  await expect(page).toHaveURL("/admin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Masuk ke dasbor admin" }),
  ).toBeVisible();
});

test("tab Akun menampilkan email Member dan tombol Keluar, dan Keluar mengakhiri sesi Member", async ({
  page,
}) => {
  const email = await memberBaru();
  await masukMember(page, email, PASSWORD_MEMBER);
  await expect(page).toHaveURL("/riwayat");

  await page.goto("/akun");
  const isi = page.getByRole("main");
  await expect(isi.getByText(email)).toBeVisible();
  const keluar = isi.getByRole("button", { name: "Keluar" });
  await expect(keluar).toBeVisible();
  // Email dan Keluar berada di atas tautan halaman hukum di footer toko (PRD §11.1 ▶ Keputusan 2026-11-20).
  const tautanHukum = page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Syarat & Ketentuan" });
  await expect(tautanHukum).toBeVisible();
  expect((await keluar.boundingBox())!.y).toBeLessThan(
    (await tautanHukum.boundingBox())!.y,
  );

  await keluar.click();

  await expect(page).toHaveURL("/akun");
  await expect(isi.getByRole("button", { name: "Keluar" })).toHaveCount(0);
  await expect(isi.getByText(email)).toHaveCount(0);
  await page.reload();
  await expect(isi.getByText(email)).toHaveCount(0);
  await expect(tautanHukum).toBeVisible();
});

test("Tamu di tab Akun tidak melihat email maupun tombol Keluar", async ({
  page,
}) => {
  await page.goto("/akun");

  const isi = page.getByRole("main");
  await expect(isi.getByRole("button", { name: "Keluar" })).toHaveCount(0);
  await expect(
    isi.getByRole("link", { name: "Masuk", exact: true }),
  ).toBeVisible();
});

test("pnpm admin:buat dengan email Member ditolak, dan tidak ada Admin yang dibuat", async ({
  page,
}) => {
  const email = await memberBaru();

  const hasil = jalankanAdminBuat(email.toUpperCase(), PASSWORD_ADMIN);

  expect(hasil.status).not.toBe(0);
  expect(hasil.stderr).toContain("sudah dipakai Member");
  expect(hasil.stdout).not.toContain("sudah dibuat");

  // Email itu tidak bisa login di dasbor admin dengan password yang tadi diketik.
  await page.goto("/admin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_ADMIN);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(peringatan(page)).toHaveText(PESAN_PASSWORD_SALAH);
  await expect(page).toHaveURL("/admin");
});
