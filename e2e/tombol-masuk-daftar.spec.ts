import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../src/server/db";
import { user } from "../src/server/db/schema";
import { sisipkanMember } from "../src/server/uji-member";

// Tombol Masuk dan Daftar untuk Pembeli (T51, PRD §11.1 ▶ Keputusan 2026-11-17, §13 ▶ Keputusan
// 2026-11-17, UAT-K1). Tombol WhatsApp di tab Akun untuk Tamu diuji di pengaturan-toko.spec.ts, karena
// hanya berkas itu yang mengubah nomor WhatsApp.
const PASSWORD_MEMBER = "sandi-uji-member-123";
// Contoh dari issue T51 dan tests/golden/label-member.json: label Member terpanjang, 12 karakter + "…".
const EMAIL_MEMBER_PANJANG = "budisantoso2026@mail.com";
const LABEL_MEMBER_PANJANG = "budisantoso2…";
const AJAKAN_LOGIN_RIWAYAT =
  "Masuk sebagai Member untuk melihat semua Pesanan Anda, termasuk yang dibuat sebelum mendaftar.";
const HALAMAN_TOKO = ["/", "/kategori", "/riwayat", "/akun"];

const bilahAtas = (page: Page) => page.getByRole("banner");
const isi = (page: Page) => page.getByRole("main");

async function masukMember(page: Page, email: string, password: string) {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");
}

async function bisaDigulirKeSamping(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

async function atas(page: Page, nama: string) {
  return (await isi(page).getByRole("link", { name: nama }).boundingBox())!;
}

// beforeAll berjalan sekali per worker, jadi Member dengan email tetap ini hanya disisipkan bila belum ada.
test.beforeAll(async () => {
  const sudahAda = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, EMAIL_MEMBER_PANJANG));
  if (sudahAda.length === 0) {
    await sisipkanMember({
      email: EMAIL_MEMBER_PANJANG,
      password: PASSWORD_MEMBER,
    });
  }
});

for (const lebar of [360, 1440]) {
  test(`di lebar ${lebar} px Tamu melihat tombol Masuk di bilah atas yang membuka halaman Masuk`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: lebar, height: 800 });
    await page.goto("/");

    const masuk = bilahAtas(page).getByRole("link", {
      name: "Masuk",
      exact: true,
    });
    await expect(masuk).toBeVisible();
    // Tombol kecil (DESIGN.md Buttons): 40 px bergaris pensil.
    await expect(masuk).toHaveCSS("height", "40px");
    await expect(masuk).toHaveCSS("border-top-style", "solid");

    await masuk.click();

    await expect(page).toHaveURL("/masuk");
    await expect(
      page.getByRole("heading", { level: 1, name: "Masuk" }),
    ).toBeVisible();
  });

  test(`di lebar ${lebar} px Member ${EMAIL_MEMBER_PANJANG} melihat "${LABEL_MEMBER_PANJANG}" di bilah atas yang membuka tab Akun`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: lebar, height: 800 });
    await masukMember(page, EMAIL_MEMBER_PANJANG, PASSWORD_MEMBER);

    const banner = bilahAtas(page);
    await expect(
      banner.getByRole("link", { name: "Masuk", exact: true }),
    ).toHaveCount(0);
    const label = banner.getByRole("link", { name: LABEL_MEMBER_PANJANG });
    await expect(label).toBeVisible();
    await expect(label).toHaveText(LABEL_MEMBER_PANJANG);

    await label.click();

    await expect(page).toHaveURL("/akun");
    await expect(isi(page).getByText(EMAIL_MEMBER_PANJANG)).toBeVisible();
  });
}

test("di lebar 360 px tidak ada gulir ke samping, juga dengan label Member terpanjang", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });

  for (const halaman of [...HALAMAN_TOKO, "/masuk", "/daftar"]) {
    await page.goto(halaman);
    expect(await bisaDigulirKeSamping(page), halaman).toBe(false);
  }

  await masukMember(page, EMAIL_MEMBER_PANJANG, PASSWORD_MEMBER);
  for (const halaman of HALAMAN_TOKO) {
    await page.goto(halaman);
    await expect(
      bilahAtas(page).getByRole("link", { name: LABEL_MEMBER_PANJANG }),
    ).toBeVisible();
    expect(await bisaDigulirKeSamping(page), halaman).toBe(false);
  }
});

test("setelah Member keluar, bilah atas kembali menampilkan tombol Masuk", async ({
  page,
}) => {
  await masukMember(page, EMAIL_MEMBER_PANJANG, PASSWORD_MEMBER);
  await page.goto("/akun");

  await isi(page).getByRole("button", { name: "Keluar" }).click();

  await expect(page).toHaveURL("/akun");
  await expect(
    bilahAtas(page).getByRole("link", { name: "Masuk", exact: true }),
  ).toBeVisible();
  await expect(
    bilahAtas(page).getByRole("link", { name: LABEL_MEMBER_PANJANG }),
  ).toHaveCount(0);
});

