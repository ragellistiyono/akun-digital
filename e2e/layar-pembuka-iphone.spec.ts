import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";

// Layar pembuka iPhone (T66, PRD §11.4 ▶ Keputusan 2026-11-18, UAT-K4). Nilai yang diharapkan diambil
// dari issue #195. Warna dan bilah status mengikuti PRD §11.4 ▶ Keputusan 2026-11-20: latar `kertas`
// #FDFBF7 dari docs/DESIGN.md, dan bilah status iPhone memakai gaya bawaan.
const KERTAS_RGB = [0xfd, 0xfb, 0xf7];

async function meta(page: Page, nama: string) {
  const tag = page.locator(`meta[name="${nama}"]`);
  await expect(tag, nama).toHaveCount(1);
  return tag.getAttribute("content");
}

test("Beranda membuka toko tanpa bilah alamat dengan judul MIWE Digital dan bilah status bawaan di iPhone", async ({
  page,
}) => {
  await page.goto("/");

  expect(await meta(page, "apple-mobile-web-app-capable")).toBe("yes");
  expect(await meta(page, "apple-mobile-web-app-title")).toBe("MIWE Digital");
  // Bilah status bawaan: latar terang dengan teks gelap, tidak tembus di atas bilah atas toko.
  expect(await meta(page, "apple-mobile-web-app-status-bar-style")).toBe(
    "default",
  );
});

type LayarPembuka = {
  alamat: string;
  lebar: number;
  tinggi: number;
  rasio: number;
};

function angkaMedia(media: string, fitur: string) {
  const cocok = media.match(new RegExp(`\\(${fitur}: (\\d+)(?:px)?\\)`));
  expect(cocok, `${fitur} di "${media}"`).not.toBeNull();
  return Number(cocok![1]);
}

async function daftarLayarPembuka(page: Page): Promise<LayarPembuka[]> {
  await page.goto("/");
  const tautan = await page
    .locator('link[rel="apple-touch-startup-image"]')
    .evaluateAll((daftar) =>
      daftar.map((t) => ({
        alamat: t.getAttribute("href")!,
        media: t.getAttribute("media")!,
      })),
    );
  return tautan.map(({ alamat, media }) => {
    // Hanya posisi tegak (iPad dan posisi mendatar di luar scope T66).
    expect(media, alamat).toContain("(orientation: portrait)");
    return {
      alamat,
      lebar: angkaMedia(media, "device-width"),
      tinggi: angkaMedia(media, "device-height"),
      rasio: angkaMedia(media, "-webkit-device-pixel-ratio"),
    };
  });
}

/** Lebar dan tinggi PNG dibaca dari chunk IHDR, yang selalu berada tepat setelah tanda tangan PNG. */
async function ukuranPng(request: APIRequestContext, alamat: string) {
  const respons = await request.get(alamat);
  expect(respons.status(), alamat).toBe(200);
  expect(respons.headers()["content-type"], alamat).toBe("image/png");
  const isi = await respons.body();
  expect(isi.subarray(12, 16).toString("ascii"), alamat).toBe("IHDR");
  return { lebar: isi.readUInt32BE(16), tinggi: isi.readUInt32BE(20) };
}

test("layar pembuka mencakup iPhone tegak dari iPhone SE generasi 2 sampai iPhone 16 Pro Max", async ({
  page,
}) => {
  const ukuranLayar = (await daftarLayarPembuka(page)).map(
    ({ lebar, tinggi, rasio }) => `${lebar}x${tinggi}@${rasio}`,
  );

  // Ukuran layar dalam titik CSS dan rasio pikselnya, menurut spesifikasi Apple.
  expect(ukuranLayar).toEqual(
    expect.arrayContaining([
      "375x667@2", // iPhone SE generasi 2 dan 3
      "375x812@3", // iPhone 12 mini, 13 mini
      "414x896@2", // iPhone 11
      "390x844@3", // iPhone 12, 13, 14, 16e
      "428x926@3", // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
      "393x852@3", // iPhone 14 Pro, 15, 15 Pro, 16
      "430x932@3", // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
      "402x874@3", // iPhone 16 Pro
      "440x956@3", // iPhone 16 Pro Max
    ]),
  );
  expect(new Set(ukuranLayar).size).toBe(ukuranLayar.length);
});

test("setiap layar pembuka adalah PNG seukuran piksel layar iPhone di atribut media-nya", async ({
  page,
}) => {
  const daftar = await daftarLayarPembuka(page);
  expect(daftar.length).toBeGreaterThan(0);

  for (const { alamat, lebar, tinggi, rasio } of daftar) {
    expect(await ukuranPng(page.request, alamat), alamat).toEqual({
      lebar: lebar * rasio,
      tinggi: tinggi * rasio,
    });
  }
});

test("setiap layar pembuka berwarna kertas di keempat sudutnya", async ({
  page,
}) => {
  const daftar = await daftarLayarPembuka(page);
  expect(daftar.length).toBeGreaterThan(0);

  for (const { alamat } of daftar) {
    const sudut = await page.evaluate(async (alamat) => {
      const gambar = new Image();
      gambar.src = alamat;
      await gambar.decode();
      const kanvas = document.createElement("canvas");
      kanvas.width = gambar.naturalWidth;
      kanvas.height = gambar.naturalHeight;
      const konteks = kanvas.getContext("2d")!;
      konteks.drawImage(gambar, 0, 0);
      const [x, y] = [kanvas.width - 1, kanvas.height - 1];
      return [
        [0, 0],
        [x, 0],
        [0, y],
        [x, y],
      ].map(([a, b]) => Array.from(konteks.getImageData(a, b, 1, 1).data));
    }, alamat);

    for (const piksel of sudut) {
      expect(piksel, alamat).toEqual([...KERTAS_RGB, 255]);
    }
  }
});

