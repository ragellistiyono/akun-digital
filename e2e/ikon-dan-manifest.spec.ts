import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { sisipkanProduk } from "../src/server/uji-katalog";

// Ikon dan manifest aplikasi (T65, PRD §11.4 ▶ Keputusan 2026-11-18, UAT-K4). Nilai yang diharapkan
// diambil dari issue #194; warna `langit` #2A1F4D dari docs/DESIGN.md.
const LANGIT = "#2A1F4D";
const LANGIT_RGB = [0x2a, 0x1f, 0x4d];

type IkonManifest = {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
};

async function alamatManifest(page: Page) {
  await page.goto("/");
  const tautan = page.locator('link[rel="manifest"]');
  await expect(tautan).toHaveCount(1);
  return (await tautan.getAttribute("href"))!;
}

async function bacaManifest(page: Page) {
  const respons = await page.request.get(await alamatManifest(page));
  expect(respons.status()).toBe(200);
  return (await respons.json()) as Record<string, unknown> & {
    icons: IkonManifest[];
  };
}

/** Lebar dan tinggi PNG dibaca dari chunk IHDR, yang selalu berada tepat setelah tanda tangan PNG. */
async function ukuranPng(request: APIRequestContext, alamat: string) {
  const respons = await request.get(alamat);
  expect(respons.status(), alamat).toBe(200);
  expect(respons.headers()["content-type"], alamat).toBe("image/png");
  const isi = await respons.body();
  expect(isi.subarray(12, 16).toString("ascii"), alamat).toBe("IHDR");
  return `${isi.readUInt32BE(16)}x${isi.readUInt32BE(20)}`;
}

test("Beranda menautkan manifest berisi nama, alamat awal, tampilan, warna, dan bahasa toko", async ({
  page,
}) => {
  const manifest = await bacaManifest(page);

  expect(manifest).toMatchObject({
    name: "MIWE Digital Store",
    short_name: "MIWE Digital",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: LANGIT,
    theme_color: LANGIT,
    lang: "id",
  });
});

test("ikon manifest berukuran 192 dan 512 px, ikon maskable 512 px, dan apple-touch-icon 180 px", async ({
  page,
}) => {
  const manifest = await bacaManifest(page);

  const ikon = manifest.icons.map((i) => ({
    sizes: i.sizes,
    type: i.type,
    purpose: i.purpose ?? "any",
  }));
  expect(ikon).toEqual([
    { sizes: "192x192", type: "image/png", purpose: "any" },
    { sizes: "512x512", type: "image/png", purpose: "any" },
    { sizes: "512x512", type: "image/png", purpose: "maskable" },
  ]);
  for (const i of manifest.icons) {
    expect(await ukuranPng(page.request, i.src)).toBe(i.sizes);
  }

  const apple = page.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveCount(1);
  await expect(apple).toHaveAttribute("sizes", "180x180");
  expect(
    await ukuranPng(page.request, (await apple.getAttribute("href"))!),
  ).toBe("180x180");
});

test("ikon maskable berwarna langit di keempat sudutnya", async ({ page }) => {
  const manifest = await bacaManifest(page);
  const maskable = manifest.icons.find((i) => i.purpose === "maskable");
  expect(maskable).toBeDefined();

  const sudut = await page.evaluate(async (alamat) => {
    const gambar = new Image();
    gambar.src = alamat;
    await gambar.decode();
    const kanvas = document.createElement("canvas");
    kanvas.width = gambar.naturalWidth;
    kanvas.height = gambar.naturalHeight;
    const konteks = kanvas.getContext("2d")!;
    konteks.drawImage(gambar, 0, 0);
    const akhir = kanvas.width - 1;
    return [
      [0, 0],
      [akhir, 0],
      [0, akhir],
      [akhir, akhir],
    ].map(([x, y]) => Array.from(konteks.getImageData(x, y, 1, 1).data));
  }, maskable!.src);

  for (const piksel of sudut) {
    expect(piksel).toEqual([...LANGIT_RGB, 255]);
  }
});

test("Beranda, Halaman Produk, dan halaman login admin mewarnai bilah status dengan langit", async ({
  page,
}) => {
  const idProduk = await sisipkanProduk({
    nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 1 }],
  });

  for (const alamat of ["/", `/produk/${idProduk}`, "/admin"]) {
    await page.goto(alamat);
    const warna = page.locator('meta[name="theme-color"]');
    await expect(warna, alamat).toHaveCount(1);
    await expect(warna, alamat).toHaveAttribute("content", LANGIT);
  }
});

test("tidak ada service worker yang terdaftar setelah Beranda dibuka", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const jumlah = await page.evaluate(
    async () => (await navigator.serviceWorker.getRegistrations()).length,
  );
  expect(jumlah).toBe(0);
});
