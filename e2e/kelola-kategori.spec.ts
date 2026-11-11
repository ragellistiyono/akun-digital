import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const PASSWORD = "sandi-uji-admin-123";

// Gambar PNG 1×1 piksel yang sah.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

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

const barisKategori = (page: Page, nama: string) =>
  page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: nama, exact: true }) });

// Kategori "Streaming" sisa run yang gagal di tengah jalan dibuang dulu, supaya baris "Streaming" di
// daftar hanya milik test ini. Run yang berhasil tidak meninggalkannya karena namanya diganti.
test.beforeAll(async () => {
  const sql = postgres(process.env.DATABASE_URL ?? "", {
    max: 1,
    onnotice: () => {},
  });
  try {
    await sql`delete from kategori where nama = 'Streaming'`;
  } finally {
    await sql.end();
  }
});

test('Admin membuat Kategori "Streaming" dengan ikon, lalu mengganti namanya', async ({
  page,
}) => {
  const namaBaru = `Streaming dan Film ${randomUUID().slice(0, 8)}`;
  await masukSebagaiAdmin(page);

  await page
    .getByRole("navigation", { name: "Menu admin" })
    .getByRole("link", { name: "Kategori" })
    .click();
  await expect(page).toHaveURL("/admin/kategori");
  await expect(
    page.getByRole("heading", { level: 1, name: "Kategori" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Tambah Kategori" }).click();
  await expect(page).toHaveURL("/admin/kategori/baru");
  await page.getByLabel("Nama").fill("Streaming");
  await page.getByLabel("Gambar ikon").setInputFiles({
    name: "streaming.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(page).toHaveURL("/admin/kategori");
  const streaming = barisKategori(page, "Streaming");
  await expect(streaming).toHaveCount(1);
  // Ikon tampil di daftar, disajikan lewat rute toko dari folder unggahan .env.ci.
  const ikon = streaming.locator("img");
  // Gambar di daftar dimuat saat mendekati layar, jadi barisnya digulir ke layar dulu.
  await ikon.scrollIntoViewIfNeeded();
  await expect(ikon).toHaveJSProperty("naturalWidth", 1);
  const alamatIkon = (await ikon.getAttribute("src")) ?? "";
  expect(
    await readFile(
      path.join(
        path.resolve(process.env.UPLOAD_DIR ?? ""),
        path.basename(alamatIkon),
      ),
    ),
  ).toEqual(PNG);
  const tersaji = await page.request.get(alamatIkon);
  expect(tersaji.headers()["content-type"]).toBe("image/png");

  await streaming.getByRole("link", { name: "Ubah Streaming" }).click();
  await expect(page).toHaveURL(/^.*\/admin\/kategori\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Ubah Kategori" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nama")).toHaveValue("Streaming");
  await page.getByLabel("Nama").fill(namaBaru);
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(page).toHaveURL("/admin/kategori");
  await expect(barisKategori(page, "Streaming")).toHaveCount(0);
  // Nama berganti, ikonnya tetap yang tadi.
  await expect(barisKategori(page, namaBaru).locator("img")).toHaveAttribute(
    "src",
    alamatIkon,
  );

  // Daftar Kategori tetap bisa dipakai di ponsel 360 px tanpa gulir ke samping (PRD §11.1).
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("Kategori tanpa nama dan ikon, atau dengan berkas yang bukan gambar, ditolak dengan pesan", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await page.goto("/admin/kategori/baru");

  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByLabel("Nama")).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText(
      "Nama Kategori belum diisi. Ketik nama Kategori, misalnya Streaming.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Gambar ikon")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.getByText(
      "Gambar ikon belum dipilih. Pilih berkas gambar PNG, JPEG, atau WebP untuk ikon Kategori.",
    ),
  ).toBeVisible();

  const nama = `Musik ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Nama").fill(nama);
  await page.getByLabel("Gambar ikon").setInputFiles({
    name: "catatan.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bukan gambar"),
  });
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(
    page.getByText(
      "Berkas ini bukan gambar PNG, JPEG, atau WebP. Pilih berkas gambar dengan salah satu jenis itu.",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL("/admin/kategori/baru");
  // Nama yang sudah diketik tetap terisi.
  await expect(page.getByLabel("Nama")).toHaveValue(nama);

  await page.goto("/admin/kategori");
  await expect(barisKategori(page, nama)).toHaveCount(0);
});

test("UAT-C7: nama Kategori yang sudah dipakai ditolak dengan pesan, tanpa membedakan huruf besar dan kecil", async ({
  page,
}) => {
  // Akhiran unik menjaga test ini dari Kategori test lain di app_test, termasuk "Streaming" di atas.
  const akhiran = randomUUID().slice(0, 8);
  const streaming = `Streaming ${akhiran}`;
  const musik = `Musik ${akhiran}`;
  const pesan =
    "Nama ini sudah dipakai Kategori lain, tanpa membedakan huruf besar dan kecil. Ganti namanya supaya setiap Kategori berbeda.";
  await masukSebagaiAdmin(page);
  for (const nama of [streaming, musik]) {
    await page.goto("/admin/kategori/baru");
    await page.getByLabel("Nama").fill(nama);
    await page.getByLabel("Gambar ikon").setInputFiles({
      name: "ikon.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page).toHaveURL("/admin/kategori");
  }

  // Langkah 1: membuat Kategori "streaming".
  await page.goto("/admin/kategori/baru");
  await page.getByLabel("Nama").fill(`streaming ${akhiran}`);
  await page.getByLabel("Gambar ikon").setInputFiles({
    name: "ikon.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(page.getByText(pesan)).toBeVisible();
  await expect(page).toHaveURL("/admin/kategori/baru");
  await expect(page.getByLabel("Nama")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Nama")).toHaveValue(`streaming ${akhiran}`);

  // Langkah 2: mengganti nama Kategori "Musik" menjadi "Streaming".
  await page.goto("/admin/kategori");
  await barisKategori(page, musik)
    .getByRole("link", { name: `Ubah ${musik}` })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ubah Kategori" }),
  ).toBeVisible();
  await page.getByLabel("Nama").fill(streaming);
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(page.getByText(pesan)).toBeVisible();
  await expect(page.getByLabel("Nama")).toHaveAttribute("aria-invalid", "true");

  // Kategori "Streaming" dan "Musik" tetap seperti semula.
  await page.goto("/admin/kategori");
  await expect(barisKategori(page, streaming)).toHaveCount(1);
  await expect(barisKategori(page, musik)).toHaveCount(1);
  await expect(barisKategori(page, `streaming ${akhiran}`)).toHaveCount(0);
});