// UAT-K1: tab Akun untuk Tamu.
test('tab Akun untuk Tamu menampilkan tombol "Masuk" dan "Daftar" di atas tautan halaman hukum di footer', async ({
  page,
}) => {
  await page.goto("/akun");

  const masuk = isi(page).getByRole("link", { name: "Masuk", exact: true });
  const daftar = isi(page).getByRole("link", { name: "Daftar", exact: true });
  await expect(masuk).toHaveAttribute("href", "/masuk");
  await expect(daftar).toHaveAttribute("href", "/daftar");
  // Masuk tombol utama dan Daftar tombol kedua (DESIGN.md Buttons).
  await expect(masuk).toHaveCSS("height", "52px");
  await expect(daftar).toHaveCSS("height", "52px");
  await expect(daftar).toHaveCSS("border-top-style", "solid");

  const yMasuk = (await atas(page, "Masuk")).y;
  const yDaftar = (await atas(page, "Daftar")).y;
  // Tautan halaman hukum datang dari footer toko (PRD §11.1 ▶ Keputusan 2026-11-20).
  const yHukum = (await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Syarat & Ketentuan" })
    .boundingBox())!.y;
  expect(yMasuk).toBeLessThan(yDaftar);
  expect(yDaftar).toBeLessThan(yHukum);

  await daftar.click();
  await expect(page).toHaveURL("/daftar");
  await expect(
    page.getByRole("heading", { level: 1, name: "Daftar" }),
  ).toBeVisible();
});

// UAT-K1: tab Riwayat untuk Tamu.
test('tab Riwayat untuk Tamu menampilkan ajakan login dengan tombol "Masuk" dan "Daftar", lalu penjelasan Tautan Pesanan', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/riwayat");

  const judul = isi(page).getByRole("heading", {
    level: 1,
    name: "Riwayat Pesanan",
  });
  await expect(judul).toBeVisible();
  await expect(isi(page)).toContainText(AJAKAN_LOGIN_RIWAYAT);
  const masuk = isi(page).getByRole("link", { name: "Masuk", exact: true });
  const daftar = isi(page).getByRole("link", { name: "Daftar", exact: true });
  await expect(masuk).toHaveAttribute("href", "/masuk");
  await expect(daftar).toHaveAttribute("href", "/daftar");
  const penjelasan = isi(page).getByText(
    'Setiap Pesanan Selesai punya Tautan Pesanan di email "Pesanan selesai".',
  );
  await expect(penjelasan).toBeVisible();

  // Panel penjelasan berada di bawah tombol.
  const kotakDaftar = (await daftar.boundingBox())!;
  const kotakPenjelasan = (await penjelasan.boundingBox())!;
  expect(kotakPenjelasan.y).toBeGreaterThan(kotakDaftar.y + kotakDaftar.height);

  await masuk.click();
  await expect(page).toHaveURL("/masuk");
});

// DESIGN.md Layout "Tata letak halaman" ▶ Keputusan 2026-11-20: Riwayat untuk Tamu memakai pola Fokus, yaitu
// satu kolom 560 px di tengah layar berisi judul, tombol, lalu panel penjelasan di bawahnya.
test("di lebar 1440 px tab Riwayat untuk Tamu menaruh judul, tombol, dan panel penjelasan dalam satu kolom di tengah", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/riwayat");

  const judul = (await isi(page)
    .getByRole("heading", { level: 1, name: "Riwayat Pesanan" })
    .boundingBox())!;
  const daftar = (await isi(page)
    .getByRole("link", { name: "Daftar", exact: true })
    .boundingBox())!;
  const panel = (await isi(page)
    .getByRole("region", { name: "Tautan Pesanan" })
    .boundingBox())!;

  // Satu kolom: judul, tombol, dan panel berawal di tepi kiri yang sama, dan panel di bawah tombol.
  expect(daftar.x).toBeCloseTo(judul.x, 0);
  expect(panel.x).toBeCloseTo(judul.x, 0);
  expect(panel.width).toBeCloseTo(daftar.width, 0);
  expect(panel.width).toBeLessThanOrEqual(560);
  expect(panel.y).toBeGreaterThanOrEqual(daftar.y + daftar.height);
  // Kolomnya di tengah layar.
  expect(panel.x + panel.width / 2).toBeCloseTo(1440 / 2, 0);
});

test("halaman Masuk menaut ke Daftar dan Lupa password, dan halaman Daftar menaut ke Masuk", async ({
  page,
}) => {
  await page.goto("/masuk");
  await expect(
    isi(page).getByRole("link", { name: "Lupa password?" }),
  ).toHaveAttribute("href", "/lupa-password");
  await isi(page).getByRole("link", { name: "Daftar", exact: true }).click();

  await expect(page).toHaveURL("/daftar");
  await isi(page).getByRole("link", { name: "Masuk", exact: true }).click();

  await expect(page).toHaveURL("/masuk");
  await expect(
    page.getByRole("heading", { level: 1, name: "Masuk" }),
  ).toBeVisible();
});
