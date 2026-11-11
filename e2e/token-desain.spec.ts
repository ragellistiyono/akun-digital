import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

// Nilai yang diharapkan dibaca langsung dari frontmatter docs/DESIGN.md (sumber nilai yang mengikat).
function bacaWarnaDesain() {
  const desain = readFileSync(
    path.resolve(__dirname, "../docs/DESIGN.md"),
    "utf8",
  );
  const blok = desain.match(
    /^colors:\n((?: {2}[\w-]+: "#[0-9A-Fa-f]{6}"\n)+)/m,
  );
  if (!blok) throw new Error("Blok colors di docs/DESIGN.md tidak terbaca.");
  return new Map(
    [...blok[1].matchAll(/^ {2}([\w-]+): "(#[0-9A-Fa-f]{6})"$/gm)].map(
      ([, nama, hex]) => [nama, hex],
    ),
  );
}

function keRgb(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

const WARNA = bacaWarnaDesain();
const TOKEN = [...WARNA.keys()].filter((nama) => !nama.endsWith("-gelap"));

function harapan(mode: "terang" | "gelap") {
  return Object.fromEntries(
    TOKEN.map((nama) => {
      const hex =
        mode === "gelap"
          ? (WARNA.get(`${nama}-gelap`) ?? WARNA.get(nama)!)
          : WARNA.get(nama)!;
      return [nama, keRgb(hex)];
    }),
  );
}

// Warna yang benar-benar dipakai browser untuk setiap token.
function warnaToken(page: Page) {
  return page.evaluate((daftar) => {
    const contoh = document.createElement("div");
    document.body.append(contoh);
    const hasil: Record<string, string> = {};
    for (const nama of daftar) {
      contoh.style.color = `var(--${nama})`;
      hasil[nama] = getComputedStyle(contoh).color;
    }
    contoh.remove();
    return hasil;
  }, TOKEN);
}

async function warnaLatar(page: Page) {
  const latar = (el: Element) => getComputedStyle(el).backgroundColor;
  return {
    halaman: await page.locator("body").evaluate(latar),
    bilahAtas: await page.getByRole("banner").evaluate(latar),
    navigasiBawah: await page
      .getByRole("navigation", { name: "Navigasi utama" })
      .evaluate(latar),
  };
}

test.use({ viewport: { width: 390, height: 800 } });

test("dengan skema warna terang, token memakai nilai DESIGN.md", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  const terang = harapan("terang");
  expect(await warnaToken(page)).toEqual(terang);
  expect(await warnaLatar(page)).toEqual({
    halaman: terang.tanah,
    bilahAtas: terang.langit,
    navigasiBawah: terang.permukaan,
  });
});

test("dengan skema warna gelap di perangkat, token berganti ke pasangan -gelap", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const gelap = harapan("gelap");
  expect(await warnaToken(page)).toEqual(gelap);
  expect(await warnaLatar(page)).toEqual({
    halaman: gelap.tanah,
    bilahAtas: gelap.langit,
    navigasiBawah: gelap.permukaan,
  });
});

test('data-mode="gelap" mengganti token ke pasangan -gelap walau perangkat terang', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.dataset.mode = "gelap";
  });

  expect(await warnaToken(page)).toEqual(harapan("gelap"));
});
