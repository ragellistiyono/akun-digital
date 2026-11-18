import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { sisipkanKategori, sisipkanProduk } from "../src/server/uji-katalog";

// Matahari penanda bergeser antar-tab (T62, PRD §11.2, DESIGN.md "Penanda tab aktif: matahari terbit"
// dan Layout "Gerak responsif", UAT-K2).

function navigasiUtama(page: Page) {
  return page.getByRole("navigation", { name: "Navigasi utama" });
}

// Elemen penanda yang bergeser. Bagian yang terlihat (setengah lingkaran matahari) ada di dalamnya.
function penanda(page: Page) {
  return navigasiUtama(page).locator("[data-penanda-tab]");
}

async function pusatX(locator: Locator) {
  const kotak = await locator.boundingBox();
  expect(kotak).not.toBeNull();
  return kotak!.x + kotak!.width / 2;
}

// Menandai elemen penanda di halaman, supaya bisa diperiksa apakah elemen yang sama masih dipakai.
async function tandaiPenanda(page: Page) {
  await penanda(page).evaluate((el) =>
    Object.assign(window, { penandaSebelumnya: el }),
  );
}

async function masihPenandaYangSama(page: Page) {
  return penanda(page).evaluate(
    (el) =>
      (window as unknown as { penandaSebelumnya?: Element })
        .penandaSebelumnya === el,
  );
}

test("di lebar 375 px matahari bergeser ke tengah tab Kategori dengan elemen yang sama", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(penanda(page)).toHaveCount(1);
  await tandaiPenanda(page);

  const tabKategori = navigasiUtama(page).getByRole("link", {
    name: "Kategori",
    exact: true,
  });
  await tabKategori.click();
  await expect(page).toHaveURL("/kategori");
  await expect(tabKategori).toHaveAttribute("aria-current", "page");

  const pusatTab = await pusatX(tabKategori);
  const matahari = penanda(page).locator("span");
  await expect
    .poll(async () => Math.abs((await pusatX(matahari)) - pusatTab))
    .toBeLessThanOrEqual(2);
  expect(await masihPenandaYangSama(page)).toBe(true);
});

for (const lebar of [375, 1440]) {
  test(`di lebar ${lebar} px penanda bertransisi 0,45 detik dengan easing standar`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: lebar, height: 900 });
    await page.goto("/riwayat");

    await expect(penanda(page)).toHaveCSS("transition-duration", "0.45s");
    await expect(penanda(page)).toHaveCSS(
      "transition-timing-function",
      "cubic-bezier(0.16, 1, 0.3, 1)",
    );
  });
}

test("di lebar 1440 px penanda bergeser ke bawah tautan Riwayat setelah diklik", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(penanda(page)).toHaveCount(1);
  await tandaiPenanda(page);

  const tautanRiwayat = navigasiUtama(page).getByRole("link", {
    name: "Riwayat",
    exact: true,
  });
  await tautanRiwayat.click();
  await expect(page).toHaveURL("/riwayat");
  await expect(tautanRiwayat).toHaveAttribute("aria-current", "page");

  const kotakTautan = (await tautanRiwayat.boundingBox())!;
  const pusatTautan = kotakTautan.x + kotakTautan.width / 2;
  await expect
    .poll(async () => Math.abs((await pusatX(penanda(page))) - pusatTautan))
    .toBeLessThanOrEqual(2);
  // Penanda duduk di bawah tautan, bukan menimpanya.
  const kotakPenanda = (await penanda(page).boundingBox())!;
  expect(kotakPenanda.y).toBeGreaterThanOrEqual(
    kotakTautan.y + kotakTautan.height,
  );
  expect(await masihPenandaYangSama(page)).toBe(true);
});

test.describe("dengan kurangi gerakan", () => {
  test.use({ reducedMotion: "reduce" });

  for (const lebar of [375, 1440]) {
    test(`di lebar ${lebar} px penanda melompat tanpa transisi`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: lebar, height: 900 });
      await page.goto("/");

      await expect(penanda(page)).toHaveCSS("transition-duration", "0s");
    });
  }
});

// Produk sintetis khusus berkas ini, dengan akhiran unik per run.
let idProduk = "";
test.beforeAll(async () => {
  const akhiran = randomUUID().slice(0, 8);
  const kategoriId = await sisipkanKategori({ nama: `Penanda ${akhiran}` });
  idProduk = await sisipkanProduk({
    nama: `Produk Penanda ${akhiran}`,
    kategoriId,
    varian: [{ nama: "1 Bulan", hargaJual: 25_000 }],
  });
});

for (const lebar of [375, 1440]) {
  test(`di lebar ${lebar} px Halaman Produk tidak menampilkan penanda, dan aria-current hanya ada di tab aktif`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: lebar, height: 900 });
    await page.goto(`/produk/${idProduk}`);

    await expect(penanda(page)).toHaveCount(0);
    await expect(
      navigasiUtama(page).locator('[aria-current="page"]'),
    ).toHaveCount(0);

    await navigasiUtama(page)
      .getByRole("link", { name: "Akun", exact: true })
      .click();
    await expect(page).toHaveURL("/akun");
    const tabAktif = navigasiUtama(page).locator('[aria-current="page"]');
    await expect(tabAktif).toHaveCount(1);
    await expect(tabAktif).toHaveText("Akun");
    await expect(penanda(page)).toHaveCount(1);
    await expect(penanda(page)).toHaveAttribute("aria-hidden", "true");
  });
}
