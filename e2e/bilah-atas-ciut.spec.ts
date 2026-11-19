import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../src/server/db";
import { user } from "../src/server/db/schema";
import { sisipkanMember } from "../src/server/uji-member";

// Bilah atas ciut saat digulir (T61, PRD §11.2, DESIGN.md Layout "Gerak responsif", Navigation
// "Bilah atas", Elevation "Bayang bilah", UAT-K2).
const BAYANG_BILAH = "rgb(45, 45, 45) 0px 4px 0px 0px";

const bilahAtas = (page: Page) => page.getByRole("banner");

// Tinggi layar dibuat pendek supaya Beranda pasti bisa digulir 100 px walau katalog sedang sedikit.
async function bukaBeranda(page: Page, lebar: number) {
  await page.setViewportSize({ width: lebar, height: 480 });
  await page.goto("/");
}

async function gulirKe(page: Page, y: number) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y);
}

async function harusCiut(page: Page) {
  await expect(bilahAtas(page)).toHaveCSS("height", "52px");
  await expect(bilahAtas(page)).toHaveCSS("box-shadow", BAYANG_BILAH);
}

async function harusUtuh(page: Page) {
  await expect(bilahAtas(page)).toHaveCSS("height", "64px");
  await expect(bilahAtas(page)).toHaveCSS("box-shadow", "none");
}

for (const lebar of [375, 1440]) {
  test(`di lebar ${lebar} px bilah atas ciut setelah Beranda digulir 100 px dan utuh lagi di paling atas`, async ({
    page,
  }) => {
    await bukaBeranda(page, lebar);
    await harusUtuh(page);

    await gulirKe(page, 100);
    await harusCiut(page);

    await gulirKe(page, 0);
    await harusUtuh(page);
  });
}

// Menunggu dua frame supaya pembaca posisi gulir sempat bereaksi sebelum memeriksa bilah yang tidak berubah.
async function tungguDuaFrame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((selesai) =>
        requestAnimationFrame(() => requestAnimationFrame(() => selesai())),
      ),
  );
}

test("bilah atas tetap utuh setelah Beranda digulir 20 px", async ({
  page,
}) => {
  await bukaBeranda(page, 375);

  await gulirKe(page, 20);
  await tungguDuaFrame(page);
  await harusUtuh(page);

  // Dari keadaan ciut pun, posisi 20 px mengembalikan bilah ke ukuran semula.
  await gulirKe(page, 100);
  await harusCiut(page);
  await gulirKe(page, 20);
  await harusUtuh(page);
});

test("monogram MDS 24 px saat bilah ciut dan 28 px saat tidak", async ({
  page,
}) => {
  await bukaBeranda(page, 375);
  const monogram = bilahAtas(page).getByRole("link", {
    name: "MIWE Digital Store, beranda",
  });
  await expect(monogram).toHaveCSS("font-size", "28px");

  await gulirKe(page, 100);
  await expect(monogram).toHaveCSS("font-size", "24px");

  await gulirKe(page, 0);
  await expect(monogram).toHaveCSS("font-size", "28px");
});

test.describe("dengan kurangi gerakan", () => {
  test.use({ reducedMotion: "reduce" });

  test("bilah atas tetap ciut setelah digulir 100 px tanpa transisi", async ({
    page,
  }) => {
    await bukaBeranda(page, 375);
    await gulirKe(page, 100);
    await harusCiut(page);

    const bilah = bilahAtas(page);
    await expect(bilah).toHaveCSS("transition-duration", "0s");
    // Tinggi bilah berubah di baris isinya, dan monogram ikut mengecil: keduanya juga tanpa transisi.
    await expect(bilah.locator("> div")).toHaveCSS("transition-duration", "0s");
    await expect(
      bilah.getByRole("link", { name: "MIWE Digital Store, beranda" }),
    ).toHaveCSS("transition-duration", "0s");
  });
});

// Member khusus berkas ini, supaya tidak berebut dengan Member di berkas test lain. Labelnya mengikuti
// tests/golden/label-member.json: bagian email sebelum "@", dipotong 12 karakter diikuti "…".
const EMAIL_MEMBER = "bilahciutmember@mail.com";
const PASSWORD_MEMBER = "sandi-uji-member-123";
const LABEL_MEMBER = "bilahciutmem…";

async function bisaDigulirKeSamping(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

test.describe("di lebar 360 px saat bilah ciut", () => {
  // beforeAll berjalan sekali per worker, jadi Member ini hanya disisipkan bila belum ada.
  test.beforeAll(async () => {
    const sudahAda = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, EMAIL_MEMBER));
    if (sudahAda.length === 0) {
      await sisipkanMember({ email: EMAIL_MEMBER, password: PASSWORD_MEMBER });
    }
  });

  test("Tamu tetap melihat tombol Masuk tanpa gulir ke samping", async ({
    page,
  }) => {
    await bukaBeranda(page, 360);
    await gulirKe(page, 100);
    await harusCiut(page);

    await expect(
      bilahAtas(page).getByRole("link", { name: "Masuk", exact: true }),
    ).toBeVisible();
    expect(await bisaDigulirKeSamping(page)).toBe(false);
  });

  test("Member tetap melihat labelnya tanpa gulir ke samping", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 480 });
    await page.goto("/masuk");
    await page.getByLabel("Email").fill(EMAIL_MEMBER);
    await page.getByLabel("Password").fill(PASSWORD_MEMBER);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL("/riwayat");

    await page.goto("/");
    await gulirKe(page, 100);
    await harusCiut(page);

    await expect(
      bilahAtas(page).getByRole("link", { name: `Akun ${LABEL_MEMBER}` }),
    ).toBeVisible();
    await expect(bilahAtas(page)).toContainText(LABEL_MEMBER);
    expect(await bisaDigulirKeSamping(page)).toBe(false);
  });
});
