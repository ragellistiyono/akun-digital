import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";

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
 * Kategori dan Produk dibuat lewat dasbor admin seperti biasa, dengan nama unik per run, lalu halaman
 * Ubah Produk-nya dibuka.
 */
async function bukaProdukBaru(page: Page) {
  const kategori = `Streaming ${randomUUID().slice(0, 8)}`;
  const nama = `Netflix Premium ${randomUUID().slice(0, 8)}`;
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

  await page.getByRole("link", { name: `Ubah ${nama}` }).click();
  await expect(page).toHaveURL(/^.*\/admin\/produk\/[0-9a-f-]{36}$/);
  return page.getByRole("region", { name: "Varian" });
}

const barisVarian = (bagian: Locator, nama: string) =>
  bagian
    .getByRole("list", { name: "Varian" })
    .getByRole("listitem")
    .filter({ has: bagian.page().getByText(nama, { exact: true }) });

/** Mengisi form Varian lalu memilih Simpan Varian. Isian yang tidak disebut dibiarkan. */
async function simpanVarian(
  form: Locator,
  isian: { nama?: string; hargaJual?: string; hargaNormal?: string },
) {
  if (isian.nama !== undefined) await form.getByLabel("Nama").fill(isian.nama);
  if (isian.hargaJual !== undefined) {
    await form.getByLabel("Harga jual").fill(isian.hargaJual);
  }
  if (isian.hargaNormal !== undefined) {
    await form.getByLabel("Harga normal").fill(isian.hargaNormal);
  }
  await form.getByRole("button", { name: "Simpan Varian" }).click();
}

const tanpaGulirSamping = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

