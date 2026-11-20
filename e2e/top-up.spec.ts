import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test. Server e2e
// memakai Qrispy tiruan dari .env.ci (QRISPY_MODE=tiruan). Database dipakai bersama test lain yang berjalan bersamaan,
// jadi setiap test memakai Member dengan email unik.
import { db } from "../src/server/db";
import { topUp, user } from "../src/server/db/schema";
import { buatTopUp } from "../src/server/top-up";
import { sisipkanMember } from "../src/server/uji-member";

// Halaman Top up dan Halaman bayar Top up (T77, PRD §15.3, §15.4, UAT-O2, UAT-O3).

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

const PASSWORD_MEMBER = "sandi-uji-member-123";
const ALAMAT_TOP_UP = "/akun/top-up";

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

/** Login Member di halaman Masuk yang sedang terbuka. */
async function isiLogin(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();
}

const isi = (page: Page) => page.getByRole("main");
const formTopUp = (page: Page) =>
  isi(page).getByRole("form", { name: "Top up" });
const rincian = (page: Page) =>
  isi(page).getByRole("region", { name: "Rincian pembayaran" });

/** Top up itu langsung dari database. */
async function bacaTopUp(nomorTopUp: string) {
  const [baris] = await db
    .select({
      status: topUp.status,
      kodeUnik: topUp.kodeUnik,
      totalBayar: topUp.totalBayar,
    })
    .from(topUp)
    .where(eq(topUp.nomorTopUp, nomorTopUp));
  return baris;
}

const rupiah = (nilai: number) =>
  `Rp ${new Intl.NumberFormat("id-ID").format(nilai)}`;

// UAT-O2 langkah 2–3, PRD §15.3.
test("nominal di luar batas ditolak dengan pesan PRD, tombol cepat mengisi isian, lalu Top up Rp 10.000 membuka Halaman bayar Top up", async ({
  page,
}) => {
  const { email } = await memberBaru();
  // Tamu yang membuka Halaman Top up diarahkan ke Masuk, lalu kembali ke sini setelah login.
  await page.goto(ALAMAT_TOP_UP);
  await expect(page).toHaveURL(
    `/masuk?kembali=${encodeURIComponent(ALAMAT_TOP_UP)}`,
  );
  await isiLogin(page, email);
  await expect(page).toHaveURL(ALAMAT_TOP_UP);

  const form = formTopUp(page);
  const nominal = form.getByLabel("Nominal top up");
  const bayar = form.getByRole("button", { name: "Bayar dengan QRIS" });

  await nominal.fill("9999");
  await bayar.click();
  await expect(form).toContainText("Nominal top up minimal Rp 10.000.");
  await expect(nominal).toHaveAttribute("aria-invalid", "true");

  await nominal.fill("499001");
  await bayar.click();
  await expect(form).toContainText("Nominal top up maksimal Rp 499.000.");

  await nominal.fill("");
  await bayar.click();
  await expect(form).toContainText("Nominal top up belum diisi.");
  await expect(page).toHaveURL(ALAMAT_TOP_UP);

  await form.getByRole("button", { name: "Rp 50.000" }).click();
  await expect(nominal).toHaveValue("50000");
  await form.getByRole("button", { name: "Rp 200.000" }).click();
  await expect(nominal).toHaveValue("200000");

  await nominal.fill("10000");
  await bayar.click();
  await expect(page).toHaveURL(/\/akun\/top-up\/TOPUP-[A-Z2-9]{6}$/);
  const nomorTopUp = page.url().split("/").at(-1) ?? "";

  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();
  await expect(
    isi(page).getByRole("img", { name: `QRIS Top up ${nomorTopUp}` }),
  ).toBeVisible();
  await expect(
    isi(page).getByText("sisa waktu bayar", { exact: true }),
  ).toBeVisible();
  await expect(isi(page).getByRole("region", { name: "Top up" })).toContainText(
    nomorTopUp,
  );

  const dibuat = await bacaTopUp(nomorTopUp);
  expect(dibuat.status).toBe("Menunggu Pembayaran");
  await expect(
    rincian(page).getByRole("row", { name: /^Nominal top up/ }),
  ).toContainText("Rp 10.000");
  await expect(
    rincian(page).getByRole("row", { name: /^Kode unik/ }),
  ).toContainText(rupiah(dibuat.kodeUnik));
  await expect(
    rincian(page).getByRole("row", { name: /^Total bayar/ }),
  ).toContainText(rupiah(dibuat.totalBayar));
  await expect(
    isi(page).getByRole("link", { name: "Simpan gambar QR" }),
  ).toHaveAttribute("download", `QRIS-${nomorTopUp}.png`);
});

