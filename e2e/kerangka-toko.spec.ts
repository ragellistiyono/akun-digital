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

test("tab Riwayat untuk Tamu menjelaskan Tautan Pesanan tanpa tombol login", async ({
  page,
}) => {
  await page.goto("/riwayat");

  const isi = page.getByRole("main");
  await expect(
    isi.getByRole("heading", { level: 1, name: "Riwayat Pesanan" }),
  ).toBeVisible();
  await expect(isi).toContainText(
    'Setiap Pesanan Selesai punya Tautan Pesanan di email "Pesanan selesai".',
  );

  // PRD §11.1 ▶ Keputusan 2026-11-11: sebelum M2 tidak ada ajakan login.
  const ajakanLogin = /masuk|login|daftar/i;
  await expect(page.getByRole("button", { name: ajakanLogin })).toHaveCount(0);
  await expect(page.getByRole("link", { name: ajakanLogin })).toHaveCount(0);
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
    // Di ponsel navigasi bawah berada setelah isi halaman dalam urutan Tab. Beranda kini berisi kartu
    // Produk yang juga tautan, jadi test ini memakai tab Riwayat, yang isinya tanpa tautan sebelum M2
    // (PRD §11.1 ▶ Keputusan 2026-11-11). Tautan kerangkanya sama di semua halaman toko.
    await page.goto("/riwayat");

    for (const nama of ["MIWE Digital Store, beranda", ...TAB_TOKO]) {
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: nama, exact: true }),
      ).toBeFocused();

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
