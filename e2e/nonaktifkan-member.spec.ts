import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { inArray } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test. Database
// itu dipakai bersama test lain yang berjalan bersamaan, jadi Member di sini memakai email dengan akhiran unik,
// bukan member@miwe.example dari persiapan UAT.
import { db } from "../src/server/db";
import { pesanan } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";

// Menonaktifkan dan mengaktifkan kembali Member (T48, PRD §2.3, §5.2, §7.5 ▶ Keputusan 2026-11-17, UAT-B3).
// Tombol WhatsApp di pesan nonaktif diuji di pengaturan-toko.spec.ts, karena hanya berkas itu yang mengubah
// nomor WhatsApp.
const PASSWORD_ADMIN = "sandi-uji-admin-123";
const PASSWORD_MEMBER = "sandi-uji-member-123";
const PESAN_LOGIN_NONAKTIF =
  "Akun Member ini dinonaktifkan, jadi tidak bisa masuk. Hubungi kami di WhatsApp.";
const PESAN_CHECKOUT_NONAKTIF =
  "Email ini milik Member yang dinonaktifkan, jadi Pesanan tidak dibuat. Hubungi kami di WhatsApp.";

// Membuat Admin persis seperti pemilik di server: `pnpm admin:buat <email>`, password lewat input.
function buatAdminLewatPerintah() {
  const email = `admin-${randomUUID()}@example.test`;
  const hasil = spawnSync("pnpm", ["--silent", "admin:buat", email], {
    input: `${PASSWORD_ADMIN}\n${PASSWORD_ADMIN}\n`,
    encoding: "utf8",
  });
  expect(hasil.status, hasil.stderr).toBe(0);
  return email;
}

async function masukSebagaiAdmin(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(buatAdminLewatPerintah());
  await page.getByLabel("Password").fill(PASSWORD_ADMIN);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/admin/ringkasan");
}

async function masukMember(page: Page, email: string) {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();
}

/** Membuka daftar Member lalu mencari dengan kata itu. */
async function cariMember(page: Page, kata: string) {
  await page.goto("/admin/member");
  const form = page.getByRole("search", { name: "Cari Member" });
  await form.getByLabel("Cari email").fill(kata);
  await form.getByRole("button", { name: "Cari" }).click();
}

const isi = (page: Page) => page.getByRole("main");

test("UAT-B3: Admin menonaktifkan Member, Member itu keluar, tidak bisa login maupun checkout, lalu bisa login lagi setelah diaktifkan kembali", async ({
  browser,
}) => {
  const akhiran = randomUUID();
  const email = `member+${akhiran}@miwe.example`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  const produkId = await sisipkanProduk({
    nama: `Netflix Premium ${akhiran.slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 2 }],
  });
  const ponsel = await (
    await browser.newContext({ viewport: { width: 390, height: 800 } })
  ).newPage();
  const laptop = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage();

  // Langkah 1: di ponsel, Member itu login.
  await masukMember(ponsel, email);
  await expect(ponsel).toHaveURL("/riwayat");

  // Langkah 2: di laptop, Admin mencari dengan huruf besar lalu menonaktifkan Member itu, tanpa penegasan.
  await masukSebagaiAdmin(laptop);
  await cariMember(laptop, `MEMBER+${akhiran.toUpperCase()}`);
  const baris = isi(laptop).getByRole("row", { name: new RegExp(akhiran) });
  await expect(baris.getByText("Aktif", { exact: true })).toBeVisible();
  await baris.getByRole("button", { name: `Nonaktifkan ${email}` }).click();
  await expect(baris.getByText("Nonaktif", { exact: true })).toBeVisible();
  await expect(
    baris.getByRole("button", { name: `Aktifkan kembali ${email}` }),
  ).toBeVisible();
  // Admin tidak pernah melihat password Member (PRD §2.3).
  await expect(isi(laptop)).not.toContainText(PASSWORD_MEMBER);

  // Langkah 3: ponsel sudah keluar setelah dimuat ulang.
  await ponsel.goto("/akun");
  await ponsel.reload();
  await expect(isi(ponsel).getByText(email)).toHaveCount(0);
  await expect(isi(ponsel).getByRole("button", { name: "Keluar" })).toHaveCount(
    0,
  );

  // Langkah 4: login dengan password benar ditolak dengan pesan nonaktif.
  await masukMember(ponsel, email);
  await expect(isi(ponsel).getByRole("alert")).toHaveText(PESAN_LOGIN_NONAKTIF);
  await expect(ponsel).toHaveURL("/masuk");

  // Langkah 5: sebagai Tamu, checkout dengan email itu (ditulis huruf besar) ditolak tanpa Pesanan.
  await ponsel.goto(`/produk/${produkId}`);
  await ponsel.getByRole("button", { name: /^Beli/ }).click();
  await expect(
    ponsel.getByRole("heading", { level: 1, name: "Checkout" }),
  ).toBeVisible();
  await ponsel
    .getByRole("textbox", { name: "Email" })
    .fill(email.toUpperCase());
  await ponsel.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(isi(ponsel).getByRole("alert")).toHaveText(
    PESAN_CHECKOUT_NONAKTIF,
  );
  expect(
    await db
      .select({ id: pesanan.id })
      .from(pesanan)
      .where(inArray(pesanan.email, [email, email.toUpperCase()])),
  ).toEqual([]);

  // Langkah 6: Admin mengaktifkan kembali Member itu, lalu Member itu login lagi.
  await baris
    .getByRole("button", { name: `Aktifkan kembali ${email}` })
    .click();
  await expect(baris.getByText("Aktif", { exact: true })).toBeVisible();
  await masukMember(ponsel, email);
  await expect(ponsel).toHaveURL("/riwayat");

  await ponsel.context().close();
  await laptop.context().close();
});
