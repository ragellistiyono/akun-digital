import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

// Bahan test unggahan bersama. Modul ini hanya memakai modul bawaan Node dan membaca .env.ci, tanpa
// database, jadi aman diimpor dari test e2e. pngUnik membuat setiap foto bisa dikenali dari berkasnya.
import { FOLDER_UNGGAHAN_TEST, PNG, pngUnik } from "../src/server/uji-unggahan";

const PASSWORD = "sandi-uji-admin-123";

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

/** Kategori dan Produk dibuat lewat dasbor admin seperti biasa, dengan nama unik per run. */
async function buatProduk(page: Page, nama: string) {
  const kategori = `Streaming ${randomUUID().slice(0, 8)}`;
  await page.goto("/admin/kategori/baru");
  await page.getByLabel("Nama").fill(kategori);
  await page.getByLabel("Gambar ikon").setInputFiles({
    name: "ikon.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL("/admin/kategori");

  await page.goto("/admin/produk/baru");
  await expect(
    page.getByText(
      "Varian dan foto Produk ditambahkan setelah Produk disimpan, lewat tombol Ubah di daftar Produk.",
    ),
  ).toBeVisible();
  await page.getByLabel("Nama", { exact: true }).fill(nama);
  await page.getByLabel("Kategori").selectOption({ label: kategori });
  await page
    .getByLabel("Deskripsi")
    .fill("Akun Netflix Premium untuk satu profil.");
  await page
    .getByLabel("Ketentuan garansi")
    .fill("Garansi 30 hari sejak Item stok diterima.");
  await page.getByLabel("Nama kolom 1").fill("Email");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL("/admin/produk");
}

async function unggah(page: Page, nama: string, isi: Buffer) {
  await page.getByLabel("Tambah foto").setInputFiles({
    name: nama,
    mimeType: "image/png",
    buffer: isi,
  });
  await page.getByRole("button", { name: "Unggah foto" }).click();
}

/** Isi berkas sebuah foto di folder unggahan dari .env.ci, menurut alamat gambarnya. */
function isiBerkas(alamat: string) {
  return readFile(path.join(FOLDER_UNGGAHAN_TEST, path.basename(alamat)));
}

const tanpaGulirSamping = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

test("Admin mengunggah 5 foto Produk, foto keenam dan berkas yang bukan gambar ditolak, lalu memindah foto ke urutan pertama dan menghapus sampul", async ({
  page,
}) => {
  const nama = `Netflix Premium ${randomUUID().slice(0, 8)}`;
  await masukSebagaiAdmin(page);
  await buatProduk(page, nama);
  await page.getByRole("link", { name: `Ubah ${nama}` }).click();
  await expect(page).toHaveURL(/^.*\/admin\/produk\/[0-9a-f-]{36}$/);

  const bagianFoto = page.getByRole("region", { name: "Foto" });
  await expect(
    bagianFoto.getByRole("heading", { level: 2, name: "Foto" }),
  ).toBeVisible();
  await expect(bagianFoto.getByText("Belum ada foto.")).toBeVisible();
  const daftarFoto = bagianFoto.getByRole("list", { name: "Foto" });
  const barisFoto = daftarFoto.getByRole("listitem");
  const alamatFoto = () =>
    daftarFoto
      .locator("img")
      .evaluateAll((gambar) => gambar.map((g) => g.getAttribute("src")));
  const alamatSampul = () =>
    barisFoto.filter({ hasText: "Sampul" }).locator("img").getAttribute("src");

  // Berkas yang bukan gambar, walaupun bernama .png, ditolak dengan pesan.
  await unggah(page, "daftar-harga.png", Buffer.from("%PDF-1.7 daftar harga"));
  await expect(
    bagianFoto.getByText(
      "Berkas ini bukan gambar PNG, JPEG, atau WebP. Pilih foto dengan salah satu jenis itu.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Tambah foto")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(bagianFoto.getByText("Belum ada foto.")).toBeVisible();

  // Lima foto diunggah satu per satu; foto pertama menjadi sampul.
  const isi = Array.from({ length: 5 }, () => pngUnik());
  for (const [indeks, satu] of isi.entries()) {
    await unggah(page, `foto-${indeks + 1}.png`, satu);
    await expect(barisFoto).toHaveCount(indeks + 1);
  }
  await expect(bagianFoto.getByText(/5 dari 5 foto\./)).toBeVisible();
  const [a1, a2, a3, a4, a5] = (await alamatFoto()).map(String);
  for (const [indeks, alamat] of [a1, a2, a3, a4, a5].entries()) {
    expect(await isiBerkas(alamat)).toEqual(isi[indeks]);
  }
  await expect(barisFoto.first()).toContainText("Foto 1");
  expect(await alamatSampul()).toBe(a1);
  // Foto disajikan lewat rute toko dari folder unggahan .env.ci.
  const sampul = barisFoto.first().locator("img");
  await sampul.scrollIntoViewIfNeeded();
  await expect(sampul).toHaveJSProperty("naturalWidth", 1);

  // Foto keenam ditolak dengan pesan (PRD §3.3).
  await unggah(page, "foto-6.png", pngUnik());
  await expect(
    bagianFoto.getByText(
      "Produk ini sudah punya 5 foto, jumlah paling banyak untuk satu Produk. Hapus salah satu foto dulu, lalu unggah foto baru.",
    ),
  ).toBeVisible();
  await expect(barisFoto).toHaveCount(5);
  expect(await alamatFoto()).toEqual([a1, a2, a3, a4, a5]);

  // Foto 3 dinaikkan dua kali ke urutan pertama, lalu menjadi sampul.
  await expect(
    page.getByRole("button", { name: "Naikkan foto 1" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Turunkan foto 5" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Naikkan foto 3" }).click();
  await expect.poll(alamatFoto).toEqual([a1, a3, a2, a4, a5]);
  // Pesan batas 5 foto hilang setelah urutan foto berubah.
  await expect(
    bagianFoto.getByText(/Produk ini sudah punya 5 foto/),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Naikkan foto 2" }).click();
  await expect.poll(alamatFoto).toEqual([a3, a1, a2, a4, a5]);
  await expect.poll(alamatSampul).toBe(a3);
  await expect(barisFoto.filter({ hasText: "Sampul" })).toHaveCount(1);

  // Bagian Foto tetap bisa dipakai di ponsel 360 px tanpa gulir ke samping (PRD §11.1).
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await tanpaGulirSamping(page)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });

  // Sampul dihapus: foto berikutnya menjadi sampul, dan berkasnya hilang dari folder unggahan.
  await page.getByRole("button", { name: "Hapus foto 1" }).click();
  await expect.poll(alamatFoto).toEqual([a1, a2, a4, a5]);
  await expect.poll(alamatSampul).toBe(a1);
  await expect(bagianFoto.getByText(/4 dari 5 foto\./)).toBeVisible();
  await expect(
    access(path.join(FOLDER_UNGGAHAN_TEST, path.basename(a3))),
  ).rejects.toThrow("ENOENT");

  // Urutan foto tetap sama setelah halaman dibuka ulang.
  await page.reload();
  expect(await alamatFoto()).toEqual([a1, a2, a4, a5]);
});
