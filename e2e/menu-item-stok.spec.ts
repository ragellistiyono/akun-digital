import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test, yang
// dipakai bersama test lain yang berjalan bersamaan.
import { db } from "../src/server/db";
import { varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";

const PASSWORD = "sandi-uji-admin-123";

// Uji Bayar dan Netflix Premium 3 Bulan dari persiapan bersama docs/UAT.md, bertanda [CONTOH], dengan akhiran
// unik per run. Varian 3 Bulan nonaktif, jadi Produk Netflix Premium run ini tidak tampil di toko dan tidak
// mengubah hasil pencarian "netflix" di test lain.
const akhiran = randomUUID().slice(0, 8);
const PRODUK_UJI = `Uji Menu Item stok ${akhiran}`;
const PRODUK_NETFLIX = `Netflix Premium ${akhiran}`;
let produkUjiId = "";
let varianUjiBayarId = "";

test.beforeAll(async () => {
  produkUjiId = await sisipkanProduk({
    nama: PRODUK_UJI,
    formatItemStok: ["Kode"],
    varian: [{ nama: "Uji Bayar", hargaJual: 10000 }],
  });
  [{ id: varianUjiBayarId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkUjiId));
  await sisipkanProduk({
    nama: PRODUK_NETFLIX,
    formatItemStok: ["Email", "Password", "Profil"],
    varian: [{ nama: "3 Bulan", hargaJual: 135000, aktif: false }],
  });
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

// Daftar Varian memuat semua Varian di app_test, yang bisa berisi ribuan sisa run sebelumnya, jadi halaman
// menu Item stok diberi waktu muat lebih longgar.
const MUAT = { timeout: 15_000 };

/** Baris sebuah Varian di daftar Varian menu Item stok. */
const barisVarian = (page: Page, produk: string, namaVarian: string) =>
  page
    .getByRole("list", { name: "Daftar Varian" })
    .getByRole("listitem")
    .filter({ hasText: produk })
    .filter({ hasText: namaVarian });

const formatItemStok = (page: Page) =>
  page
    .getByRole("region", { name: "Varian terpilih" })
    .getByRole("list", { name: "Format Item stok" })
    .getByRole("listitem");

// UAT-N9 (PRD §4.2 ▶ Keputusan 2026-11-20).
const TEMPELAN_UAT_N9 = [
  "UJI-M4-001",
  "UJI-M4-002",
  "UJI-M4-003",
  "",
  "UJI-M4-001",
].join("\n");

test("UAT-N9: memilih Uji Bayar, menempel lima baris menampilkan 4 baris akan diproses, lalu 3 tersimpan, 1 ditolak, dan mengetuk Netflix Premium 3 Bulan memilih Varian itu", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await page.goto("/admin/item-stok", MUAT);

  // Langkah 1: pilih Produk, lalu Varian Uji Bayar.
  const pilihan = page.getByRole("form", { name: "Pilih Varian" });
  await pilihan.getByLabel("Produk").selectOption({ label: PRODUK_UJI });
  await pilihan.getByLabel("Varian").selectOption({ label: "Uji Bayar" });
  await pilihan.getByRole("button", { name: "Pilih" }).click();
  await expect(page).toHaveURL(
    `/admin/item-stok?varian=${varianUjiBayarId}`,
    MUAT,
  );

  const terpilih = page.getByRole("region", { name: "Varian terpilih" });
  await expect(terpilih).toContainText(PRODUK_UJI);
  await expect(formatItemStok(page)).toHaveText(["Kode"]);
  await expect(terpilih.getByRole("definition")).toHaveText([
    "Kode",
    "Kode",
    /^0\s*Jumlah Item stok yang Tersedia/,
  ]);
  const baris = barisVarian(page, PRODUK_UJI, "Uji Bayar");
  await expect(baris).toContainText("Tersedia 0");
  await expect(baris).toContainText("Aktif");

  // Langkah 2: tempel tanpa menyimpan.
  const tempel = page.getByRole("region", { name: "Tempel banyak Item stok" });
  await tempel.getByLabel("Tempelan Item stok").fill(TEMPELAN_UAT_N9);
  await expect(tempel.getByText("4 baris akan diproses")).toBeVisible();

  // Langkah 3: simpan.
  await tempel.getByRole("button", { name: "Simpan tempelan" }).click();
  await expect(tempel.getByRole("status")).toHaveText("3 tersimpan, 1 ditolak");
  const ditolak = tempel
    .getByRole("list", { name: "Baris yang ditolak" })
    .getByRole("listitem");
  await expect(ditolak).toHaveCount(1);
  await expect(ditolak).toContainText("Baris 5");
  await expect(ditolak).toContainText("Kembar dengan baris 1 di tempelan ini.");
  await expect(tempel.getByLabel("Tempelan Item stok")).toHaveValue("");
  await expect(tempel.getByText("0 baris akan diproses")).toBeVisible();
  await expect(baris).toContainText("Tersedia 3");

  // Langkah 4: ketuk baris Netflix Premium 3 Bulan, yang nonaktif.
  const barisNetflix = barisVarian(page, PRODUK_NETFLIX, "3 Bulan");
  await expect(barisNetflix).toContainText("Nonaktif");
  await barisNetflix.getByRole("link").click();
  await expect(page).toHaveURL(/\/admin\/item-stok\?varian=[0-9a-f-]{36}$/);
  await expect(terpilih).toContainText(PRODUK_NETFLIX);
  await expect(formatItemStok(page)).toHaveText([
    "Email",
    "Password",
    "Profil",
  ]);
  await expect(barisNetflix.getByRole("link")).toHaveAttribute(
    "aria-current",
    "true",
  );

  // Menu Item stok tetap bisa dipakai di ponsel 360 px tanpa gulir ke samping (PRD §11.1).
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("UAT-N9 langkah 5: kotak tempel di halaman Varian juga menampilkan hitungan baris", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/produk/${produkUjiId}/varian/${varianUjiBayarId}`);

  const tempel = page.getByRole("region", { name: "Tempel banyak Item stok" });
  await expect(tempel.getByText("0 baris akan diproses")).toBeVisible();
  await tempel.getByLabel("Tempelan Item stok").fill("UJI-M4-101");
  await expect(tempel.getByText("1 baris akan diproses")).toBeVisible();
  await tempel
    .getByLabel("Tempelan Item stok")
    .fill("UJI-M4-101\n   \nUJI-M4-102\n");
  await expect(tempel.getByText("2 baris akan diproses")).toBeVisible();
});

test("menu samping menampilkan Item stok tepat di bawah Produk dan membuka menu Item stok (PRD §11.1)", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  const menu = page.getByRole("navigation", { name: "Menu admin" });

  await expect(menu.getByRole("listitem")).toHaveText([
    "Ringkasan",
    "Laporan keuangan",
    /^Pesanan/,
    "Member",
    "Kategori",
    "Produk",
    "Item stok",
    "Voucher",
    "Pengaturan toko",
  ]);

  await menu.getByRole("link", { name: "Item stok" }).click();
  await expect(page).toHaveURL("/admin/item-stok", MUAT);
  await expect(
    page.getByRole("heading", { level: 1, name: "Item stok" }),
  ).toBeVisible();
  await expect(menu.getByRole("link", { name: "Item stok" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
