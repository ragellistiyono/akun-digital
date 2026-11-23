import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test. Database
// itu dipakai bersama test lain yang berjalan bersamaan, jadi setiap test memakai Member dan Produk unik.
import { db } from "../src/server/db";
import { pesanan, varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";

// Checkout Produk gratis dan Pesanan gratis (T86, PRD §9.5, §14.6, §16.3, §16.4, §16.5, UAT-P3, UAT-P5). Produk
// gratisnya meniru Akun Uji Gratis dari persiapan M6 di docs/UAT.md [CONTOH]: Format Item stok Email dan Password,
// Batas per Member 2, dan satu Varian "Akun Baru" dengan Harga jual Rp 1.000, Harga normal Rp 15.000, Harga modal
// Rp 0, dan 5 Item stok Tersedia, dengan akhiran unik. Admin belum bisa menjadikan Produk gratis dari dasbor admin
// (T87), jadi Produk gratis ini disiapkan langsung di database.
// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

const PASSWORD_ADMIN = "sandi-uji-admin-123";
const PASSWORD_MEMBER = "sandi-uji-member-123";

test.use({ viewport: { width: 390, height: 800 } });

/** Id Produk dan Varian Akun Uji Gratis baru [CONTOH]. */
async function akunUjiGratis() {
  const produkId = await sisipkanProduk({
    nama: `Akun Uji Gratis ${randomUUID().slice(0, 8)}`,
    formatItemStok: ["Email", "Password"],
    batasPerMember: 2,
    varian: [
      {
        nama: "Akun Baru",
        hargaJual: 1000,
        hargaNormal: 15000,
        hargaModal: 0,
        Tersedia: 5,
      },
    ],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return { produkId, varianId };
}

async function masukSebagaiMember(page: Page, email: string) {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");
}

// Membuat Admin persis seperti pemilik di server: `pnpm admin:buat <email>`, password lewat input.
async function masukSebagaiAdmin(page: Page) {
  const email = `admin-${randomUUID()}@example.test`;
  const hasil = spawnSync("pnpm", ["--silent", "admin:buat", email], {
    input: `${PASSWORD_ADMIN}\n${PASSWORD_ADMIN}\n`,
    encoding: "utf8",
  });
  expect(hasil.status, hasil.stderr).toBe(0);
  await page.goto("/admin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_ADMIN);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/admin/ringkasan");
}

const rincian = (page: Page) =>
  page.getByRole("region", { name: "Rincian pembayaran" });

/** Nilai satu baris rincian, misalnya "Rp 0" untuk baris Total bayar. */
const nilaiRincian = (page: Page, label: string) =>
  rincian(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) })
    .getByRole("cell");

/** Rincian Pesanan gratis: hanya "Total bayar Rp 0", lalu tulisan "Gratis" (PRD §16.4). */
async function rincianGratis(page: Page) {
  await expect(rincian(page).getByRole("rowheader")).toHaveText([
    "Total bayar",
  ]);
  await expect(nilaiRincian(page, "Total bayar")).toHaveText("Rp 0");
  await expect(
    rincian(page).getByText("Gratis", { exact: true }),
  ).toBeVisible();
}

const isiAdmin = (page: Page) => page.getByRole("main");

/** Baris data tabel Pesanan Selesai Laporan keuangan, tanpa baris judul kolom. */
const barisTabelLaporan = (page: Page) =>
  isiAdmin(page)
    .getByRole("table", { name: "Pesanan Selesai", exact: true })
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader") });

test("UAT-P3 dan UAT-P5: Member mengambil Akun Uji Gratis dua kali tanpa QRIS, kunjungan ketiga menampilkan pesan jatah habis tanpa tombol, lalu detail admin dan Laporan keuangan Metode Gratis menampilkan Pesanan gratis", async ({
  page,
  browser,
}) => {
  const { varianId } = await akunUjiGratis();
  const email = `budi-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  await masukSebagaiMember(page, email);

  // Langkah 1: Checkout berisi email Member yang tidak bisa diubah, rincian "Total bayar Rp 0" dan "Gratis", dan
  // jatah sisa 2 dari 2, tanpa isian voucher dan pilihan Saldo atau QRIS.
  await page.goto(`/checkout?varianId=${varianId}`);
  const isianEmail = page.getByLabel("Email");
  await expect(isianEmail).toHaveValue(email);
  await expect(isianEmail).toHaveAttribute("readonly", "");
  await rincianGratis(page);
  await expect(page.getByText("Jatah Anda: sisa 2 dari 2")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Kode voucher (opsional)" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("radiogroup", { name: "Bayar dengan" }),
  ).toHaveCount(0);

  // Halaman Pesanan Selesai langsung tampil dengan Item stok, tanpa QRIS.
  await page.getByRole("button", { name: "Ambil gratis" }).click();
  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pesanan" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Salin semua" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^QRIS/ })).toHaveCount(0);
  await rincianGratis(page);

  // Langkah 2: jatahnya masih sisa 1 dari 2, dan pengambilan kedua juga berhasil.
  await page.goto(`/checkout?varianId=${varianId}`);
  await expect(page.getByText("Jatah Anda: sisa 1 dari 2")).toBeVisible();
  await page.getByRole("button", { name: "Ambil gratis" }).click();
  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole("button", { name: "Salin semua" })).toBeVisible();

  // Langkah 3: tombol "Ambil gratis" diganti pesan jatah habis.
  await page.goto(`/checkout?varianId=${varianId}`);
  await expect(
    page.getByText("Anda sudah mengambil 2 dari batas 2 untuk Produk ini."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Ambil gratis" })).toHaveCount(
    0,
  );

  // Kedua Pesanan tampil di Riwayat Pesanan Member, dengan Total bayar Rp 0.
  const semuaPesanan = await db
    .select({ nomorPesanan: pesanan.nomorPesanan })
    .from(pesanan)
    .where(eq(pesanan.email, email));
  expect(semuaPesanan).toHaveLength(2);
  await page.goto("/riwayat");
  for (const { nomorPesanan } of semuaPesanan) {
    await expect(
      page
        .getByRole("list", { name: "Riwayat Pesanan" })
        .getByRole("listitem")
        .filter({ hasText: nomorPesanan }),
    ).toContainText("Rp 0");
  }

  // Langkah 4: detail Pesanan di dasbor admin menampilkan Metode Gratis, rincian Pesanan gratis, Harga modal Rp 0,
  // Biaya transaksi Rp 0, dan pelaku "Pembeli (gratis)".
  const halamanAdmin = await (await browser.newContext()).newPage();
  await masukSebagaiAdmin(halamanAdmin);
  await halamanAdmin.goto(`/admin/pesanan/${semuaPesanan[0].nomorPesanan}`);
  const panelPesanan = halamanAdmin.getByRole("region", {
    name: "Pesanan",
    exact: true,
  });
  await expect(panelPesanan).toContainText("Metode");
  await expect(panelPesanan.getByText("Gratis", { exact: true })).toBeVisible();
  await expect(nilaiRincian(halamanAdmin, "Total bayar")).toHaveText("Rp 0");
  await expect(
    rincian(halamanAdmin).getByText("Gratis", { exact: true }),
  ).toBeVisible();
  await expect(nilaiRincian(halamanAdmin, "Harga jual")).toHaveCount(0);
  await expect(nilaiRincian(halamanAdmin, "Kode unik")).toHaveCount(0);
  await expect(nilaiRincian(halamanAdmin, "Harga modal")).toHaveText("Rp 0");
  await expect(nilaiRincian(halamanAdmin, "Biaya transaksi")).toHaveText(
    "Rp 0",
  );
  await expect(
    halamanAdmin.getByRole("table", { name: "Riwayat perubahan status" }),
  ).toContainText("Pembeli (gratis)");

  // UAT-P5 langkah 2: Laporan keuangan dengan Metode Gratis hanya berisi Pesanan gratis, dengan Pendapatan Rp 0.
  await halamanAdmin.goto("/admin/laporan");
  await halamanAdmin
    .getByLabel("Metode", { exact: true })
    .selectOption("Gratis");
  await halamanAdmin.getByRole("button", { name: "Tampilkan" }).click();
  await expect(halamanAdmin).toHaveURL(/metode=Gratis/);
  await expect(
    isiAdmin(halamanAdmin)
      .getByRole("table", { name: "Rincian angka" })
      .getByRole("row")
      .filter({
        has: halamanAdmin.getByRole("rowheader", {
          name: "Pendapatan",
          exact: true,
        }),
      })
      .getByRole("cell"),
  ).toHaveText("Rp 0");
  for (const { nomorPesanan } of semuaPesanan) {
    await expect(
      barisTabelLaporan(halamanAdmin).filter({ hasText: nomorPesanan }),
    ).toHaveCount(1);
  }
  const metodeTabel = await barisTabelLaporan(halamanAdmin)
    .locator("td:nth-of-type(2)")
    .evaluateAll((sel) => sel.map((s) => (s.textContent ?? "").trim()));
  expect(new Set(metodeTabel)).toEqual(new Set(["Gratis"]));
});
