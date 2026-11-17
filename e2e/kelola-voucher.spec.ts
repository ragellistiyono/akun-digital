import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

// Membuat, mengubah, menonaktifkan, dan mengaktifkan kembali Voucher di dasbor admin (T53, PRD §8.2, §8.4,
// §8.8 ▶ Keputusan 2026-11-17, UAT-H5 langkah 6–8).
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

const isi = (page: Page) => page.getByRole("main");

const barisVoucher = (page: Page, kode: string) =>
  isi(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: kode, exact: true }) });

/** Membuka form Voucher baru dari daftar Voucher. */
async function bukaFormBaru(page: Page) {
  await page.goto("/admin/voucher");
  await isi(page).getByRole("link", { name: "Tambah Voucher" }).click();
  await expect(page).toHaveURL("/admin/voucher/baru");
}

// HEMAT5 dan HEMAT10 sisa run yang gagal di tengah jalan dibuang dulu, supaya kodenya bisa dibuat lagi.
test.beforeAll(async () => {
  const sql = postgres(process.env.DATABASE_URL ?? "", {
    max: 1,
    onnotice: () => {},
  });
  try {
    await sql`delete from voucher where kode in ('HEMAT5', 'HEMAT10')`;
  } finally {
    await sql.end();
  }
});

test("Admin membuat HEMAT5 dan HEMAT10, menolak kode kembar dan kode bertanda hubung, mengubah syarat, lalu menonaktifkan dan mengaktifkan kembali Voucher", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);

  await page
    .getByRole("navigation", { name: "Menu admin" })
    .getByRole("link", { name: "Voucher" })
    .click();
  await expect(page).toHaveURL("/admin/voucher");
  await expect(
    page.getByRole("heading", { level: 1, name: "Voucher" }),
  ).toBeVisible();

  // HEMAT5: nominal Rp 5.000. Form baru dibuka dengan Batas per email 1.
  await bukaFormBaru(page);
  await expect(page.getByLabel("Batas per email")).toHaveValue("1");
  await expect(
    page.getByRole("radio", { name: "Nominal tetap" }),
  ).toBeChecked();
  await expect(page.getByLabel("Batas maksimum")).toHaveCount(0);
  await expect(isi(page)).toContainText("Semua Produk");
  await page.getByLabel("Kode").fill("HEMAT5");
  await page.getByLabel("Nilai potongan").fill("5000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL("/admin/voucher");

  // HEMAT10: 10%, maksimal Rp 10.000, minimal Harga jual Rp 50.000.
  await bukaFormBaru(page);
  await page.getByLabel("Kode").fill("HEMAT10");
  await page.getByRole("radio", { name: "Persen" }).check();
  await page.getByLabel("Nilai potongan").fill("10");
  await page.getByLabel("Batas maksimum").fill("10.000");
  await page.getByLabel("Minimal Harga jual").fill("50.000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL("/admin/voucher");

  // Keduanya tampil dengan potongannya, terbaru di atas.
  const hemat5 = barisVoucher(page, "HEMAT5");
  const hemat10 = barisVoucher(page, "HEMAT10");
  await expect(hemat5.getByRole("cell", { name: "Rp 5.000" })).toBeVisible();
  await expect(
    hemat10.getByRole("cell", { name: "10%, maks Rp 10.000" }),
  ).toBeVisible();
  await expect(hemat5.getByText("Aktif", { exact: true })).toBeVisible();
  await expect(
    hemat5.getByRole("cell", { name: "Tanpa batas waktu" }),
  ).toBeVisible();
  const kodeBerurutan = await isi(page)
    .getByRole("rowheader")
    .allTextContents();
  expect(kodeBerurutan.indexOf("HEMAT10")).toBeLessThan(
    kodeBerurutan.indexOf("HEMAT5"),
  );

  // UAT-H5 langkah 7: hemat5 ditolak karena sudah dipakai, HEMAT-10 karena bukan huruf dan angka saja.
  await bukaFormBaru(page);
  await page.getByLabel("Kode").fill("hemat5");
  await page.getByLabel("Nilai potongan").fill("3000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByLabel("Kode")).toHaveAccessibleDescription(
    "Kode ini sudah dipakai Voucher lain, tanpa membedakan huruf besar dan kecil. Ganti kodenya supaya setiap Voucher berbeda.",
  );
  await expect(page).toHaveURL("/admin/voucher/baru");

  await page.getByLabel("Kode").fill("HEMAT-10");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByLabel("Kode")).toHaveAccessibleDescription(
    "Kode hanya boleh berisi huruf A–Z dan angka 0–9, tanpa spasi atau tanda baca. Hapus karakter lainnya, misalnya HEMAT-10 menjadi HEMAT10.",
  );

  // Waktu berakhir yang sama dengan waktu mulai ditolak dengan pesan.
  await page.getByLabel("Kode").fill(`COBA${randomUUID().slice(0, 4)}`);
  await page.getByLabel("Waktu mulai (WIB)").fill("2026-11-30T10:00");
  await page.getByLabel("Waktu berakhir (WIB)").fill("2026-11-30T10:00");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(
    page.getByLabel("Waktu berakhir (WIB)"),
  ).toHaveAccessibleDescription(
    "Waktu berakhir harus setelah waktu mulai. Ubah waktu berakhirnya, atau kosongkan salah satu waktu.",
  );
  await expect(page).toHaveURL("/admin/voucher/baru");

  // UAT-H5 langkah 8: form ubah tidak punya isian kode. Mengubah syarat HEMAT5 tersimpan.
  await page.goto("/admin/voucher");
  await hemat5.getByRole("link", { name: "Ubah HEMAT5" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ubah Voucher" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Kode" })).toHaveCount(0);
  await expect(isi(page).getByText("HEMAT5", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Nilai potongan")).toHaveValue("5.000");
  await page.getByLabel("Nilai potongan").fill("7.500");
  await page.getByLabel("Waktu berakhir (WIB)").fill("2026-11-30T23:59");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL("/admin/voucher");
  await expect(hemat5.getByRole("cell", { name: "Rp 7.500" })).toBeVisible();
  await expect(
    hemat5.getByRole("cell", { name: "Sampai 30 Nov 2026 23.59" }),
  ).toBeVisible();

  await hemat5.getByRole("link", { name: "Ubah HEMAT5" }).click();
  await expect(page.getByLabel("Nilai potongan")).toHaveValue("7.500");
  await expect(page.getByLabel("Waktu berakhir (WIB)")).toHaveValue(
    "2026-11-30T23:59",
  );
  await page.getByRole("link", { name: "Batal" }).click();
  await expect(page).toHaveURL("/admin/voucher");

  // UAT-H5 langkah 6: HEMAT5 dinonaktifkan, lalu diaktifkan kembali, tanpa penegasan.
  await hemat5.getByRole("button", { name: "Nonaktifkan HEMAT5" }).click();
  await expect(hemat5.getByText("Nonaktif", { exact: true })).toBeVisible();
  await hemat5.getByRole("button", { name: "Aktifkan kembali HEMAT5" }).click();
  await expect(hemat5.getByText("Aktif", { exact: true })).toBeVisible();
  await expect(
    hemat5.getByRole("button", { name: "Nonaktifkan HEMAT5" }),
  ).toBeVisible();
});

test("Tamu yang membuka daftar atau form Voucher diarahkan ke halaman login admin", async ({
  page,
}) => {
  for (const alamat of ["/admin/voucher", "/admin/voucher/baru"]) {
    await page.goto(alamat);
    await expect(page).toHaveURL("/admin");
  }
});