// UAT-O3 langkah 2–3, PRD §15.3.
test("Bayar dengan QRIS selagi Top up masih menunggu membuka Top up itu, lalu Batalkan membuatnya Dibatalkan dan membawa Member ke tab Akun", async ({
  page,
}) => {
  const { email } = await memberBaru();
  await page.goto("/masuk");
  await isiLogin(page, email);
  await expect(page).toHaveURL("/riwayat");

  await page.goto(ALAMAT_TOP_UP);
  await formTopUp(page).getByLabel("Nominal top up").fill("10000");
  await formTopUp(page)
    .getByRole("button", { name: "Bayar dengan QRIS" })
    .click();
  await expect(page).toHaveURL(/\/akun\/top-up\/TOPUP-[A-Z2-9]{6}$/);
  const pertama = page.url();

  await page.goto(ALAMAT_TOP_UP);
  await formTopUp(page).getByLabel("Nominal top up").fill("20000");
  await formTopUp(page)
    .getByRole("button", { name: "Bayar dengan QRIS" })
    .click();
  await expect(page).toHaveURL(pertama);
  await expect(
    rincian(page).getByRole("row", { name: /^Nominal top up/ }),
  ).toContainText("Rp 10.000");

  await isi(page).getByRole("button", { name: "Batalkan" }).click();
  await expect(page).toHaveURL("/akun");
  const nomorTopUp = pertama.split("/").at(-1) ?? "";
  expect((await bacaTopUp(nomorTopUp)).status).toBe("Dibatalkan");

  // Top up yang sudah Dibatalkan tidak tampil lagi bagi Member.
  await page.goto(pertama);
  await expect(page).toHaveURL("/akun");
});

test("Tamu dan Member lain tidak bisa membuka Halaman bayar Top up milik orang lain", async ({
  page,
}) => {
  const pemilik = await memberBaru();
  const hasil = await buatTopUp({ idMember: pemilik.id, nominal: "10000" });
  if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);
  const alamat = `${ALAMAT_TOP_UP}/${hasil.nomorTopUp}`;

  // Tamu diarahkan ke Masuk.
  await page.goto(alamat);
  await expect(page).toHaveURL(`/masuk?kembali=${encodeURIComponent(alamat)}`);

  // Member lain melihat halaman tidak ditemukan, tanpa QR dan rincian Top up itu.
  const lain = await memberBaru();
  await isiLogin(page, lain.email);
  await expect(page).toHaveURL(alamat);
  const respons = await page.goto(alamat);
  expect(respons?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Top up tidak ditemukan" }),
  ).toBeVisible();
  await expect(isi(page)).not.toContainText(hasil.nomorTopUp);
  await expect(isi(page).getByRole("img", { name: /QRIS/ })).toHaveCount(0);

  // Top up itu tetap Menunggu Pembayaran.
  expect((await bacaTopUp(hasil.nomorTopUp)).status).toBe(
    "Menunggu Pembayaran",
  );
});

// PRD §13 ▶ Keputusan 2026-11-20 (#226), urutan tayang M5 langkah 2: Halaman Top up belum ditautkan.
test("tidak ada tautan ke Halaman Top up dari halaman toko mana pun", async ({
  page,
}) => {
  const { email } = await memberBaru();
  await page.goto("/masuk");
  await isiLogin(page, email);
  await expect(page).toHaveURL("/riwayat");

  for (const alamat of [
    "/",
    "/kategori",
    "/riwayat",
    "/akun",
    "/akun/riwayat-saldo",
  ]) {
    await page.goto(alamat);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator(`a[href^="${ALAMAT_TOP_UP}"]`)).toHaveCount(0);
  }
});
