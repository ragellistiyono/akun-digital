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
 * Kategori, Produk Netflix Premium dengan Format Item stok `Email`, `Password`, `Profil`, dan Varian
 * "1 Bulan" dibuat lewat dasbor admin seperti biasa, dengan nama unik per run (UAT-D1). Lalu halaman
 * Varian itu dibuka lewat tombol Item stok di daftar Varian.
 */
async function bukaVarianBaru(page: Page) {
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
  await page.getByLabel("Nama", { exact: true }).fill(nama);
  await page.getByLabel("Kategori").selectOption({ label: kategori });
  await page
    .getByLabel("Deskripsi")
    .fill("Akun Netflix Premium untuk satu profil.");
  await page
    .getByLabel("Ketentuan garansi")
    .fill("Garansi 30 hari sejak Item stok diterima.");
  await page.getByLabel("Nama kolom 1").fill("Email");
  await page.getByRole("button", { name: "Tambah kolom" }).click();
  await page.getByLabel("Nama kolom 2").fill("Password");
  await page.getByRole("button", { name: "Tambah kolom" }).click();
  await page.getByLabel("Nama kolom 3").fill("Profil");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL("/admin/produk");

  await page.getByRole("link", { name: `Ubah ${nama}` }).click();
  const bagianVarian = page.getByRole("region", { name: "Varian" });
  await bagianVarian.getByRole("button", { name: "Tambah Varian" }).click();
  const form = bagianVarian.getByRole("form", { name: "Tambah Varian" });
  await form.getByLabel("Nama").fill("1 Bulan");
  await form.getByLabel("Harga jual").fill("50.000");
  await form.getByRole("button", { name: "Simpan Varian" }).click();
  await expect(form).toHaveCount(0);

  await bagianVarian
    .getByRole("link", { name: "Item stok Varian 1 Bulan" })
    .click();
  await expect(page).toHaveURL(
    /\/admin\/produk\/[0-9a-f-]{36}\/varian\/[0-9a-f-]{36}$/,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Varian 1 Bulan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: `Produk ${nama}` }),
  ).toBeVisible();
}

/** Angka Stok Varian di halaman Varian. */
const angkaStokVarian = (page: Page) =>
  page
    .getByRole("region", { name: "Stok Varian" })
    .getByText(/^\d+$/, { exact: true });

const barisDitolak = (bagian: Locator, nomor: number) =>
  bagian
    .getByRole("list", { name: "Baris yang ditolak" })
    .getByRole("listitem")
    .filter({ hasText: `Baris ${nomor}` });

const tanpaGulirSamping = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

test("lima baris UAT-D1 yang ditempel menghasilkan 3 tersimpan, 2 ditolak, dan Stok Varian bertambah 3", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await bukaVarianBaru(page);
  await expect(angkaStokVarian(page)).toHaveText("0");

  const tempel = page.getByRole("region", { name: "Tempel banyak Item stok" });
  await expect(
    tempel.getByText(
      "Satu baris untuk satu Item stok, dengan kolom dipisah garis tegak (|) menurut urutan Format Item stok: Email, Password, Profil. Baris kosong diabaikan.",
    ),
  ).toBeVisible();
  await tempel
    .getByLabel("Tempelan Item stok")
    .fill(
      [
        "a@mail.com|pass1|Profil 1",
        "b@mail.com|pass2|Profil 2",
        "c@mail.com|pass3",
        "a@mail.com|pass1|Profil 1",
        "d@mail.com|pass4|Profil 4",
      ].join("\n"),
    );
  await tempel.getByRole("button", { name: "Simpan tempelan" }).click();

  await expect(tempel.getByRole("status")).toHaveText("3 tersimpan, 2 ditolak");
  await expect(
    tempel
      .getByRole("list", { name: "Baris yang ditolak" })
      .getByRole("listitem"),
  ).toHaveCount(2);
  await expect(barisDitolak(tempel, 3)).toContainText("c@mail.com|pass3");
  await expect(barisDitolak(tempel, 3)).toContainText(
    "Jumlah kolomnya salah: 2 kolom, padahal Format Item stok punya 3 kolom (Email, Password, Profil).",
  );
  await expect(barisDitolak(tempel, 4)).toContainText(
    "Kembar dengan baris 1 di tempelan ini.",
  );
  await expect(tempel.getByLabel("Tempelan Item stok")).toHaveValue("");
  await expect(angkaStokVarian(page)).toHaveText("3");

  // Halaman Varian tetap bisa dipakai di ponsel 360 px tanpa gulir ke samping (PRD §11.1).
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await tanpaGulirSamping(page)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });

  // Tempelan yang sama lagi: semua baris sudah ada di Varian ini.
  await tempel
    .getByLabel("Tempelan Item stok")
    .fill("a@mail.com|pass1|Profil 1");
  await tempel.getByRole("button", { name: "Simpan tempelan" }).click();
  await expect(tempel.getByRole("status")).toHaveText("0 tersimpan, 1 ditolak");
  await expect(barisDitolak(tempel, 1)).toContainText(
    "Sama persis dengan Item stok yang sudah ada di Varian ini.",
  );

  await page.reload();
  await expect(angkaStokVarian(page)).toHaveText("3");
});

test("form satu Item stok menyimpan Item stok, lalu menolak kolom kosong dan Item stok yang sudah ada", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await bukaVarianBaru(page);
  const form = page.getByRole("region", { name: "Tambah satu Item stok" });

  // Satu isian untuk setiap kolom Format Item stok, menurut urutannya.
  await expect(form.getByRole("textbox")).toHaveCount(3);
  await form.getByLabel("Email").fill("budi@mail.com");
  await form.getByLabel("Password").fill("rahasia123");
  await form.getByLabel("Profil").fill("Profil 2");
  await form.getByRole("button", { name: "Simpan Item stok" }).click();
  await expect(form.getByRole("status")).toHaveText(
    "Item stok tersimpan dengan status Tersedia.",
  );
  await expect(form.getByLabel("Email")).toHaveValue("");
  await expect(angkaStokVarian(page)).toHaveText("1");

  // Kolom kosong ditolak dengan pesan di kolom itu.
  await form.getByLabel("Email").fill("siti@mail.com");
  await form.getByLabel("Password").fill("rahasia456");
  await form.getByRole("button", { name: "Simpan Item stok" }).click();
  await expect(
    form.getByText("Profil belum diisi. Ketik Profil untuk Item stok ini."),
  ).toBeVisible();
  await expect(form.getByLabel("Profil")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(form.getByLabel("Email")).toHaveValue("siti@mail.com");
  await expect(angkaStokVarian(page)).toHaveText("1");

  // Item stok yang sama persis dengan yang sudah ada ditolak.
  await form.getByLabel("Email").fill("budi@mail.com");
  await form.getByLabel("Password").fill("rahasia123");
  await form.getByLabel("Profil").fill("Profil 2");
  await form.getByRole("button", { name: "Simpan Item stok" }).click();
  await expect(form.getByRole("alert")).toHaveText(
    "Item stok ini sama persis dengan Item stok yang sudah ada di Varian ini, jadi tidak disimpan. Periksa lagi isinya, lalu simpan Item stok yang belum ada.",
  );
  await expect(angkaStokVarian(page)).toHaveText("1");
});
