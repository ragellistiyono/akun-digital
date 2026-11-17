import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test, yang
// dipakai bersama test lain yang berjalan bersamaan.
import { db } from "../src/server/db";
import { varian } from "../src/server/db/schema";
import { jumlahPesananBermasalah } from "../src/server/daftar-pesanan";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

const PASSWORD = "sandi-uji-admin-123";

// Produk [CONTOH] dengan akhiran unik per run.
let varianId = "";

test.beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: `Ringkasan ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
});

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

// Membuat Admin persis seperti pemilik di server: `pnpm admin:buat <email>`, password lewat input.
function buatAdminLewatPerintah() {
  const email = `admin-${randomUUID()}@example.test`;
  const hasil = spawnSync("pnpm", ["--silent", "admin:buat", email], {
    input: `${PASSWORD}\n${PASSWORD}\n`,
    encoding: "utf8",
  });
  expect(hasil.status, hasil.stderr).toBe(0);
  return email;
}

async function masukSebagaiAdmin(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(buatAdminLewatPerintah());
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/admin/ringkasan");
}

const kartuBermasalah = (page: Page) =>
  page.getByRole("article", { name: "Pesanan Bermasalah" });

// UAT-I1 dan PRD §9.2 (▶ Keputusan 2026-11-17): kartu Pesanan Bermasalah menampilkan jumlah Pesanan
// Bermasalah saat ini dan membuka daftar Pesanan yang tersaring Bermasalah. Test lain yang berjalan bersamaan
// bisa mengubah jumlah itu di sela bacaan, jadi kartu hanya dibandingkan saat jumlah di database sama sebelum
// dan sesudah halaman dimuat, dan bagian itu diulang bila angkanya terganggu.
test("kartu Pesanan Bermasalah menampilkan jumlah Pesanan Bermasalah saat ini, dan mengetuknya membuka daftar Pesanan yang tersaring Bermasalah", async ({
  page,
}) => {
  const bermasalah = await sisipkanPesanan({
    varianId,
    status: "Bermasalah",
    dibuatPada: new Date(),
  });
  await masukSebagaiAdmin(page);

  await expect(async () => {
    const sebelum = await jumlahPesananBermasalah();
    await page.goto("/admin/ringkasan");
    const diKartu = await kartuBermasalah(page)
      .getByText(/^\d+$/)
      .textContent();
    const sesudah = await jumlahPesananBermasalah();

    expect(sesudah).toBe(sebelum);
    expect(Number(diKartu)).toBe(sebelum);
    expect(sebelum).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 30_000 });

  await kartuBermasalah(page).getByRole("link").click();

  await expect(page).toHaveURL("/admin/pesanan?status=Bermasalah");
  await expect(page.getByRole("main").getByLabel("Status")).toHaveValue(
    "Bermasalah",
  );
  await expect(
    page
      .getByRole("main")
      .getByRole("row", { name: new RegExp(bermasalah.nomorPesanan) }),
  ).toBeVisible();
});

// PRD §9.2 dan UAT-I1: Ringkasan menampilkan kartu Pendapatan dan Pesanan Selesai hari ini dan bulan ini,
// hanya berupa angka tanpa grafik.
test("Ringkasan menampilkan Pendapatan dan Pesanan Selesai hari ini dan bulan ini sebagai angka, tanpa grafik", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);

  for (const nama of ["Pendapatan", "Pesanan Selesai"]) {
    const kartu = page.getByRole("article", { name: nama, exact: true });
    await expect(kartu.getByRole("term")).toHaveText(["Hari ini", "Bulan ini"]);
  }
  await expect(
    page.getByRole("article", { name: "Pendapatan" }).getByRole("definition"),
  ).toHaveText([/^Rp \d[\d.]*$/, /^Rp \d[\d.]*$/]);
  await expect(
    page
      .getByRole("article", { name: "Pesanan Selesai", exact: true })
      .getByRole("definition"),
  ).toHaveText([/^\d+$/, /^\d+$/]);

  // Tidak ada grafik: tidak ada kanvas, gambar, atau SVG yang tidak disembunyikan dari pembaca layar.
  const isi = page.getByRole("main");
  await expect(isi.locator("canvas")).toHaveCount(0);
  await expect(isi.getByRole("img")).toHaveCount(0);
  await expect(isi.locator('svg:not([aria-hidden="true"])')).toHaveCount(0);
});
