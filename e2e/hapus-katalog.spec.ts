import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// Bahan test bersama. DATABASE_URL, UPLOAD_DIR, dan ITEM_STOK_KEY berasal dari .env.ci yang dimuat
// playwright.config.ts, jadi data ini masuk ke database app_test dan folder unggahan test.
import { db } from "../src/server/db";
import { kategori, produk, varian } from "../src/server/db/schema";
import { sisipkanKategori, sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";
import { FOLDER_UNGGAHAN_TEST, PNG } from "../src/server/uji-unggahan";

const PASSWORD = "sandi-uji-admin-123";

// Daftar Produk dan daftar Kategori di dasbor admin memuat semua baris. app_test lokal bisa berisi ribuan
// Produk dan Kategori sisa run sebelumnya, jadi perpindahan ke halaman itu diberi waktu lebih longgar,
// sama seperti di kelola-produk.spec.ts.
const NAVIGASI = { timeout: 15_000 };

// Data persiapan bersama docs/UAT.md, yang bertanda [CONTOH], dengan akhiran unik per run. Kategori dan
// Produk test lain tidak pernah dihapus test ini, dan namanya tidak sama persis dengan "Netflix Premium" atau
// "Streaming" yang dibersihkan kelola-produk.spec.ts dan kelola-kategori.spec.ts. Pencarian "netflix" di
// cari-kategori-beranda.spec.ts hanya membandingkan Produk run-nya sendiri.
const akhiran = randomUUID().slice(0, 8);
const NAMA = {
  game: `Game ${akhiran}`,
  gameLama: `Game Lama ${akhiran}`,
  kosong: `Film ${akhiran}`,
  streaming: `Streaming ${akhiran}`,
  netflix: `Netflix Premium ${akhiran}`,
  youtube: `YouTube Premium ${akhiran}`,
};
// Setiap Kategori memakai berkas ikonnya sendiri, supaya ikon yang ikut terhapus tidak dipakai Kategori lain.
const IKON = {
  game: `${randomUUID()}.png`,
  kosong: `${randomUUID()}.png`,
  streaming: `${randomUUID()}.png`,
};
const id = { game: "", kosong: "", netflix: "", youtube: "" };
let pesananNetflix = { tautan: "", nomorPesanan: "" };

/** id Varian Produk itu yang bernama `nama`. */
async function idVarian(produkId: string, nama: string) {
  const semua = await db
    .select({ id: varian.id, nama: varian.nama })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return semua.find((v) => v.nama === nama)?.id ?? "";
}

test.beforeAll(async () => {
  await mkdir(FOLDER_UNGGAHAN_TEST, { recursive: true });
  for (const nama of Object.values(IKON)) {
    await writeFile(path.join(FOLDER_UNGGAHAN_TEST, nama), PNG);
  }

  // Kategori Game hanya berisi Produk nonaktif.
  id.game = await sisipkanKategori({ nama: NAMA.game, ikon: IKON.game });
  await sisipkanProduk({
    nama: NAMA.gameLama,
    kategoriId: id.game,
    aktif: false,
    varian: [{ nama: "1 Bulan", hargaJual: 15000, Tersedia: 2 }],
  });
  id.kosong = await sisipkanKategori({ nama: NAMA.kosong, ikon: IKON.kosong });

  const streaming = await sisipkanKategori({
    nama: NAMA.streaming,
    ikon: IKON.streaming,
  });
  id.netflix = await sisipkanProduk({
    nama: NAMA.netflix,
    kategoriId: streaming,
    formatItemStok: ["Email", "Password", "Profil"],
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, hargaNormal: 75000, Tersedia: 10 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
    ],
  });
  // Pesanan lama Netflix Premium: satu Selesai dengan Item stok-nya, dan satu Dibatalkan.
  pesananNetflix = await sisipkanPesanan({
    varianId: await idVarian(id.netflix, "1 Bulan"),
    status: "Selesai",
    itemStok: {
      status: "Terkirim",
      nilai: ["miwe.akun07@contoh.id", "Senja-7419", "Profil 3"],
      formatSaatTerkirim: ["Email", "Password", "Profil"],
    },
  });
  await sisipkanPesanan({
    varianId: await idVarian(id.netflix, "3 Bulan"),
    status: "Dibatalkan",
  });

  // YouTube Premium: Varian 1 Bulan belum pernah dipesan, dan Varian 3 Bulan pernah dipesan lalu Kedaluwarsa.
  id.youtube = await sisipkanProduk({
    nama: NAMA.youtube,
    kategoriId: streaming,
    aktif: false,
    varian: [
      { nama: "1 Bulan", hargaJual: 20000 },
      { nama: "3 Bulan", hargaJual: 55000, Tersedia: 3 },
    ],
  });
  await sisipkanPesanan({
    varianId: await idVarian(id.youtube, "3 Bulan"),
    status: "Kedaluwarsa",
  });
});

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

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

