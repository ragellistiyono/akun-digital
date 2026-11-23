import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test. Database
// itu dipakai bersama test lain yang berjalan bersamaan, jadi setiap test memakai Member, Produk, dan Voucher unik.
import { db } from "../src/server/db";
import { pesanan, user, varian } from "../src/server/db/schema";
import { ubahSaldoOlehAdmin } from "../src/server/saldo";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";
import { buatVoucher } from "../src/server/voucher";

// Bayar dengan saldo di Checkout (T80, PRD §5.2, §5.7, §9.5, §15.7, UAT-O6, UAT-O7). Produk dan Voucher-nya meniru
// persiapan bersama docs/UAT.md [CONTOH]: Uji Bayar Rp 1.000, Netflix Premium 1 Bulan Rp 50.000, dan HEMAT10 (10%
// maksimal Rp 10.000, minimal Harga jual Rp 50.000), dengan akhiran unik. Nama Produk-nya bukan Netflix, supaya
// tidak mengubah hasil pencarian "netflix" di test lain yang berjalan bersamaan.

const PASSWORD_ADMIN = "sandi-uji-admin-123";
const PASSWORD_MEMBER = "sandi-uji-member-123";

const akhiran = () =>
  randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

test.use({ viewport: { width: 390, height: 800 } });

/** Id Varian satu-satunya Produk baru dengan Harga jual itu dan 5 Item stok Tersedia. */
async function varianBaru(nama: string, hargaJual: number) {
  const produkId = await sisipkanProduk({
    nama: `${nama} ${akhiran()}`,
    varian: [{ nama: "1 Bulan", hargaJual, Tersedia: 5 }],
  });
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return id;
}

