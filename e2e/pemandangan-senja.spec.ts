import { expect, test, type Page } from "@playwright/test";

const HALAMAN_DALAM = ["/kategori", "/riwayat", "/akun"];

// Galat hidrasi React: pesan lengkap di build pengembangan, nomor galat 418–425 di build produksi.
const GALAT_HIDRASI = /hydrat|(errors\/|error #)4(18|19|2[1-5])\b/i;

function pemandangan(page: Page, jenis: "pita" | "tepi") {
  return page.locator(`[data-pemandangan="${jenis}"]`);
}

// DESIGN.md Layout: pita langit 236 px di ponsel dan 320 px mulai 900 px; strip tepi 44 px dan 56 px.
const UKURAN = [
  { lebar: 390, pita: 236, tepi: 44 },
  { lebar: 1440, pita: 320, tepi: 56 },
];

for (const ukuran of UKURAN) {
  test(`di lebar ${ukuran.lebar} px Beranda menampilkan pita langit dengan pemandangan setinggi ${ukuran.pita} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ukuran.lebar, height: 900 });
    await page.goto("/");

    const pita = pemandangan(page, "pita");
    // Pemandangan dilukis di klien setelah wadahnya diukur.
    await expect(pita.locator("svg")).toBeVisible();
    expect((await pita.boundingBox())?.height).toBe(ukuran.pita);
    // Tiga lapis punggung gunung coretan.
    await expect(pita.locator("svg [data-lapis]")).toHaveCount(3);
    await expect(pemandangan(page, "tepi")).toHaveCount(0);
  });

  test(`di lebar ${ukuran.lebar} px tab Kategori, Riwayat, dan Akun menampilkan strip tepi setinggi ${ukuran.tepi} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ukuran.lebar, height: 900 });

    for (const halaman of HALAMAN_DALAM) {
      await page.goto(halaman);

      const tepi = pemandangan(page, "tepi");
      await expect(tepi.locator("svg")).toBeVisible();
      expect((await tepi.boundingBox())?.height).toBe(ukuran.tepi);
      // Dua lapis punggung gunung, tanpa matahari, bulan, bintang, awan, dan burung.
      await expect(tepi.locator("svg [data-lapis]")).toHaveCount(2);
      await expect(
        tepi.locator(
          "[data-matahari], [data-bulan], [data-bintang], [data-awan], [data-burung]",
        ),
      ).toHaveCount(0);
      await expect(pemandangan(page, "pita")).toHaveCount(0);
    }
  });
}

for (const skema of ["light", "dark"] as const) {
  test(`dengan skema warna ${skema}, konsol browser tidak menampilkan galat hidrasi`, async ({
    page,
  }) => {
    const galat: string[] = [];
    page.on("pageerror", (error) => galat.push(error.message));
    page.on("console", (pesan) => {
      if (pesan.type() === "error" && GALAT_HIDRASI.test(pesan.text())) {
        galat.push(pesan.text());
      }
    });
    await page.emulateMedia({ colorScheme: skema });

    for (const halaman of ["/", ...HALAMAN_DALAM]) {
      await page.goto(halaman);
      await expect(page.locator("[data-pemandangan] svg")).toBeVisible();
    }

    expect(galat).toEqual([]);
  });
}

test("pemandangan dilukis ulang saat ukuran wadah berubah", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");

  const svg = pemandangan(page, "pita").locator("svg");
  await expect(svg).toHaveAttribute("viewBox", "0 0 390 236");

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(svg).toHaveAttribute("viewBox", "0 0 1440 320");
});

test("pemandangan dilukis ulang saat mode berubah", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  // Mode terang: matahari coretan, tanpa bulan dan bintang.
  const pita = pemandangan(page, "pita");
  const harapkanSiang = async () => {
    await expect(pita.locator("[data-matahari]")).toHaveCount(1);
    await expect(pita.locator("[data-bulan]")).toHaveCount(0);
    await expect(pita.locator("[data-bintang]")).toHaveCount(0);
  };
  // Mode gelap (buku sketsa malam): bulan sabit dan 10 bintang coretan (DESIGN.md), baik lewat pilihan
  // mode maupun skema perangkat.
  const harapkanMalam = async () => {
    await expect(pita.locator("[data-bulan]")).toHaveCount(1);
    await expect(pita.locator("[data-matahari]")).toHaveCount(0);
    await expect(pita.locator("[data-bintang]")).toHaveCount(10);
  };
  await harapkanSiang();

  await page.evaluate(() => {
    document.documentElement.dataset.mode = "gelap";
  });
  await harapkanMalam();

  await page.evaluate(() => {
    delete document.documentElement.dataset.mode;
  });
  await harapkanSiang();

  await page.emulateMedia({ colorScheme: "dark" });
  await harapkanMalam();
});

test("pemandangan tidak memakai foto atau berkas gambar", async ({ page }) => {
  const gambar: string[] = [];
  page.on("request", (permintaan) => {
    // Foto sampul Produk di kartu Beranda adalah gambar unggahan Admin (/unggahan/…), bukan bagian
    // pemandangan, jadi tidak dihitung.
    const unggahan = new URL(permintaan.url()).pathname.startsWith(
      "/unggahan/",
    );
    if (permintaan.resourceType() === "image" && !unggahan) {
      gambar.push(permintaan.url());
    }
  });

  for (const halaman of ["/", "/kategori"]) {
    await page.goto(halaman);

    const wadah = page.locator("[data-pemandangan]");
    await expect(wadah.locator("svg")).toBeVisible();
    await expect(wadah.locator("img, image, picture")).toHaveCount(0);
  }

  expect(gambar).toEqual([]);
});
