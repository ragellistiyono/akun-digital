import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dan ITEM_STOK_KEY berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk
// ke database app_test dan Item stok-nya dienkripsi dengan kunci uji.
import { db } from "../src/server/db";
import { itemStok, varian } from "../src/server/db/schema";
import { isiItemStokUji, sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

const PASSWORD = "sandi-uji-admin-123";

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

const FORMAT = ["Email", "Password", "Profil"];

// Contoh isi Item stok untuk format `Email`, `Password`, `Profil` seperti contoh baris PRD §4.2, dengan
// akhiran unik per test supaya mudah dikenali di daftar.
const isiUji = (nama: string, profil: string) => [
  `${nama}-${randomUUID().slice(0, 8)}@mail.com`,
  `rahasia-${nama}`,
  profil,
];

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

/**
 * Produk baru [CONTOH] dengan Format Item stok `Email`, `Password`, `Profil` (UAT-D2) dan satu Varian "1 Bulan",
 * berisi Item stok Tersedia dengan isi itu, serta satu Pesanan Selesai yang Item stok Terkirim-nya mencatat
 * nama kolom Format saat itu. Namanya bukan Netflix, supaya tidak mengubah hasil pencarian "netflix" di
 * cari-kategori-beranda.spec.ts yang berjalan bersamaan.
 */
async function produkBerformat({
  tersedia,
  terkirim,
}: {
  tersedia: string[][];
  terkirim: string[];
}) {
  const produkId = await sisipkanProduk({
    nama: `Ubah Format ${randomUUID().slice(0, 8)}`,
    formatItemStok: FORMAT,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  for (const nilai of tersedia) {
    await db.insert(itemStok).values({ varianId, ...isiItemStokUji(nilai) });
  }
  const selesai = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    itemStok: {
      status: "Terkirim",
      nilai: terkirim,
      formatSaatTerkirim: FORMAT,
    },
  });
  return {
    alamatProduk: `/admin/produk/${produkId}`,
    alamatVarian: `/admin/produk/${produkId}/varian/${varianId}`,
    selesai,
  };
}

const bagianFormat = (page: Page) =>
  page.getByRole("region", { name: "Format Item stok" });

/** Nama kolom Format Item stok yang tampil di bagian Format Item stok, menurut urutannya. */
const daftarFormat = (page: Page) =>
  bagianFormat(page)
    .getByRole("list", { name: "Format Item stok" })
    .getByRole("listitem");

const formFormat = (page: Page) =>
  bagianFormat(page).getByRole("form", { name: "Ubah Format Item stok" });

/** Item stok di daftar Item stok halaman Varian yang memuat teks itu, misalnya isi kolom Email-nya. */
const itemStokBerisi = (page: Page, teks: string) =>
  page
    .getByRole("region", { name: "Daftar Item stok" })
    .getByRole("list", { name: "Daftar Item stok" })
    .getByRole("listitem")
    .filter({ hasText: teks });

/** Teks setiap pasangan nama kolom dan isinya di sebuah Item stok, misalnya "Email budi@mail.com". */
const kolomItemStok = (baris: Locator) =>
  baris
    .locator("dl > div")
    .evaluateAll((kolom) =>
      kolom.map((k) => (k.textContent ?? "").replace(/\s+/g, " ").trim()),
    );

const teksKolom = (nama: string[], nilai: string[]) =>
  nama.map((satu, i) => `${satu}${nilai[i]}`);

const pesanTidakBoleh = (
  perbuatan: string,
  tersedia: number,
  ditahan: number,
) =>
  `Kolom tidak bisa ${perbuatan}, karena Produk ini masih punya Item stok Tersedia atau Ditahan: ${tersedia} Tersedia dan ${ditahan} Ditahan. Kolom bisa ditambah atau dihapus setelah semua Item stok Produk ini Terkirim, atau setelah Item stok Tersedia-nya dihapus di halaman Varian. Nama kolom tetap bisa diganti kapan saja.`;

// UAT-D2 dan PRD §4.1, §6.1, §9.5, §9.7.
test("UAT-D2: Admin mengganti nama kolom Profil menjadi Nama Profil, Item stok Tersedia tampil dengan nama baru, menambah kolom PIN ditolak selama ada Item stok Tersedia, dan Item stok Terkirim tetap tampil dengan nama kolom lama", async ({
  page,
  browser,
}) => {
  const tersedia = isiUji("alfa", "Profil 1");
  const terkirim = isiUji("beta", "Profil 2");
  const { alamatProduk, alamatVarian, selesai } = await produkBerformat({
    tersedia: [tersedia],
    terkirim,
  });
  await masukSebagaiAdmin(page);
  await page.goto(alamatProduk);
  await expect(daftarFormat(page)).toHaveText(FORMAT);

  // Langkah 1: ganti nama kolom Profil menjadi Nama Profil.
  await bagianFormat(page)
    .getByRole("button", { name: "Ubah Format Item stok" })
    .click();
  await expect(formFormat(page).getByLabel("Nama kolom 3")).toHaveValue(
    "Profil",
  );
  await formFormat(page).getByLabel("Nama kolom 3").fill("Nama Profil");
  await formFormat(page)
    .getByRole("button", { name: "Simpan Format Item stok" })
    .click();
  await expect(
    bagianFormat(page)
      .getByRole("status")
      .getByText("Format Item stok tersimpan."),
  ).toBeVisible();
  await expect(formFormat(page)).toHaveCount(0);
  await expect(daftarFormat(page)).toHaveText([
    "Email",
    "Password",
    "Nama Profil",
  ]);

  // Langkah 2: tambah kolom PIN ditolak selama masih ada Item stok Tersedia.
  await bagianFormat(page)
    .getByRole("button", { name: "Ubah Format Item stok" })
    .click();
  await expect(formFormat(page).getByLabel("Nama kolom 3")).toHaveValue(
    "Nama Profil",
  );
  await formFormat(page).getByRole("button", { name: "Tambah kolom" }).click();
  await formFormat(page).getByLabel("Nama kolom 4").fill("PIN");
  await formFormat(page)
    .getByRole("button", { name: "Simpan Format Item stok" })
    .click();
  await expect(
    formFormat(page).getByText(pesanTidakBoleh("ditambah", 1, 0)),
  ).toBeVisible();
  // Isian Admin tetap ada setelah ditolak.
  await expect(formFormat(page).getByLabel("Nama kolom 4")).toHaveValue("PIN");
  await formFormat(page).getByRole("button", { name: "Batal" }).click();
  await page.reload();
  await expect(daftarFormat(page)).toHaveText([
    "Email",
    "Password",
    "Nama Profil",
  ]);

  // Daftar Item stok di dasbor admin: Item stok Tersedia dengan nama kolom baru, Item stok Terkirim dengan nama
  // kolom yang dicatat saat Terkirim.
  await page.goto(alamatVarian);
  expect(await kolomItemStok(itemStokBerisi(page, tersedia[0]))).toEqual(
    teksKolom(["Email", "Password", "Nama Profil"], tersedia),
  );
  expect(await kolomItemStok(itemStokBerisi(page, terkirim[0]))).toEqual(
    teksKolom(FORMAT, terkirim),
  );

  // Detail Pesanan di dasbor admin tetap menampilkan nama kolom lama.
  await page.goto(`/admin/pesanan/${selesai.nomorPesanan}`);
  const itemStokDetail = page
    .getByRole("main")
    .getByRole("region", { name: "Item stok" });
  await expect(itemStokDetail.getByText(terkirim[2])).toBeVisible();
  await expect(
    itemStokDetail.getByText("Profil", { exact: true }),
  ).toBeVisible();
  await expect(itemStokDetail.getByText("Nama Profil")).toHaveCount(0);

  // Halaman Pesanan Selesai milik Pembeli, dibuka lewat Tautan Pesanan tanpa login, juga.
  const pembeli = await (await browser.newContext()).newPage();
  await pembeli.goto(`/pesanan/${selesai.tautan}`);
  const blokItemStok = pembeli
    .getByRole("main")
    .getByRole("region", { name: "Item stok Anda" });
  await expect(blokItemStok.getByText(terkirim[2])).toBeVisible();
  await expect(blokItemStok.getByText("Profil", { exact: true })).toBeVisible();
  await expect(blokItemStok.getByText("Nama Profil")).toHaveCount(0);
  await pembeli.context().close();
});

// PRD §4.1: kolom boleh ditambah bila Produk tidak punya Item stok Tersedia atau Ditahan.
test("menambah kolom PIN diterima bila semua Item stok Produk itu sudah Terkirim, dan Item stok berikutnya diisi dengan kolom PIN", async ({
  page,
}) => {
  const terkirim = isiUji("gamma", "Profil 3");
  const { alamatProduk, alamatVarian } = await produkBerformat({
    tersedia: [],
    terkirim,
  });
  await masukSebagaiAdmin(page);
  // Di layar ponsel 360 px, editor Format Item stok tidak membuat halaman bergulir ke samping (PRD §11.1).
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(alamatProduk);

  await bagianFormat(page)
    .getByRole("button", { name: "Ubah Format Item stok" })
    .click();
  await formFormat(page).getByRole("button", { name: "Tambah kolom" }).click();
  await expect(formFormat(page).getByLabel("Nama kolom 4")).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await formFormat(page).getByLabel("Nama kolom 4").fill("PIN");
  await formFormat(page)
    .getByRole("button", { name: "Simpan Format Item stok" })
    .click();
  await expect(
    bagianFormat(page).getByText("Format Item stok tersimpan."),
  ).toBeVisible();
  await expect(daftarFormat(page)).toHaveText([...FORMAT, "PIN"]);

  await page.goto(alamatVarian);
  // Form satu Item stok memakai Format baru, sedangkan Item stok Terkirim tetap dengan kolom lamanya.
  await expect(
    page
      .getByRole("region", { name: "Tambah satu Item stok" })
      .getByLabel("PIN"),
  ).toBeVisible();
  expect(await kolomItemStok(itemStokBerisi(page, terkirim[0]))).toEqual(
    teksKolom(FORMAT, terkirim),
  );
});
