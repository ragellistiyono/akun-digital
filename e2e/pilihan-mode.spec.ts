import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { sisipkanMember } from "../src/server/uji-member";

// Pilihan mode di tab Akun (T64, PRD §11.3 ▶ Keputusan 2026-11-18, UAT-K3). Letak bagian "Tampilan"
// terhadap tombol WhatsApp diuji di pengaturan-toko.spec.ts, karena hanya berkas itu yang mengubah nomor
// WhatsApp. Di sini letaknya diperiksa terhadap tautan halaman hukum di footer toko, yang selalu tampil
// setelah isi tab Akun (PRD §11.1 ▶ Keputusan 2026-11-20).
const KETERANGAN = "Pilihan ini hanya diingat di perangkat ini.";
// Warna latar halaman dari DESIGN.md: `kertas` #FDFBF7 dan `kertas-gelap` #1E1C19.
const TANAH = "rgb(253, 251, 247)";
const TANAH_GELAP = "rgb(30, 28, 25)";
const PASSWORD_MEMBER = "sandi-uji-member-123";

test.use({ viewport: { width: 390, height: 800 } });

const isi = (page: Page) => page.getByRole("main");
const modeTampilan = (page: Page) =>
  isi(page).getByRole("radiogroup", { name: "Mode tampilan" });
const pilihan = (page: Page, nama: string) =>
  modeTampilan(page).getByRole("radio", { name: nama, exact: true });
const latarHalaman = (page: Page) =>
  page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor);
const modeHtml = (page: Page) => page.locator("html").getAttribute("data-mode");

async function atas(page: Page, locator: ReturnType<Page["locator"]>) {
  await expect(locator).toBeVisible();
  return (await locator.boundingBox())!.y;
}

async function periksaBagianTampilan(page: Page) {
  const bagian = isi(page).getByRole("region", { name: "Tampilan" });
  await expect(
    bagian.getByRole("heading", { level: 2, name: "Tampilan" }),
  ).toBeVisible();
  const radio = modeTampilan(page).getByRole("radio");
  await expect(radio).toHaveCount(3);
  for (const [i, nama] of ["Perangkat", "Terang", "Gelap"].entries()) {
    await expect(radio.nth(i)).toHaveAccessibleName(nama);
  }
  await expect(bagian.getByText(KETERANGAN, { exact: true })).toBeVisible();
  // Footer toko dengan tautan halaman hukum selalu tampil setelah isi tab Akun, jadi bagian ini ada di atasnya.
  expect(await atas(page, modeTampilan(page))).toBeLessThan(
    await atas(
      page,
      page
        .getByRole("contentinfo")
        .getByRole("link", { name: "Syarat & Ketentuan" }),
    ),
  );
  return bagian;
}

test("Tamu melihat bagian Tampilan di tab Akun setelah tombol Masuk dan Daftar, dengan tiga pilihan dan keterangannya", async ({
  page,
}) => {
  await page.goto("/akun");

  await periksaBagianTampilan(page);
  expect(
    await atas(
      page,
      isi(page).getByRole("link", { name: "Daftar", exact: true }),
    ),
  ).toBeLessThan(await atas(page, modeTampilan(page)));
});

test("Member melihat bagian Tampilan di tab Akun setelah tombol Keluar, dengan tiga pilihan dan keterangannya", async ({
  page,
}) => {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");
  await page.goto("/akun");

  await periksaBagianTampilan(page);
  expect(
    await atas(page, isi(page).getByRole("button", { name: "Keluar" })),
  ).toBeLessThan(await atas(page, modeTampilan(page)));
});

test("browser baru tanpa data tersimpan memulai dengan pilihan Perangkat", async ({
  page,
}) => {
  await page.goto("/akun");

  await expect(pilihan(page, "Perangkat")).toBeChecked();
  await expect(pilihan(page, "Terang")).not.toBeChecked();
  await expect(pilihan(page, "Gelap")).not.toBeChecked();
});

test("UAT-K3 langkah 1: perangkat gelap dengan pilihan Perangkat tampil gelap tanpa data-mode", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/akun");

  await expect(pilihan(page, "Perangkat")).toBeChecked();
  expect(await modeHtml(page)).toBeNull();
  expect(await latarHalaman(page)).toBe(TANAH_GELAP);
});

test("UAT-K3 langkah 2: memilih Terang di perangkat gelap langsung tampil terang dan tetap terang setelah dimuat ulang, sebelum script aplikasi berjalan", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/akun");
  await expect(pilihan(page, "Perangkat")).toBeChecked();

  await pilihan(page, "Terang").check();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "terang");
  expect(await latarHalaman(page)).toBe(TANAH);

  // Script aplikasi diblokir saat halaman dimuat ulang: mode tetap terpasang lewat HTML yang diterima.
  await page.route("**/_next/static/**/*.js", (rute) => rute.abort());
  await page.reload();
  expect(await modeHtml(page)).toBe("terang");
  expect(await latarHalaman(page)).toBe(TANAH);

  await page.unroute("**/_next/static/**/*.js");
  await page.reload();
  await expect(pilihan(page, "Terang")).toBeChecked();
  expect(await modeHtml(page)).toBe("terang");
  expect(await latarHalaman(page)).toBe(TANAH);
});

test("memilih Perangkat setelah Terang menghapus data-mode, dan toko kembali mengikuti skema warna perangkat", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/akun");
  await pilihan(page, "Terang").check();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "terang");

  await pilihan(page, "Perangkat").check();
  await expect(page.locator("html")).not.toHaveAttribute("data-mode");
  expect(await latarHalaman(page)).toBe(TANAH_GELAP);

  await page.emulateMedia({ colorScheme: "light" });
  expect(await latarHalaman(page)).toBe(TANAH);

  // Pilihan Perangkat juga diingat: setelah dimuat ulang, data-mode tetap tidak ada.
  await page.reload();
  await expect(pilihan(page, "Perangkat")).toBeChecked();
  expect(await modeHtml(page)).toBeNull();
});

test("setelah memilih Gelap di tab Akun, halaman login /admin di browser yang sama tampil gelap", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/akun");
  await pilihan(page, "Gelap").check();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "gelap");
  expect(await latarHalaman(page)).toBe(TANAH_GELAP);

  await page.goto("/admin");
  await expect(page.getByLabel("Email")).toBeVisible();
  expect(await modeHtml(page)).toBe("gelap");
  expect(await latarHalaman(page)).toBe(TANAH_GELAP);
});

test("tombol panah kanan pada kontrol segmen memindahkan pilihan dari Perangkat ke Terang", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/akun");
  await pilihan(page, "Perangkat").focus();

  await page.keyboard.press("ArrowRight");

  await expect(pilihan(page, "Terang")).toBeChecked();
  await expect(pilihan(page, "Terang")).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "terang");
  expect(await latarHalaman(page)).toBe(TANAH);
});
