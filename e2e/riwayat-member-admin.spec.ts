import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test. Database
// itu dipakai bersama test lain yang berjalan bersamaan, jadi setiap test memakai Member dengan email unik.
import type { StatusPesanan } from "../src/domain/status-pesanan";
import { db } from "../src/server/db";
import { user, varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

// Riwayat Pesanan Member di dasbor admin (T50, PRD §2.3 ▶ Keputusan 2026-11-17, §7.4, §9.5).

const PASSWORD_ADMIN = "sandi-uji-admin-123";
const PASSWORD_MEMBER = "sandi-uji-member-123";
const NAMA_PRODUK = `Riwayat Admin ${randomUUID().slice(0, 8)}`;
let varianId = "";

test.beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: NAMA_PRODUK,
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

/** Member baru dengan email unik, beserta id-nya. */
async function memberBaru() {
  const email = `budi-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return { email, id };
}

/** Pesanan beremail itu dengan status itu, dibuat pada waktu itu. */
const pesananPada = (
  email: string,
  status: StatusPesanan,
  dibuatPada: string,
) =>
  sisipkanPesanan({
    varianId,
    status,
    email,
    dibuatPada: new Date(dibuatPada),
  });

// UAT-B3, PRD §2.3 ▶ Keputusan 2026-11-17 dan §7.4: isi Riwayat Pesanan sama dengan Riwayat Pesanan Member
// di toko, terbaru di atas, dengan kolom daftar Pesanan admin (§9.5).
test("Admin membuka Riwayat Pesanan Member dari daftar Member dan melihat Pesanan semua status dengan email Member itu, termasuk yang ditulis huruf besar, terbaru di atas", async ({
  page,
}) => {
  const { email, id } = await memberBaru();
  const kembali = await pesananPada(
    email,
    "Dana Dikembalikan",
    "2026-11-02T21:10:00+07:00",
  );
  const batal = await pesananPada(
    email,
    "Dibatalkan",
    "2026-11-08T13:22:00+07:00",
  );
  const kedaluwarsa = await pesananPada(
    email,
    "Kedaluwarsa",
    "2026-11-09T08:40:00+07:00",
  );
  const masalah = await pesananPada(
    email,
    "Bermasalah",
    "2026-11-10T22:05:00+07:00",
  );
  const menunggu = await pesananPada(
    email,
    "Menunggu Pembayaran",
    "2026-11-11T19:52:00+07:00",
  );
  const selesaiTamu = await pesananPada(
    email.toUpperCase(),
    "Selesai",
    "2026-11-11T20:14:00+07:00",
  );
  const lain = await pesananPada(
    `lain-${randomUUID()}@mail.com`,
    "Selesai",
    "2026-11-12T10:00:00+07:00",
  );
  await masukSebagaiAdmin(page);

  await page.goto(`/admin/member?cari=${encodeURIComponent(email)}`);
  await tabel(page).getByRole("link", { name: email }).click();

  await expect(page).toHaveURL(`/admin/member/${id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Riwayat Pesanan" }),
  ).toBeVisible();
  await expect(isi(page)).toContainText(email);

  // Kolomnya sama dengan daftar Pesanan admin (PRD §9.5).
  await expect(tabel(page).getByRole("columnheader")).toHaveText([
    "Nomor Pesanan",
    "Waktu dibuat (WIB)",
    "Email",
    "Produk dan Varian",
    "Total bayar",
    "Status",
  ]);

  const baris = tabel(page).locator("tbody tr");
  await expect(baris).toHaveCount(6);
  const urutan = [
    [selesaiTamu, "Selesai"],
    [menunggu, "Menunggu Pembayaran"],
    [masalah, "Bermasalah"],
    [kedaluwarsa, "Kedaluwarsa"],
    [batal, "Dibatalkan"],
    [kembali, "Dana Dikembalikan"],
  ] as const;
  for (const [i, [dipesan, status]] of urutan.entries()) {
    await expect(baris.nth(i)).toContainText(dipesan.nomorPesanan);
    await expect(baris.nth(i)).toContainText(status);
  }
  await expect(tabel(page)).not.toContainText(lain.nomorPesanan);

  const pertama = baris.first();
  await expect(pertama).toContainText("11 Nov 2026 20.14");
  await expect(pertama).toContainText(email.toUpperCase());
  await expect(pertama).toContainText(`${NAMA_PRODUK} · 1 Bulan`);
  await expect(pertama).toContainText("Rp 45.123");
});

// PRD §2.3 ▶ Keputusan 2026-11-17: setiap Pesanan menaut ke detail Pesanan di dasbor admin (§9.5).
test("Setiap baris Riwayat Pesanan Member membuka detail Pesanan di dasbor admin", async ({
  page,
}) => {
  const { email, id } = await memberBaru();
  const dipesan = await pesananPada(
    email,
    "Menunggu Pembayaran",
    "2026-11-11T19:52:00+07:00",
  );
  await masukSebagaiAdmin(page);

  await page.goto(`/admin/member/${id}`);
  await tabel(page).getByRole("link", { name: dipesan.nomorPesanan }).click();

  await expect(page).toHaveURL(`/admin/pesanan/${dipesan.nomorPesanan}`);
  await expect(
    page.getByRole("heading", { level: 1, name: dipesan.nomorPesanan }),
  ).toBeVisible();
});

test("Riwayat Pesanan Member tanpa Pesanan menampilkan pesan kosong", async ({
  page,
}) => {
  const { id } = await memberBaru();
  await masukSebagaiAdmin(page);

  await page.goto(`/admin/member/${id}`);

  await expect(tabel(page)).toHaveCount(0);
  await expect(isi(page)).toContainText("Belum ada Pesanan dengan email ini.");
});

test("Tamu yang membuka Riwayat Pesanan Member di dasbor admin diarahkan ke halaman login /admin", async ({
  page,
}) => {
  const { email, id } = await memberBaru();
  await pesananPada(email, "Selesai", "2026-11-11T20:14:00+07:00");

  await page.goto(`/admin/member/${id}`);

  await expect(page).toHaveURL("/admin");
  await expect(
    page.getByRole("heading", { name: "Masuk ke dasbor admin" }),
  ).toBeVisible();
  await expect(tabel(page)).toHaveCount(0);
});

test("Member yang sedang login dan membuka Riwayat Pesanan Member di dasbor admin diarahkan ke halaman login /admin", async ({
  page,
}) => {
  const { email, id } = await memberBaru();
  await pesananPada(email, "Selesai", "2026-11-11T20:14:00+07:00");
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");

  await page.goto(`/admin/member/${id}`);

  await expect(page).toHaveURL("/admin");
  await expect(tabel(page)).toHaveCount(0);
});
