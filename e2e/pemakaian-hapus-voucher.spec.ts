import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// Bahan test bersama. DATABASE_URL dan ITEM_STOK_KEY berasal dari .env.ci yang dimuat playwright.config.ts,
// jadi data ini masuk ke database app_test.
import { db } from "../src/server/db";
import { pesanan, varian, voucher } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";
import { buatVoucher } from "../src/server/voucher";

// Pemakaian Voucher di daftar Voucher dan hapus Voucher di dasbor admin (T55, PRD §8.5, §8.8 ▶ Keputusan
// 2026-11-17, UAT-H4 langkah 4, UAT-H5 langkah 4–5). Pesanan dibuat langsung di database, karena checkout
// belum mencatat Voucher (T57). Kode Voucher diberi akhiran unik per run, supaya tidak bertabrakan dengan
// HEMAT5 dan HEMAT10 di kelola-voucher.spec.ts maupun sisa run sebelumnya.
const PASSWORD = "sandi-uji-admin-123";

const akhiran = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
const KODE = {
  satukali: `SATUKALI${akhiran}`,
  hemat5: `HEMAT5${akhiran}`,
  coba: `COBA${akhiran}`,
  hapus: `HAPUS${akhiran}`,
};
let varianId = "";

/** Membuat Voucher nominal Rp 5.000 dengan Kuota voucher itu. Hasilnya id dan kodenya. */
async function voucherBaru(kode: string, kuotaVoucher: number | null) {
  await buatVoucher({
    kode,
    jenisPotongan: "nominal",
    nilai: 5000,
    batasMaksimum: null,
    kuotaVoucher,
    batasPerEmail: 1,
    minimalHargaJual: null,
    mulai: null,
    berakhir: null,
    cakupan: { jenis: "semua" },
    khususMember: false,
    aktif: true,
  });
  const [{ id }] = await db
    .select({ id: voucher.id })
    .from(voucher)
    .where(eq(voucher.kode, kode));
  return { id, kode };
}

test.beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: `Netflix Premium ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
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

const barisVoucher = (page: Page, kode: string) =>
  page
    .getByRole("main")
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: kode, exact: true }) });

/** Isi kolom Pemakaian di baris Voucher itu. */
async function pemakaianDiDaftar(page: Page, kode: string) {
  const kolom = await page
    .getByRole("main")
    .getByRole("columnheader")
    .allTextContents();
  return barisVoucher(page, kode)
    .getByRole("cell")
    .nth(kolom.indexOf("Pemakaian") - 1);
}

const panelHapus = (page: Page) =>
  page.getByRole("region", { name: "Hapus Voucher" });

/** Membuka form ubah Voucher itu, memilih Hapus Voucher, lalu menegaskannya. */
async function hapusLewatPanel(page: Page, id: string, kode: string) {
  await page.goto(`/admin/voucher/${id}`);
  const panel = panelHapus(page);
  await panel.getByRole("button", { name: "Hapus Voucher" }).click();
  await expect(panel).toContainText(`Hapus Voucher ${kode}?`);
  await panel
    .getByRole("button", { name: `Ya, hapus Voucher ${kode}` })
    .click();
}

const voucherAda = async (id: string) =>
  (await db.select({ id: voucher.id }).from(voucher).where(eq(voucher.id, id)))
    .length === 1;

test("UAT-H4 langkah 4: pemakaian SATUKALI tercatat 1 dari 1 selama Pesanan Email B Menunggu Pembayaran, lalu 0 dari 1 setelah Pesanan itu Dibatalkan; Voucher tanpa Kuota voucher hanya menulis jumlahnya", async ({
  page,
}) => {
  const satukali = await voucherBaru(KODE.satukali, 1);
  const emailB = await sisipkanPesanan({
    varianId,
    status: "Menunggu Pembayaran",
    voucher: satukali,
  });
  const hemat5 = await voucherBaru(KODE.hemat5, null);
  await sisipkanPesanan({ varianId, status: "Selesai", voucher: hemat5 });
  await sisipkanPesanan({ varianId, status: "Kedaluwarsa", voucher: hemat5 });

  await masukSebagaiAdmin(page);
  await page.goto("/admin/voucher");
  await expect(await pemakaianDiDaftar(page, KODE.satukali)).toHaveText(
    "1 dari 1",
  );
  await expect(await pemakaianDiDaftar(page, KODE.hemat5)).toHaveText("1");

  await db
    .update(pesanan)
    .set({ status: "Dibatalkan" })
    .where(eq(pesanan.id, emailB.id));
  await page.reload();
  await expect(await pemakaianDiDaftar(page, KODE.satukali)).toHaveText(
    "0 dari 1",
  );
});

test("UAT-H5 langkah 4: menghapus COBA yang tercatat di Pesanan Dibatalkan ditolak dengan pesan untuk menonaktifkannya, dan Voucher tetap ada", async ({
  page,
}) => {
  const coba = await voucherBaru(KODE.coba, null);
  await sisipkanPesanan({ varianId, status: "Dibatalkan", voucher: coba });

  await masukSebagaiAdmin(page);
  await hapusLewatPanel(page, coba.id, coba.kode);

  await expect(panelHapus(page).getByRole("alert")).toHaveText(
    "Voucher ini tidak bisa dihapus, karena sudah tercatat di 1 Pesanan. Pesanan berstatus apa pun dihitung, termasuk Kedaluwarsa dan Dibatalkan. Nonaktifkan Voucher ini saja: pilih Nonaktifkan di daftar Voucher, atau hapus centang Aktif di form ini lalu simpan. Voucher nonaktif tidak bisa dipakai di checkout, sedangkan Pesanan lamanya tetap utuh.",
  );
  expect(await voucherAda(coba.id)).toBe(true);
});

test("UAT-H5 langkah 5: HAPUS yang belum pernah dipakai terhapus setelah ditegaskan, lalu dasbor kembali ke daftar Voucher tanpa HAPUS", async ({
  page,
}) => {
  const hapus = await voucherBaru(KODE.hapus, null);

  await masukSebagaiAdmin(page);
  await page.goto(`/admin/voucher/${hapus.id}`);

  // Batal menutup penegasan tanpa menghapus.
  const panel = panelHapus(page);
  await panel.getByRole("button", { name: "Hapus Voucher" }).click();
  await panel.getByRole("button", { name: "Batal" }).click();
  await expect(panel.getByRole("button", { name: /^Ya, hapus/ })).toHaveCount(
    0,
  );
  expect(await voucherAda(hapus.id)).toBe(true);

  await hapusLewatPanel(page, hapus.id, hapus.kode);

  await expect(page).toHaveURL("/admin/voucher");
  await expect(barisVoucher(page, KODE.hapus)).toHaveCount(0);
  expect(await voucherAda(hapus.id)).toBe(false);
});
