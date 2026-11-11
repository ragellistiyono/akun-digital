import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const PASSWORD = "sandi-uji-admin-123";

// Gambar PNG 1×1 piksel yang sah, untuk ikon Kategori.
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

/**
 * Kategori dibuat lewat dasbor admin seperti biasa. Namanya diberi akhiran unik, karena test
 * kelola-kategori memakai dan membersihkan Kategori yang bernama tepat "Streaming" pada saat yang
 * bisa bersamaan dengan test ini.
 */
async function buatKategori(page: Page, nama: string) {
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

const barisProduk = (page: Page, nama: string) =>
  page.getByRole("row").filter({ has: page.getByText(nama, { exact: true }) });

const tanpaGulirSamping = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

// Produk "Netflix Premium" sisa run sebelumnya dibuang dulu, supaya baris "Netflix Premium" di
// daftar hanya milik test ini.
test.beforeAll(async () => {
  const sql = postgres(process.env.DATABASE_URL ?? "", {
    max: 1,
    onnotice: () => {},
  });
  try {
    await sql`delete from produk where nama = 'Netflix Premium'`;
  } finally {
    await sql.end();
  }
});

test('Admin membuat "Netflix Premium" di Kategori Streaming dengan Format Item stok Email, Password, Profil dan tanda Produk Unggulan, lalu menonaktifkan dan mengaktifkannya kembali', async ({
  page,
}) => {
  const streaming = `Streaming ${randomUUID().slice(0, 8)}`;
  await masukSebagaiAdmin(page);
  await buatKategori(page, streaming);

  await page
    .getByRole("navigation", { name: "Menu admin" })
    .getByRole("link", { name: "Produk" })
    .click();
  await expect(page).toHaveURL("/admin/produk");
  await expect(
    page.getByRole("heading", { level: 1, name: "Produk" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Tambah Produk" }).click();
  await expect(page).toHaveURL("/admin/produk/baru");
  await page.getByLabel("Nama", { exact: true }).fill("Netflix Premium");
  await page.getByLabel("Kategori").selectOption({ label: streaming });
  await page
    .getByLabel("Deskripsi")
    .fill("Akun Netflix Premium untuk satu profil.");
  await page
    .getByLabel("Ketentuan garansi")
    .fill("Garansi 30 hari sejak Item stok diterima.");
  await page.getByLabel("Produk Unggulan").check();
  // Produk baru aktif kecuali Admin mengosongkan centangnya.
  await expect(page.getByLabel("Aktif")).toBeChecked();

  await page.getByLabel("Nama kolom 1").fill("Email");
  await page.getByRole("button", { name: "Tambah kolom" }).click();
  await expect(page.getByLabel("Nama kolom 2")).toBeFocused();
  await page.getByLabel("Nama kolom 2").fill("Password");
  await page.getByRole("button", { name: "Tambah kolom" }).click();
  await page.getByLabel("Nama kolom 3").fill("Profil");
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(page).toHaveURL("/admin/produk");
  const netflix = barisProduk(page, "Netflix Premium");
  await expect(netflix).toHaveCount(1);
  await expect(netflix.getByText(streaming, { exact: true })).toBeVisible();
  await expect(netflix.getByText("Aktif", { exact: true })).toBeVisible();
  await expect(netflix.getByText("Unggulan", { exact: true })).toBeVisible();

  // Daftar Produk tetap bisa dipakai di ponsel 360 px tanpa gulir ke samping (PRD §11.1).
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await tanpaGulirSamping(page)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });

  await netflix.getByRole("link", { name: "Ubah Netflix Premium" }).click();
  await expect(page).toHaveURL(/^.*\/admin\/produk\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Ubah Produk" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nama", { exact: true })).toHaveValue(
    "Netflix Premium",
  );
  await expect(
    page.getByLabel("Kategori").locator("option:checked"),
  ).toHaveText(streaming);
  await expect(page.getByLabel("Deskripsi")).toHaveValue(
    "Akun Netflix Premium untuk satu profil.",
  );
  await expect(page.getByLabel("Ketentuan garansi")).toHaveValue(
    "Garansi 30 hari sejak Item stok diterima.",
  );
  await expect(page.getByLabel("Produk Unggulan")).toBeChecked();
  // Format Item stok hanya ditampilkan, berurutan seperti saat dibuat.
  await expect(
    page.getByRole("list", { name: "Format Item stok" }).getByRole("listitem"),
  ).toHaveText(["Email", "Password", "Profil"]);
  await expect(page.getByLabel(/^Nama kolom/)).toHaveCount(0);

  // Ubah form di ponsel 360 px juga tanpa gulir ke samping.
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await tanpaGulirSamping(page)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.getByLabel("Aktif").uncheck();
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL("/admin/produk");
  await expect(netflix.getByText("Nonaktif", { exact: true })).toBeVisible();
  await expect(netflix.getByText("Aktif", { exact: true })).toHaveCount(0);
  await expect(netflix.getByText("Unggulan", { exact: true })).toBeVisible();

  await netflix.getByRole("link", { name: "Ubah Netflix Premium" }).click();
  await expect(page.getByLabel("Aktif")).not.toBeChecked();
  await page.getByLabel("Aktif").check();
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL("/admin/produk");
  await expect(netflix.getByText("Aktif", { exact: true })).toBeVisible();
  await expect(netflix.getByText("Nonaktif", { exact: true })).toHaveCount(0);
});

test("Produk tanpa Kategori dan Format Item stok tanpa kolom, dengan nama kolom kosong, atau dengan nama kolom kembar ditolak dengan pesan", async ({
  page,
}) => {
  const nama = `Disney Plus ${randomUUID().slice(0, 8)}`;
  await masukSebagaiAdmin(page);
  await page.goto("/admin/produk/baru");

  // Form kosong: satu kolom kosong tersedia sejak awal.
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByLabel("Kategori")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.getByText(
      "Kategori belum dipilih. Pilih satu Kategori untuk Produk ini.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Nama kolom 1")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.getByText(
      "Nama kolom 1 belum diisi. Isi namanya, atau hapus kolom itu.",
    ),
  ).toBeVisible();

  // Nama kolom kembar: sama persis setelah spasi di awal dan akhir dibuang.
  await page.getByLabel("Nama", { exact: true }).fill(nama);
  await page.getByLabel("Produk Unggulan").check();
  await page.getByLabel("Nama kolom 1").fill("Email");
  await page.getByRole("button", { name: "Tambah kolom" }).click();
  await page.getByLabel("Nama kolom 2").fill(" Email ");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(
    page.getByText(
      "Nama kolom 2 sudah dipakai kolom sebelumnya. Ganti namanya supaya setiap kolom berbeda.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Nama kolom 2")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Nama kolom 1")).not.toHaveAttribute(
    "aria-invalid",
  );
  // Isian yang sudah diketik tetap terisi setelah ditolak.
  await expect(page).toHaveURL("/admin/produk/baru");
  await expect(page.getByLabel("Nama", { exact: true })).toHaveValue(nama);
  await expect(page.getByLabel("Produk Unggulan")).toBeChecked();
  await expect(page.getByLabel("Nama kolom 1")).toHaveValue("Email");
  await expect(page.getByLabel("Nama kolom 2")).toHaveValue(" Email ");

  // Semua kolom dihapus.
  await page.getByRole("button", { name: "Hapus kolom 2" }).click();
  await page.getByRole("button", { name: "Hapus kolom 1" }).click();
  await expect(page.getByText("Belum ada kolom.")).toBeVisible();
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(
    page.getByText(
      "Format Item stok belum punya kolom. Pilih Tambah kolom, lalu isi nama kolomnya, misalnya Email.",
    ),
  ).toBeVisible();

  await page.goto("/admin/produk");
  await expect(barisProduk(page, nama)).toHaveCount(0);
});