const panelHapus = (page: Page, judul: string) =>
  page.getByRole("region", { name: judul });

/** Memilih tombol hapus di panel itu, lalu menegaskannya. */
async function hapusLewatPanel(page: Page, judul: string, nama: string) {
  const panel = panelHapus(page, judul);
  await panel.getByRole("button", { name: judul }).click();
  await expect(panel).toContainText(`Hapus ${nama}?`);
  await panel.getByRole("button", { name: `Ya, hapus ${nama}` }).click();
}

const adaBerkas = (nama: string) =>
  access(path.join(FOLDER_UNGGAHAN_TEST, nama)).then(
    () => true,
    () => false,
  );

const kategoriAda = async (idKategori: string) =>
  (
    await db
      .select({ id: kategori.id })
      .from(kategori)
      .where(eq(kategori.id, idKategori))
  ).length === 1;

const produkAda = async (idProduk: string) =>
  (
    await db
      .select({ id: produk.id })
      .from(produk)
      .where(eq(produk.id, idProduk))
  ).length === 1;

test("UAT-C6 langkah 1: menghapus Kategori Game yang berisi Produk nonaktif ditolak dengan pesan untuk memindahkan Produknya, dan Kategori tetap ada", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/kategori/${id.game}`);

  await hapusLewatPanel(page, "Hapus Kategori", `Kategori ${NAMA.game}`);

  await expect(
    panelHapus(page, "Hapus Kategori").getByRole("alert"),
  ).toHaveText(
    "Kategori ini tidak bisa dihapus, karena masih berisi 1 Produk. Produk nonaktif juga dihitung. Pindahkan Produknya ke Kategori lain dulu di halaman Ubah Produk, lalu hapus Kategori ini lagi.",
  );
  await page.reload();
  await expect(page.getByLabel("Nama")).toHaveValue(NAMA.game);
  expect(await kategoriAda(id.game)).toBe(true);
  expect(await adaBerkas(IKON.game)).toBe(true);
});

test("menghapus Kategori yang kosong berhasil: dasbor kembali ke daftar Kategori tanpa Kategori itu, dan ikonnya ikut terhapus", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/kategori/${id.kosong}`);

  // Batal menutup penegasan tanpa menghapus.
  const panel = panelHapus(page, "Hapus Kategori");
  await panel.getByRole("button", { name: "Hapus Kategori" }).click();
  await panel.getByRole("button", { name: "Batal" }).click();
  await expect(panel.getByRole("button", { name: /^Ya, hapus/ })).toHaveCount(
    0,
  );
  expect(await kategoriAda(id.kosong)).toBe(true);

  await hapusLewatPanel(page, "Hapus Kategori", `Kategori ${NAMA.kosong}`);

  await expect(page).toHaveURL("/admin/kategori", NAVIGASI);
  await expect(
    page.getByRole("cell", { name: NAMA.kosong, exact: true }),
  ).toHaveCount(0);
  expect(await kategoriAda(id.kosong)).toBe(false);
  expect(await adaBerkas(IKON.kosong)).toBe(false);
});

