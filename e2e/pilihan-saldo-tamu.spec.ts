import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { eq, sql } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test. Database
// itu dipakai bersama test lain yang berjalan bersamaan, jadi setiap test memakai Produk, Member, dan email unik.
import { db } from "../src/server/db";
import { pendaftar, user, varian } from "../src/server/db/schema";
import { ubahSaldoOlehAdmin } from "../src/server/saldo";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";

// Pilihan Saldo untuk Tamu di Checkout (T85, PRD §7.3, §15.7 ▶ Keputusan 2026-11-22, UAT-O10). Produknya meniru
// Uji Bayar Rp 1.000 dari persiapan bersama docs/UAT.md [CONTOH], dengan akhiran unik. Kode verifikasi dibaca dari
// email tiruan lewat /api/email-tiruan, dan jeda 60 detik "Kirim ulang kode" dilewati dengan memundurkan waktu
// kirim kode di database, seperti masukkan-kode-verifikasi.spec.ts.

const PASSWORD_MEMBER = "sandi-uji-member-123";
const AJAKAN_SALDO =
  "Bayar pakai saldo khusus Member. Masuk, atau Daftar lalu top up.";
const PESAN_KODE_SALAH =
  "Kode verifikasi salah. Periksa lagi kode di email terakhir dari kami.";

test.use({ viewport: { width: 390, height: 800 } });

/** Id Varian satu-satunya Produk Uji Bayar baru dengan Harga jual Rp 1.000 dan 5 Item stok Tersedia. */
async function varianUjiBayar() {
  const akhiran = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const produkId = await sisipkanProduk({
    nama: `Uji Bayar ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 1000, Tersedia: 5 }],
  });
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return id;
}

/** Email Member baru yang saldonya ditambah Admin sebesar itu. */
async function memberDenganSaldo(saldo: number) {
  const email = `budi-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  await ubahSaldoOlehAdmin({
    idMember: id,
    aksi: "tambah",
    nominal: String(saldo),
    keterangan: "Saldo awal test",
  });
  return email;
}

const pilihanMetode = (page: Page) =>
  page.getByRole("radiogroup", { name: "Bayar dengan" });

const ajakanSaldo = (page: Page) => page.getByText(AJAKAN_SALDO);

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

const kodeLainDari = (kode: string) =>
  kode === "000000" ? "111111" : "000000";

/** Memundurkan waktu kirim kode terakhir Pendaftar itu sebanyak `detik`. */
async function mundurkanKode(email: string, detik: number) {
  await db
    .update(pendaftar)
    .set({
      kodeDikirimPada: sql`${pendaftar.kodeDikirimPada} - make_interval(secs => ${detik})`,
    })
    .where(eq(pendaftar.email, email));
}

async function masukkanKode(page: Page, kode: string) {
  // Tunggu kiriman sebelumnya selesai, karena form dikosongkan setelah setiap kiriman.
  const tombol = page.getByRole("button", { name: "Verifikasi" });
  await expect(tombol).toBeEnabled();
  await page.getByLabel("Kode verifikasi").fill(kode);
  await tombol.click();
}

test("UAT-O10 langkah 1: Tamu di Checkout Uji Bayar melihat pilihan Saldo yang tidak bisa dipilih beserta ajakannya, QRIS terpilih, dan tombolnya Bayar dengan QRIS", async ({
  page,
}) => {
  const varianId = await varianUjiBayar();

  await page.goto(`/checkout?varianId=${varianId}`);

  const saldo = pilihanMetode(page).getByRole("radio", {
    name: "Saldo",
    exact: true,
  });
  await expect(saldo).toBeDisabled();
  await expect(saldo).not.toBeChecked();
  await expect(
    pilihanMetode(page).getByRole("radio", { name: "QRIS" }),
  ).toBeChecked();

  // Hanya "Masuk" dan "Daftar" yang menjadi tautan, dan kalimatnya berada di luar kartu yang diredupkan.
  await expect(ajakanSaldo(page)).toBeVisible();
  await expect(ajakanSaldo(page).getByRole("link")).toHaveText([
    "Masuk",
    "Daftar",
  ]);
  await expect(
    pilihanMetode(page).locator("label").filter({ hasText: AJAKAN_SALDO }),
  ).toHaveCount(0);

  await expect(
    page.getByRole("button", { name: "Bayar dengan QRIS" }),
  ).toBeVisible();
});

test("UAT-O10 langkah 2: Masuk di pilihan Saldo lalu login membawa Member kembali ke Checkout Varian yang sama dengan pilihan Saldo (Rp …)", async ({
  page,
}) => {
  const varianId = await varianUjiBayar();
  const email = await memberDenganSaldo(5000);
  await page.goto(`/checkout?varianId=${varianId}`);

  await ajakanSaldo(page).getByRole("link", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/masuk\?kembali=/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(page).toHaveURL(`/checkout?varianId=${varianId}`);
  await expect(
    pilihanMetode(page).getByRole("radio", { name: "Saldo (Rp 5.000)" }),
  ).toBeChecked();
  await expect(ajakanSaldo(page)).toHaveCount(0);
});

test("UAT-O10 langkah 3: Daftar di pilihan Saldo lalu Kode verifikasi yang benar membawa Member baru ke halaman Top up, walaupun Pendaftar sempat salah memasukkan kode dan menekan Kirim ulang kode", async ({
  page,
  request,
}) => {
  const varianId = await varianUjiBayar();
  const email = `pendaftar-${randomUUID()}@example.test`;
  await page.goto(`/checkout?varianId=${varianId}`);

  await ajakanSaldo(page).getByRole("link", { name: "Daftar" }).click();
  await expect(page).toHaveURL("/daftar?tujuan=%2Fakun%2Ftop-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page).toHaveURL("/daftar/verifikasi?tujuan=%2Fakun%2Ftop-up");

  await masukkanKode(page, kodeLainDari(await kodeTerakhir(request, email)));
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    PESAN_KODE_SALAH,
  );

  await mundurkanKode(email, 61);
  await page.getByRole("button", { name: "Kirim ulang kode" }).click();
  await expect(
    page.getByText(`Kode verifikasi baru sudah kami kirim ke ${email}.`),
  ).toBeVisible();

  await masukkanKode(page, await kodeTerakhir(request, email));
  await expect(page).toHaveURL("/akun/top-up");
  await expect(
    page.getByRole("heading", { level: 1, name: "Top up" }),
  ).toBeVisible();
});
