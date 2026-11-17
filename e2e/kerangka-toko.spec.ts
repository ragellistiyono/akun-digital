import { expect, test, type Page } from "@playwright/test";

const TAB_TOKO = ["Beranda", "Kategori", "Riwayat", "Akun"];
const HALAMAN_TOKO = ["/", "/kategori", "/riwayat", "/akun"];

function navigasiUtama(page: Page) {
  return page.getByRole("navigation", { name: "Navigasi utama" });
}

async function bisaDigulirKeSamping(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

for (const lebar of [360, 390]) {
  test(`di lebar ${lebar} px navigasi bawah tampil dengan empat tab tanpa gulir ke samping`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: lebar, height: 800 });

    for (const halaman of HALAMAN_TOKO) {
      await page.goto(halaman);

      const navigasi = navigasiUtama(page);
      await expect(navigasi).toHaveCount(1);
      await expect(navigasi.getByRole("link")).toHaveText(TAB_TOKO);

      // Navigasi bawah menempel di dasar layar, bukan di dalam bilah atas.
      await expect(
        page.getByRole("banner").getByRole("navigation"),
      ).toHaveCount(0);
      const kotak = await navigasi.boundingBox();
      expect(kotak).not.toBeNull();
      expect(kotak!.y + kotak!.height).toBeCloseTo(800, 0);

      expect(await bisaDigulirKeSamping(page)).toBe(false);
    }
  });
}

test("di lebar 1440 px navbar atas tampil dengan empat tautan tanpa navigasi bawah", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const halaman of HALAMAN_TOKO) {
    await page.goto(halaman);

    // Hanya satu navigasi utama yang tampil, dan letaknya di bilah atas.
    await expect(navigasiUtama(page)).toHaveCount(1);
    const navbarAtas = page
      .getByRole("banner")
      .getByRole("navigation", { name: "Navigasi utama" });
    await expect(navbarAtas.getByRole("link")).toHaveText(TAB_TOKO);
  }
});

for (const lebar of [390, 1440]) {
  test(`di lebar ${lebar} px hanya tab yang sedang dibuka yang punya aria-current="page"`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: lebar, height: 900 });

    for (const [i, halaman] of HALAMAN_TOKO.entries()) {
      await page.goto(halaman);

      const tautan = navigasiUtama(page).getByRole("link");
      for (const [j, label] of TAB_TOKO.entries()) {
        const tab = tautan.filter({ hasText: label });
        if (i === j) await expect(tab).toHaveAttribute("aria-current", "page");
        else await expect(tab).not.toHaveAttribute("aria-current");
      }
    }
  });
}

// DESIGN.md, Cincin fokus: outline 3px solid monogram (#8F61FF), outline-offset 2px.
for (const lebar of [390, 1440]) {
  test(`di lebar ${lebar} px setiap tautan kerangka memakai cincin fokus monogram saat difokus dengan keyboard`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: lebar, height: 900 });
    // Tab Riwayat dipakai karena isinya sama di semua lebar. Tautan kerangkanya sama di semua halaman toko.
    // Urutan Tab berbeda per lebar: di ponsel, tombol Masuk bilah atas dan tautan isi halaman berada
    // sebelum navigasi bawah, jadi Tab ditekan sampai tautan yang dituju mendapat fokus.
    const tautanKerangka = [
      page.getByRole("link", {
        name: "MIWE Digital Store, beranda",
        exact: true,
      }),
      page
        .getByRole("banner")
        .getByRole("link", { name: "Masuk", exact: true }),
      ...TAB_TOKO.map((nama) =>
        navigasiUtama(page).getByRole("link", { name: nama, exact: true }),
      ),
    ];
    for (const tautan of tautanKerangka) {
      await page.goto("/riwayat");
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press("Tab");
        if (await tautan.evaluate((el) => el === document.activeElement)) break;
      }
      await expect(tautan).toBeFocused();

      const cincin = await page.evaluate(() => {
        const gaya = getComputedStyle(document.activeElement!);
        return {
          style: gaya.outlineStyle,
          width: gaya.outlineWidth,
          color: gaya.outlineColor,
          offset: gaya.outlineOffset,
        };
      });
      expect(cincin).toEqual({
        style: "solid",
        width: "3px",
        color: "rgb(143, 97, 255)",
        offset: "2px",
      });
    }
  });
}