test("Harga normal Rp 135.000 untuk Harga jual Rp 135.000 ditolak, Harga jual Rp 999 dan Rp 499.001 ditolak dengan pesan, sedangkan Rp 1.000 dan Rp 499.000 diterima (UAT-C4)", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  const bagian = await bukaProdukBaru(page);
  await expect(
    bagian.getByRole("heading", { level: 2, name: "Varian" }),
  ).toBeVisible();
  await expect(bagian.getByText("Belum ada Varian.")).toBeVisible();

  // Varian Netflix Premium dari PRD §3.2 dan §3.5.
  const formTambah = bagian.getByRole("form", { name: "Tambah Varian" });
  await bagian.getByRole("button", { name: "Tambah Varian" }).click();
  await expect(formTambah.getByLabel("Nama")).toBeFocused();
  // Varian baru aktif kecuali Admin mengosongkan centangnya.
  await expect(formTambah.getByLabel("Aktif")).toBeChecked();
  await simpanVarian(formTambah, {
    nama: "1 Bulan",
    hargaJual: "50.000",
    hargaNormal: "75.000",
  });
  await expect(formTambah).toHaveCount(0);
  const satuBulan = barisVarian(bagian, "1 Bulan");
  await expect(satuBulan.getByText("Rp 50.000", { exact: true })).toBeVisible();
  await expect(satuBulan.getByText("Harga normal Rp 75.000")).toBeVisible();
  await expect(satuBulan.getByText("Aktif", { exact: true })).toBeVisible();

  await bagian.getByRole("button", { name: "Tambah Varian" }).click();
  await simpanVarian(formTambah, { nama: "3 Bulan", hargaJual: "135.000" });
  const tigaBulan = barisVarian(bagian, "3 Bulan");
  await expect(
    tigaBulan.getByText("Rp 135.000", { exact: true }),
  ).toBeVisible();
  await expect(tigaBulan.getByText(/Harga normal/)).toHaveCount(0);

  // UAT-C4 langkah 2: Harga normal Varian 3 Bulan diisi Rp 135.000.
  await tigaBulan.getByRole("button", { name: "Ubah Varian 3 Bulan" }).click();
  const formUbah = bagian.getByRole("form", { name: "Ubah Varian 3 Bulan" });
  await expect(formUbah.getByLabel("Harga jual")).toHaveValue("135.000");
  await simpanVarian(formUbah, { hargaNormal: "135.000" });
  await expect(
    formUbah.getByText(
      "Harga normal tidak lebih besar dari Harga jual Rp 135.000. Isi Harga normal di atas Harga jual, atau kosongkan bila tidak ada harga pembanding.",
    ),
  ).toBeVisible();
  await expect(formUbah.getByLabel("Harga normal")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(formUbah.getByLabel("Harga normal")).toHaveValue("135.000");
  await formUbah.getByRole("button", { name: "Batal" }).click();
  await expect(tigaBulan.getByText(/Harga normal/)).toHaveCount(0);

  // UAT-C4 langkah 3 dan 4 di form Tambah Varian.
  await bagian.getByRole("button", { name: "Tambah Varian" }).click();
  await simpanVarian(formTambah, { nama: "1 Tahun", hargaJual: "999" });
  await expect(
    formTambah.getByText(
      "Harga jual kurang dari Rp 1.000. Isi Harga jual minimal Rp 1.000.",
    ),
  ).toBeVisible();
  await expect(formTambah.getByLabel("Harga jual")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await simpanVarian(formTambah, { hargaJual: "499.001" });
  await expect(
    formTambah.getByText(
      "Harga jual lebih dari Rp 499.000, batas tagihan QRIS. Isi Harga jual paling banyak Rp 499.000.",
    ),
  ).toBeVisible();
  await expect(barisVarian(bagian, "1 Tahun")).toHaveCount(0);

  await simpanVarian(formTambah, { hargaJual: "499.000" });
  const satuTahun = barisVarian(bagian, "1 Tahun");
  await expect(
    satuTahun.getByText("Rp 499.000", { exact: true }),
  ).toBeVisible();

  // Rp 1.000 juga diterima saat Varian diubah.
  await satuTahun.getByRole("button", { name: "Ubah Varian 1 Tahun" }).click();
  await simpanVarian(
    bagian.getByRole("form", { name: "Ubah Varian 1 Tahun" }),
    {
      hargaJual: "1.000",
    },
  );
  await expect(satuTahun.getByText("Rp 1.000", { exact: true })).toBeVisible();

  // Varian tersimpan dan tampil urut dari Harga jual termurah setelah halaman dibuka ulang.
  await page.reload();
  await expect(
    bagian.getByRole("list", { name: "Varian" }).getByRole("listitem"),
  ).toHaveText([/^1 Tahun/, /^1 Bulan/, /^3 Bulan/]);
});

test("Admin menonaktifkan Varian, lalu mengaktifkannya kembali", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  const bagian = await bukaProdukBaru(page);
  await bagian.getByRole("button", { name: "Tambah Varian" }).click();
  await simpanVarian(bagian.getByRole("form", { name: "Tambah Varian" }), {
    nama: "1 Bulan",
    hargaJual: "50.000",
  });
  const satuBulan = barisVarian(bagian, "1 Bulan");
  await expect(satuBulan.getByText("Aktif", { exact: true })).toBeVisible();

  await satuBulan.getByRole("button", { name: "Ubah Varian 1 Bulan" }).click();
  const formUbah = bagian.getByRole("form", { name: "Ubah Varian 1 Bulan" });
  await expect(formUbah.getByLabel("Nama")).toBeFocused();

  // Form Varian tetap bisa dipakai di ponsel 360 px tanpa gulir ke samping (PRD §11.1).
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await tanpaGulirSamping(page)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });

  await formUbah.getByLabel("Aktif").uncheck();
  await formUbah.getByRole("button", { name: "Simpan Varian" }).click();
  await expect(satuBulan.getByText("Nonaktif", { exact: true })).toBeVisible();
  await expect(satuBulan.getByText("Aktif", { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(satuBulan.getByText("Nonaktif", { exact: true })).toBeVisible();
  // Daftar Varian juga bisa dipakai di ponsel 360 px tanpa gulir ke samping.
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await tanpaGulirSamping(page)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });

  await satuBulan.getByRole("button", { name: "Ubah Varian 1 Bulan" }).click();
  await expect(formUbah.getByLabel("Aktif")).not.toBeChecked();
  await formUbah.getByLabel("Aktif").check();
  await formUbah.getByRole("button", { name: "Simpan Varian" }).click();
  await expect(satuBulan.getByText("Aktif", { exact: true })).toBeVisible();
  await expect(satuBulan.getByText("Nonaktif", { exact: true })).toHaveCount(0);
});