test("UAT-C6 langkah 2 dan 3: Netflix Premium yang dinonaktifkan hilang dari katalog, Halaman Pesanan lamanya tetap utuh, dan menghapusnya ditolak karena sudah pernah dipesan", async ({
  page,
  browser,
}) => {
  test.slow();
  const tamu = await (await browser.newContext()).newPage();
  const cariNetflix = `/?q=${encodeURIComponent(NAMA.netflix)}`;
  const hasilCari = tamu.getByRole("region", {
    name: "Hasil pencarian",
    exact: true,
  });
  // Sebelum dinonaktifkan, Netflix Premium tampil di katalog.
  await tamu.goto(cariNetflix);
  await expect(
    hasilCari.getByRole("link").filter({ hasText: NAMA.netflix }),
  ).toHaveCount(1);

  // Langkah 2: Admin menonaktifkan Netflix Premium.
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/produk/${id.netflix}`);
  await page.getByLabel("Aktif", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page).toHaveURL("/admin/produk", NAVIGASI);

  await tamu.goto(cariNetflix);
  await expect(hasilCari).toContainText(`Produk "${NAMA.netflix}" belum ada`);
  await expect(
    hasilCari.getByRole("link").filter({ hasText: NAMA.netflix }),
  ).toHaveCount(0);
  await tamu.goto(`/produk/${id.netflix}`);
  await expect(
    tamu.getByRole("heading", { level: 1, name: "Produk tidak ditemukan" }),
  ).toBeVisible();

  // Halaman Pesanan lamanya tetap utuh: Nomor Pesanan, status, Produk dan Varian, Item stok, dan rincian.
  await tamu.goto(`/pesanan/${pesananNetflix.tautan}`);
  const isi = tamu.getByRole("main");
  await expect(
    isi.getByText(pesananNetflix.nomorPesanan, { exact: true }),
  ).toBeVisible();
  await expect(isi.getByText("Selesai", { exact: true })).toBeVisible();
  await expect(isi).toContainText(NAMA.netflix);
  await expect(isi).toContainText("1 Bulan");
  const blokItemStok = isi.getByRole("region", { name: "Item stok Anda" });
  for (const nilai of ["miwe.akun07@contoh.id", "Senja-7419", "Profil 3"]) {
    await expect(blokItemStok.getByText(nilai, { exact: true })).toBeVisible();
  }
  await expect(
    isi
      .getByRole("region", { name: "Rincian pembayaran" })
      .getByRole("row", { name: "Total bayar" }),
  ).toContainText("Rp 45.123");

  // Langkah 3: Admin mencoba menghapus Netflix Premium.
  await page.goto(`/admin/produk/${id.netflix}`);
  await hapusLewatPanel(page, "Hapus Produk", `Produk ${NAMA.netflix}`);

  await expect(panelHapus(page, "Hapus Produk").getByRole("alert")).toHaveText(
    "Produk ini tidak bisa dihapus, karena sudah tercatat di 2 Pesanan. Pesanan berstatus apa pun dihitung, termasuk Kedaluwarsa dan Dibatalkan. Nonaktifkan Produk ini saja: hapus centang Aktif di form Produk, lalu simpan. Produk nonaktif hilang dari katalog dan tidak bisa dibeli, sedangkan Pesanan lamanya tetap tampil utuh.",
  );
  await page.reload();
  await expect(page.getByLabel("Nama", { exact: true })).toHaveValue(
    NAMA.netflix,
  );
  expect(await produkAda(id.netflix)).toBe(true);
});

test("menghapus Varian yang pernah dipesan ditolak dengan pesan untuk menonaktifkannya, sedangkan Varian yang belum pernah dipesan hilang dari daftar Varian", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/produk/${id.youtube}`);
  const barisVarian = (nama: string) =>
    page
      .getByRole("list", { name: "Varian", exact: true })
      .getByRole("listitem")
      .filter({ hasText: nama });

  const tigaBulan = barisVarian("3 Bulan");
  await tigaBulan.getByRole("button", { name: "Hapus Varian 3 Bulan" }).click();
  await expect(tigaBulan).toContainText(
    "Hapus Varian 3 Bulan? Item stok Varian ini ikut terhapus dan tidak bisa dikembalikan.",
  );
  await tigaBulan
    .getByRole("button", { name: "Ya, hapus Varian 3 Bulan" })
    .click();
  await expect(tigaBulan.getByRole("alert")).toHaveText(
    "Varian ini tidak bisa dihapus, karena sudah tercatat di 1 Pesanan. Pesanan berstatus apa pun dihitung, termasuk Kedaluwarsa dan Dibatalkan. Nonaktifkan Varian ini saja: pilih Ubah, hapus centang Aktif, lalu simpan. Varian nonaktif hilang dari katalog dan tidak bisa dibeli, sedangkan Pesanan lamanya tetap tampil utuh.",
  );

  const satuBulan = barisVarian("1 Bulan");
  await satuBulan.getByRole("button", { name: "Hapus Varian 1 Bulan" }).click();
  await satuBulan
    .getByRole("button", { name: "Ya, hapus Varian 1 Bulan" })
    .click();

  await expect(barisVarian("1 Bulan")).toHaveCount(0);
  await expect(barisVarian("3 Bulan")).toHaveCount(1);
  expect(await idVarian(id.youtube, "1 Bulan")).toBe("");
  expect(await idVarian(id.youtube, "3 Bulan")).not.toBe("");
});
