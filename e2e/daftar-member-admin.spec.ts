import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test. Database
// itu dipakai bersama test lain yang berjalan bersamaan, jadi setiap test hanya memeriksa Member miliknya
// sendiri, yang dicari lewat email unik.
import { db } from "../src/server/db";
import { pendaftar, varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

const PASSWORD_ADMIN = "sandi-uji-admin-123";
const PASSWORD_MEMBER = "sandi-uji-member-123";
const ALAMAT = "/admin/member";

let varianId = "";

test.beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: `Daftar Member ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
});

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

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

const isi = (page: Page) => page.getByRole("main");
const tabel = (page: Page) => isi(page).getByRole("table");

/** Teks setiap sel sebuah baris tabel, termasuk sel kepala baris. */
const teksSel = (baris: Locator) =>
  baris
    .locator("th, td")
    .evaluateAll((sel) =>
      sel.map((s) => (s.textContent ?? "").replace(/\s+/g, " ").trim()),
    );

/** Mengisi pencarian daftar Member, lalu menekan Cari. */
async function cari(page: Page, kata: string) {
  const form = isi(page).getByRole("search", { name: "Cari Member" });
  await form.getByLabel("Cari email").fill(kata);
  await form.getByRole("button", { name: "Cari" }).click();
}

// UAT-B3, PRD §2.3 ▶ Keputusan 2026-11-17: kolom daftar Member. Total belanja dihitung seperti Pendapatan
// (§9.3): Rp 45.123 + Rp 50.010 = Rp 95.133, tanpa Pesanan Bermasalah Rp 50.200.
test("Admin membuka menu Member, mencari dengan sebagian email berhuruf besar, dan melihat email, tanggal daftar, jumlah Pesanan Selesai, dan total belanja", async ({
  page,
}) => {
  const akhiran = randomUUID();
  const email = `budi+${akhiran}@mail.com`;
  await sisipkanMember({
    email,
    password: PASSWORD_MEMBER,
    terdaftarPada: new Date("2026-11-11T16:30:00Z"),
  });
  const dibayar = new Date("2026-11-11T09:00:00+07:00");
  await sisipkanPesanan({
    varianId,
    status: "Selesai",
    email,
    waktuBayar: dibayar,
  });
  await sisipkanPesanan({
    varianId,
    status: "Selesai",
    email: email.toUpperCase(),
    waktuBayar: dibayar,
    rincian: {
      hargaJual: 50000,
      potonganVoucher: 0,
      kodeUnik: 10,
      totalBayar: 50010,
    },
  });
  await sisipkanPesanan({
    varianId,
    status: "Bermasalah",
    email,
    waktuBayar: dibayar,
    rincian: {
      hargaJual: 50000,
      potonganVoucher: 0,
      kodeUnik: 200,
      totalBayar: 50200,
    },
  });
  await masukSebagaiAdmin(page);

  await page
    .getByRole("navigation", { name: "Menu admin" })
    .getByRole("link", { name: "Member" })
    .click();
  await expect(page).toHaveURL(ALAMAT);
  await expect(
    page.getByRole("heading", { level: 1, name: "Member" }),
  ).toBeVisible();

  await cari(page, `BUDI+${akhiran.toUpperCase()}`);

  await expect(tabel(page).getByRole("columnheader")).toHaveText([
    "Email",
    "Tanggal daftar (WIB)",
    "Pesanan Selesai",
    "Total belanja",
  ]);
  const baris = tabel(page).getByRole("row", { name: new RegExp(akhiran) });
  await expect(baris).toHaveCount(1);
  expect(await teksSel(baris)).toEqual([
    email,
    "11 Nov 2026",
    "2",
    "Rp 95.133",
  ]);
  // Admin tidak bisa melihat password Member (PRD §2.3).
  await expect(isi(page)).not.toContainText(PASSWORD_MEMBER);
  await expect(isi(page)).not.toContainText(/password/i);
});

// PRD §2.3 ▶ Keputusan 2026-11-17, §7.2: Pendaftar belum menjadi Member, jadi tidak tampil.
test("Pendaftar yang belum memasukkan Kode verifikasi tidak tampil di daftar Member", async ({
  page,
}) => {
  const email = `pendaftar-${randomUUID()}@mail.com`;
  await db.insert(pendaftar).values({
    email,
    password: "hash-uji",
    kodeVerifikasi: "123456",
    kodeDikirimPada: new Date(),
  });
  await masukSebagaiAdmin(page);

  await page.goto(ALAMAT);
  await cari(page, email);

  await expect(tabel(page)).toHaveCount(0);
  await expect(isi(page)).toContainText(
    `Tidak ada Member yang emailnya memuat "${email}".`,
  );
});

test("Tamu yang membuka daftar Member diarahkan ke halaman login /admin", async ({
  page,
}) => {
  await page.goto(ALAMAT);

  await expect(page).toHaveURL("/admin");
  await expect(
    page.getByRole("heading", { name: "Masuk ke dasbor admin" }),
  ).toBeVisible();
});

test("Member yang sedang login dan membuka daftar Member diarahkan ke halaman login /admin", async ({
  page,
}) => {
  const email = `budi-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");

  await page.goto(ALAMAT);

  await expect(page).toHaveURL("/admin");
  await expect(isi(page).getByRole("table")).toHaveCount(0);
});