/** Member baru yang saldonya ditambah Admin sebesar itu, beserta id-nya. */
async function memberDenganSaldo(saldo: number) {
  const email = `budi-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  await ubahSaldoOlehAdmin({
    idMember: id,
    aksi: "tambah",
    nominal: String(saldo),
    keterangan: "Saldo awal test",
  });
  return { email, id };
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

/** Nilai satu baris rincian, misalnya "Rp 1.000" untuk baris Harga jual. */
const nilaiRincian = (page: Page, label: string) =>
  rincian(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) })
    .getByRole("cell");

const pilihanMetode = (page: Page) =>
  page.getByRole("radiogroup", { name: "Bayar dengan" });

test("UAT-O6: Member dengan saldo cukup membeli Uji Bayar dengan saldo, lalu Halaman Pesanan Selesai langsung tampil tanpa Kode unik, saldo berkurang Rp 1.000, dan detail admin menampilkan Metode Saldo", async ({
  page,
  browser,
}) => {
  const varianId = await varianBaru("Uji Bayar", 1000);
  const member = await memberDenganSaldo(5000);
  await masukSebagaiMember(page, member.email);

  // Langkah 1: pilihan Saldo terpilih, dan tombolnya menyebut nominal.
  await page.goto(`/checkout?varianId=${varianId}`);
  await expect(
    pilihanMetode(page).getByRole("radio", { name: "Saldo (Rp 5.000)" }),
  ).toBeChecked();
  await expect(
    pilihanMetode(page).getByRole("radio", { name: "QRIS" }),
  ).not.toBeChecked();
  await expect(nilaiRincian(page, "Kode unik")).toHaveCount(0);
  await expect(nilaiRincian(page, "Total bayar")).toHaveText("Rp 1.000");

  // Langkah 2: Halaman Pesanan Selesai langsung tampil dengan Item stok, tanpa QRIS.
  await page
    .getByRole("button", { name: "Bayar Rp 1.000 dengan saldo" })
    .click();
  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pesanan" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Salin semua" })).toBeVisible();
  await expect(nilaiRincian(page, "Harga jual")).toHaveText("Rp 1.000");
  await expect(nilaiRincian(page, "Kode unik")).toHaveCount(0);
  await expect(nilaiRincian(page, "Total bayar")).toHaveText("Rp 1.000");
  await expect(rincian(page)).toContainText("Dibayar dengan saldo");

  const [{ nomorPesanan }] = await db
    .select({ nomorPesanan: pesanan.nomorPesanan })
    .from(pesanan)
    .where(eq(pesanan.email, member.email));

  // Riwayat saldo mencatat baris Pembelian −Rp 1.000 dengan Nomor Pesanan-nya, dan saldo menjadi Rp 4.000.
  await page.goto("/akun/riwayat-saldo");
  const barisPembelian = page
    .getByRole("table", { name: /^Riwayat saldo/ })
    .getByRole("row")
    .filter({ hasText: nomorPesanan });
  await expect(barisPembelian).toContainText("Pembelian");
  await expect(barisPembelian).toContainText("Rp 1.000");
  await expect(barisPembelian).toContainText("Rp 4.000");

  // Detail Pesanan di dasbor admin: Metode Saldo, Biaya transaksi Rp 0, dan pelaku "Pembeli (saldo)".
  const halamanAdmin = await (await browser.newContext()).newPage();
  await masukSebagaiAdmin(halamanAdmin);
  await halamanAdmin.goto(`/admin/pesanan/${nomorPesanan}`);
  const panelPesanan = halamanAdmin.getByRole("region", {
    name: "Pesanan",
    exact: true,
  });
  await expect(panelPesanan).toContainText("Metode");
  await expect(panelPesanan.getByText("Saldo", { exact: true })).toBeVisible();
  await expect(nilaiRincian(halamanAdmin, "Kode unik")).toHaveCount(0);
  await expect(nilaiRincian(halamanAdmin, "Biaya transaksi")).toHaveText(
    "Rp 0",
  );
  await expect(rincian(halamanAdmin)).toContainText("Dibayar dengan saldo");
  await expect(
    halamanAdmin.getByRole("table", { name: "Riwayat perubahan status" }),
  ).toContainText("Pembeli (saldo)");
});

test("UAT-O7: dengan saldo Rp 45.000, Checkout Netflix Premium 1 Bulan menampilkan saldo kurang Rp 5.000, lalu HEMAT10 membuat tombolnya Bayar Rp 45.000 dengan saldo", async ({
  page,
}) => {
  const varianId = await varianBaru("Premium Saldo", 50000);
  const kode = `HEMAT10${akhiran()}`;
  await buatVoucher({
    kode,
    jenisPotongan: "persen",
    nilai: 10,
    batasMaksimum: 10000,
    kuotaVoucher: null,
    batasPerEmail: 1,
    minimalHargaJual: 50000,
    mulai: null,
    berakhir: null,
    cakupan: { jenis: "semua" },
    khususMember: false,
    aktif: true,
  });
  const member = await memberDenganSaldo(45000);
  await masukSebagaiMember(page, member.email);

  // Langkah 2: Saldo tidak bisa dipilih, pilihan awalnya QRIS, dan kata "Top up" menaut ke halaman Top up.
  await page.goto(`/checkout?varianId=${varianId}`);
  const saldo = pilihanMetode(page).getByRole("radio", {
    name: "Saldo (Rp 45.000)",
  });
  await expect(saldo).toBeDisabled();
  await expect(
    pilihanMetode(page).getByRole("radio", { name: "QRIS" }),
  ).toBeChecked();
  await expect(
    page.getByText("Saldo kurang Rp 5.000. Top up dulu."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Top up" })).toHaveAttribute(
    "href",
    "/akun/top-up",
  );
  await expect(
    page.getByRole("button", { name: "Bayar dengan QRIS" }),
  ).toBeVisible();

  // Langkah 3: potongan Rp 5.000 membuat saldo cukup.
  await page
    .getByRole("textbox", { name: "Kode voucher (opsional)" })
    .fill(kode);
  await page.getByRole("button", { name: "Pakai" }).click();
  await expect(saldo).toBeEnabled();
  await expect(saldo).toBeChecked();
  await expect(page.getByText("Saldo kurang")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Bayar Rp 45.000 dengan saldo" }),
  ).toBeVisible();
});