// Tinggi jam dan poni iPhone 16 Pro dalam titik CSS. Dengan bilah status bawaan, iPhone meletakkan halaman di
// bawah bilah status, jadi env(safe-area-inset-top) di iPhone bernilai 0. Untuk memastikan bilah atas tidak
// lagi mewarnai zona di belakang jam dengan warna sendiri, ruang atas itu tetap ditiru lewat Chrome DevTools
// Protocol, karena Chromium tidak punya poni.
const LEBAR_IPHONE = 402;
const PONI_PX = 62;

async function pasangPoni(page: Page) {
  const sesi = await page.context().newCDPSession(page);
  await sesi.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: PONI_PX },
  });
}

async function ruangAtas(bilah: Locator) {
  await expect(bilah).toBeVisible();
  return bilah.evaluate((el) => ({
    ruang: getComputedStyle(el).paddingTop,
    tinggi: el.getBoundingClientRect().height,
  }));
}

// Posisi atas isi pertama toko, yang berada setelah bilah atas dan pengganjalnya.
function atasIsiToko(page: Page) {
  return page
    .getByRole("banner")
    .evaluate(
      (bilah) =>
        bilah.nextElementSibling!.nextElementSibling!.getBoundingClientRect()
          .top,
    );
}

const PASSWORD_ADMIN = "sandi-uji-admin-123";

// Membuat Admin persis seperti pemilik di server: `pnpm admin:buat <email>`, password lewat input.
// DATABASE_URL dari .env.ci (app_test) ikut diwariskan ke perintah itu.
function buatAdminLewatPerintah() {
  const email = `admin-${randomUUID()}@example.test`;
  const hasil = spawnSync("pnpm", ["--silent", "admin:buat", email], {
    input: `${PASSWORD_ADMIN}\n${PASSWORD_ADMIN}\n`,
    encoding: "utf8",
  });
  expect(hasil.status, hasil.stderr).toBe(0);
  return email;
}

async function masukSebagaiAdmin(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(buatAdminLewatPerintah());
  await page.getByLabel("Password").fill(PASSWORD_ADMIN);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/admin/ringkasan");
}

// Bilah atas dasbor admin di ponsel: wadah menu lipat, yang tingginya sama dengan barisnya selama menu
// tertutup. Menu yang tertutup tersembunyi, jadi dicari dengan includeHidden.
const bilahAdmin = (page: Page) =>
  page
    .getByRole("navigation", { name: "Menu admin", includeHidden: true })
    .locator("..");

/**
 * Warna piksel di tengah zona poni, 2 px dari tepi kiri dan kanan layar. Isi bilah atas berjarak 16 px dari
 * tepi, jadi kedua piksel itu hanya memperlihatkan latar bilah atau zona di belakang jam.
 */
async function warnaZonaPoni(page: Page) {
  const tangkapan = await page.screenshot({
    clip: { x: 0, y: 0, width: LEBAR_IPHONE, height: PONI_PX },
  });
  return page.evaluate(async (data) => {
    const gambar = new Image();
    gambar.src = `data:image/png;base64,${data}`;
    await gambar.decode();
    const kanvas = document.createElement("canvas");
    kanvas.width = gambar.naturalWidth;
    kanvas.height = gambar.naturalHeight;
    const konteks = kanvas.getContext("2d")!;
    konteks.drawImage(gambar, 0, 0);
    const y = Math.floor(kanvas.height / 2);
    return [2, kanvas.width - 3].map((x) =>
      Array.from(konteks.getImageData(x, y, 1, 1).data),
    );
  }, tangkapan.toString("base64"));
}

test.describe("di lebar iPhone", () => {
  test.use({ viewport: { width: LEBAR_IPHONE, height: 874 } });

  test("tanpa poni, bilah atas toko dan dasbor admin tetap setinggi 64 px tanpa ruang atas", async ({
    page,
  }) => {
    await page.goto("/");
    expect(await ruangAtas(page.getByRole("banner"))).toEqual({
      ruang: "0px",
      tinggi: 64,
    });
    // Isi halaman mulai tepat di bawah bilah atas.
    expect(await atasIsiToko(page)).toBe(64);

    await page.goto("/admin");
    expect(await ruangAtas(page.getByRole("banner"))).toEqual({
      ruang: "0px",
      tinggi: 64,
    });

    await masukSebagaiAdmin(page);
    expect(await ruangAtas(bilahAdmin(page))).toEqual({
      ruang: "0px",
      tinggi: 64,
    });
  });

  test("dengan poni tiruan, bilah atas toko dan dasbor admin tidak mewarnai zona di belakang jam: zona itu tetap kertas", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await pasangPoni(page);

    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();
    expect(await warnaZonaPoni(page)).toEqual([
      [...KERTAS_RGB, 255],
      [...KERTAS_RGB, 255],
    ]);

    await page.goto("/admin");
    await expect(page.getByRole("banner")).toBeVisible();
    expect(await warnaZonaPoni(page)).toEqual([
      [...KERTAS_RGB, 255],
      [...KERTAS_RGB, 255],
    ]);

    await masukSebagaiAdmin(page);
    await expect(bilahAdmin(page)).toBeVisible();
    expect(await warnaZonaPoni(page)).toEqual([
      [...KERTAS_RGB, 255],
      [...KERTAS_RGB, 255],
    ]);
  });
});
