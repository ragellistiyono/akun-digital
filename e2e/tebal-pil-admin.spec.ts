import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

// Bahan test bersama. DATABASE_URL dan UPLOAD_DIR berasal dari .env.ci yang dimuat playwright.config.ts,
// jadi data ini masuk ke database app_test dan folder unggahan test.
import { sisipkanProduk } from "../src/server/uji-katalog";
import { FOLDER_UNGGAHAN_TEST, PNG } from "../src/server/uji-unggahan";

const PASSWORD = "sandi-uji-admin-123";

// Daftar Produk di dasbor admin memuat semua baris. app_test lokal bisa berisi ribuan Produk sisa run
// sebelumnya, jadi perpindahan ke halaman itu diberi waktu lebih longgar, sama seperti di
// kelola-produk.spec.ts.
const NAVIGASI = { timeout: 15_000 };

// Data persiapan bersama docs/UAT.md, yang bertanda [CONTOH], dengan akhiran unik per run supaya
// Produk dari test lain di app_test tidak mengganggu asersi.
const akhiran = randomUUID().slice(0, 8);
const NAMA = {
  netflix: `Netflix Premium ${akhiran}`,
  spotify: `Spotify Premium ${akhiran}`,
  gameLama: `Game Lama ${akhiran}`,
};
const fotoNetflix = `${randomUUID()}.png`;
let idNetflix = "";

test.beforeAll(async () => {
  await mkdir(FOLDER_UNGGAHAN_TEST, { recursive: true });
  await writeFile(path.join(FOLDER_UNGGAHAN_TEST, fotoNetflix), PNG);

  // Aktif dan Unggulan di daftar Produk, Varian aktif dan nonaktif, foto sampul, dan label Hemat.
  idNetflix = await sisipkanProduk({
    nama: NAMA.netflix,
    unggulan: true,
    foto: [fotoNetflix],
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, hargaNormal: 75000, Tersedia: 10 },
      { nama: "3 Bulan", hargaJual: 135000, aktif: false },
    ],
  });
  // Label Habis: satu-satunya Varian aktif tidak punya stok.
  await sisipkanProduk({
    nama: NAMA.spotify,
    varian: [{ nama: "1 Bulan", hargaJual: 25000 }],
  });
  // Nonaktif di daftar Produk.
  await sisipkanProduk({
    nama: NAMA.gameLama,
    aktif: false,
    varian: [{ nama: "1 Bulan", hargaJual: 15000, Tersedia: 2 }],
  });
});

// Koneksi database tidak ditutup di afterAll. Satu worker Playwright bisa menjalankan beberapa berkas spec
// yang memakai koneksi bersama ini, dan worker itu mengakhiri prosesnya sendiri setelah semua selesai.

// Membuat Admin persis seperti pemilik di server: `pnpm admin:buat <email>`, password lewat input.
// DATABASE_URL dari .env.ci (app_test) ikut diwariskan ke perintah itu.
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

/** Tebal dan ukuran huruf yang benar-benar dipakai browser untuk sebuah label. */
async function huruf(label: Locator) {
  await expect(label).toBeVisible();
  return label.evaluate((el) => {
    const gaya = getComputedStyle(el);
    return { tebal: gaya.fontWeight, ukuran: gaya.fontSize };
  });
}

// Token label-kecil (DESIGN.md frontmatter) dan Mikro (DESIGN.md Typography).
const LABEL_KECIL = { tebal: "700", ukuran: "13px" };
const MIKRO = { tebal: "800", ukuran: "12px" };

test("pil Aktif, Nonaktif, dan Unggulan di daftar Produk dan panel Varian bertebal 700 seperti pil Sampul (DESIGN.md Status Pesanan, keputusan #53)", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);

  await page.goto("/admin/produk", NAVIGASI);
  const baris = (nama: string) =>
    page
      .getByRole("row")
      .filter({ has: page.getByText(nama, { exact: true }) });
  const netflix = baris(NAMA.netflix);
  expect(await huruf(netflix.getByText("Aktif", { exact: true }))).toEqual(
    LABEL_KECIL,
  );
  expect(await huruf(netflix.getByText("Unggulan", { exact: true }))).toEqual(
    LABEL_KECIL,
  );
  expect(
    await huruf(baris(NAMA.gameLama).getByText("Nonaktif", { exact: true })),
  ).toEqual(LABEL_KECIL);

  await page.goto(`/admin/produk/${idNetflix}`);
  const varian = page
    .getByRole("region", { name: "Varian" })
    .getByRole("list", { name: "Varian" })
    .getByRole("listitem");
  const barisVarian = (nama: string) =>
    varian.filter({ has: page.getByText(nama, { exact: true }) });
  expect(
    await huruf(barisVarian("1 Bulan").getByText("Aktif", { exact: true })),
  ).toEqual(LABEL_KECIL);
  expect(
    await huruf(barisVarian("3 Bulan").getByText("Nonaktif", { exact: true })),
  ).toEqual(LABEL_KECIL);

  // Pil Sampul di panel Foto sudah bertebal 700 dan tidak berubah.
  expect(
    await huruf(
      page
        .getByRole("region", { name: "Foto" })
        .getByText("Sampul", { exact: true }),
    ),
  ).toEqual(LABEL_KECIL);
});

test("label Hemat dan Habis di Beranda tetap memakai Mikro (800, 12 px)", async ({
  page,
}) => {
  await page.goto("/");
  const kartu = (nama: string) =>
    page
      .getByRole("region", { name: "Semua Produk" })
      .getByRole("link")
      .filter({ hasText: nama });

  // UAT-C5: Netflix Premium 1 Bulan Rp 50.000 dengan Harga normal Rp 75.000 tampil "Hemat 33%".
  expect(
    await huruf(kartu(NAMA.netflix).getByText("Hemat 33%", { exact: true })),
  ).toEqual(MIKRO);
  expect(
    await huruf(kartu(NAMA.spotify).getByText("Habis", { exact: true })),
  ).toEqual(MIKRO);
});
