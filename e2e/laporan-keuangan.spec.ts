import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test, yang
// dipakai bersama test lain yang berjalan bersamaan. Karena itu angka yang dibandingkan selalu disaring ke
// Kategori milik test itu sendiri. Berkas ini tidak mencatat Biaya operasional, supaya total bulan di
// biaya-operasional.spec.ts tidak terganggu.
import { db } from "../src/server/db";
import { varian } from "../src/server/db/schema";
import { sisipkanKategori, sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";
import { tanggalIsianWib } from "../src/server/zona-waktu-toko";

// Laporan keuangan (T71, PRD §14.5, §14.6, §14.8, UAT-N6, UAT-N8).
// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.
const PASSWORD = "sandi-uji-admin-123";
const ALAMAT = "/admin/laporan";

// Membuat Admin persis seperti pemilik di server: `pnpm admin:buat <email>`, password lewat input.
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

/** Selisih hari antara dua tanggal "YYYY-MM-DD". */
const selisihHari = (awal: string, akhir: string) =>
  (Date.parse(akhir) - Date.parse(awal)) / (24 * 60 * 60 * 1000);

/** Hari tanggal "YYYY-MM-DD": 0 Minggu sampai 6 Sabtu. */
const hariDalamMinggu = (tanggal: string) =>
  new Date(`${tanggal}T00:00:00Z`).getUTCDay();

/** Kategori dan Produk uji dengan satu Varian. Hasilnya id dan nama keduanya, serta id Varian-nya. */
async function katalogUji({
  awalan,
  aktif = true,
}: {
  awalan: string;
  aktif?: boolean;
}) {
  const akhiran = randomUUID().slice(0, 8);
  const namaKategori = `${awalan} ${akhiran}`;
  const kategoriId = await sisipkanKategori({ nama: namaKategori });
  const namaProduk = `Produk ${awalan} ${akhiran}`;
  const produkId = await sisipkanProduk({
    nama: namaProduk,
    kategoriId,
    aktif,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, hargaModal: 35000 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return { kategoriId, namaKategori, produkId, namaProduk, varianId };
}

/** Nominal baris rincian angka berlabel itu, sebagai teks. */
const nilaiRincian = (page: Page, label: string) =>
  isi(page)
    .getByRole("table", { name: "Rincian angka" })
    .getByRole("row", { name: label })
    .getByRole("cell");

/** Baris data tabel Pesanan Selesai, tanpa baris judul kolom. */
const barisTabel = (page: Page) =>
  isi(page)
    .getByRole("table", { name: "Pesanan Selesai" })
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader") });

const KETERANGAN_BIAYA_OPERASIONAL =
  "Laba bersih ini belum dikurangi Biaya operasional, karena saringan Produk atau Kategori sedang aktif.";

test("halaman terbuka dengan periode Harian dan 30 hari terakhir, dan memilih Mingguan mengganti tanggal mulai ke Senin 12 minggu lalu (UAT-N6)", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  const hariIni = tanggalIsianWib(new Date());

  await page.goto(ALAMAT);

  const periode = isi(page).getByRole("group", { name: "Periode" });
  await expect(periode.getByRole("link", { name: "Harian" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.getByLabel("Tanggal akhir")).toHaveValue(hariIni);
  const mulaiHarian = await page.getByLabel("Tanggal mulai").inputValue();
  // 30 hari terakhir, termasuk hari ini.
  expect(selisihHari(mulaiHarian, hariIni)).toBe(29);

  await periode.getByRole("link", { name: "Mingguan" }).click();

  await expect(page).toHaveURL(`${ALAMAT}?periode=Mingguan`);
  await expect(periode.getByRole("link", { name: "Mingguan" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.getByLabel("Tanggal akhir")).toHaveValue(hariIni);
  await expect(page.getByLabel("Tanggal mulai")).not.toHaveValue(mulaiHarian);
  const mulaiMingguan = await page.getByLabel("Tanggal mulai").inputValue();
  // Senin dari 12 minggu terakhir, termasuk minggu berjalan: 11 minggu penuh sebelum Senin minggu ini.
  expect(hariDalamMinggu(mulaiMingguan)).toBe(1);
  expect(selisihHari(mulaiMingguan, hariIni)).toBeGreaterThanOrEqual(77);
  expect(selisihHari(mulaiMingguan, hariIni)).toBeLessThanOrEqual(83);
});

test("tanggal akhir sebelum tanggal mulai ditolak dengan pesan PRD §14.6", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await page.goto(ALAMAT);

  await page.getByLabel("Tanggal mulai").fill("2026-11-20");
  await page.getByLabel("Tanggal akhir").fill("2026-11-19");
  await page.getByRole("button", { name: "Tampilkan" }).click();

  await expect(isi(page).getByRole("alert")).toContainText(
    "Tanggal akhir tidak boleh sebelum tanggal mulai.",
  );
  await expect(
    isi(page).getByRole("table", { name: "Rincian angka" }),
  ).toHaveCount(0);
});

test("memilih Kategori membatasi pilihan Produk, dan saringan Kategori atau Produk menghilangkan pengurangan Biaya operasional beserta keterangannya", async ({
  page,
}) => {
  const streaming = await katalogUji({ awalan: "Streaming" });
  const lain = await katalogUji({ awalan: "Musik" });
  const nonaktif = await katalogUji({ awalan: "Game", aktif: false });
  await masukSebagaiAdmin(page);
  await page.goto(ALAMAT);

  // Tanpa saringan: Biaya operasional dikurangkan, tanpa keterangan.
  await expect(nilaiRincian(page, "− Biaya operasional")).toBeVisible();
  await expect(isi(page).getByText(KETERANGAN_BIAYA_OPERASIONAL)).toHaveCount(
    0,
  );
  // Produk nonaktif ikut muncul.
  await expect(
    page
      .getByLabel("Produk")
      .getByRole("option", { name: `${nonaktif.namaProduk} (nonaktif)` }),
  ).toHaveCount(1);

  await page.getByLabel("Kategori").selectOption({
    label: streaming.namaKategori,
  });

  const opsiProduk = page.getByLabel("Produk").getByRole("option");
  await expect(opsiProduk).toHaveText(["Semua", streaming.namaProduk]);

  await page.getByRole("button", { name: "Tampilkan" }).click();

  await expect(page).toHaveURL(new RegExp(`kategori=${streaming.kategoriId}`));
  await expect(isi(page).getByRole("note")).toHaveText(
    KETERANGAN_BIAYA_OPERASIONAL,
  );
  await expect(
    isi(page)
      .getByRole("table", { name: "Rincian angka" })
      .getByRole("row", { name: "− Biaya operasional" }),
  ).toHaveCount(0);

  // Produk tanpa Kategori.
  await page.getByLabel("Kategori").selectOption({ label: "Semua" });
  await page.getByLabel("Produk").selectOption({ label: lain.namaProduk });
  await page.getByRole("button", { name: "Tampilkan" }).click();

  await expect(page).toHaveURL(new RegExp(`produk=${lain.produkId}`));
  await expect(page.getByLabel("Produk")).toHaveValue(lain.produkId);
  await expect(isi(page).getByRole("note")).toHaveText(
    KETERANGAN_BIAYA_OPERASIONAL,
  );
  await expect(
    isi(page)
      .getByRole("table", { name: "Rincian angka" })
      .getByRole("row", { name: "− Biaya operasional" }),
  ).toHaveCount(0);
});

test("mencari sebagian email dalam huruf besar menyaring tabel tanpa mengubah rincian angka, dan mengetuk baris membuka detail Pesanan (UAT-N8)", async ({
  page,
}) => {
  const katalog = await katalogUji({ awalan: "Streaming" });
  const akhiran = randomUUID().slice(0, 8);
  const sekarang = Date.now();
  const dicari = await sisipkanPesanan({
    varianId: katalog.varianId,
    status: "Selesai",
    email: `email-a-${akhiran}@example.test`,
    hargaModal: 35000,
    biayaTransaksi: 0,
    waktuBayar: new Date(sekarang - 2 * 60 * 1000),
  });
  const terbaru = await sisipkanPesanan({
    varianId: katalog.varianId,
    status: "Selesai",
    hargaModal: null,
    biayaTransaksi: 0,
    waktuBayar: new Date(sekarang - 60 * 1000),
  });
  await masukSebagaiAdmin(page);

  // Menu samping dan Ringkasan belum menaut ke Laporan keuangan (PRD §13 ▶ Keputusan 2026-11-20).
  await expect(page.locator(`a[href^="${ALAMAT}"]`)).toHaveCount(0);

  await page.goto(`${ALAMAT}?kategori=${katalog.kategoriId}`);

  // Kolom PRD §14.8, dengan Pesanan terbaru dibayar di atas.
  await expect(
    isi(page)
      .getByRole("table", { name: "Pesanan Selesai" })
      .getByRole("columnheader"),
  ).toHaveText([
    "Nomor Pesanan",
    "Waktu bayar (WIB)",
    "Produk dan Varian",
    "Harga jual",
    "Harga modal",
    "Laba kotor",
    "Potongan voucher",
    "Kode unik",
    "Biaya transaksi",
    "Total bayar",
  ]);
  await expect(barisTabel(page).getByRole("rowheader")).toHaveText([
    terbaru.nomorPesanan,
    dicari.nomorPesanan,
  ]);
  // Pesanan tanpa Harga modal: "—" di Harga modal dan Laba kotor, dan peringatannya tampil.
  await expect(barisTabel(page).first().getByRole("cell").nth(3)).toHaveText(
    "—",
  );
  await expect(barisTabel(page).first().getByRole("cell").nth(4)).toHaveText(
    "—",
  );
  await expect(
    isi(page).getByText(
      "1 Pesanan Selesai belum dihitung labanya, karena Harga modal Varian-nya belum diisi.",
    ),
  ).toBeVisible();
  const pendapatan = await nilaiRincian(page, "Pendapatan").textContent();
  const labaBersih = await nilaiRincian(page, "Laba bersih").textContent();
  expect(pendapatan).toBe("Rp 90.246");

  await page
    .getByLabel("Cari", { exact: true })
    .fill(`EMAIL-A-${akhiran}`.toUpperCase());
  await page.getByRole("button", { name: "Cari", exact: true }).click();

  await expect(barisTabel(page).getByRole("rowheader")).toHaveText([
    dicari.nomorPesanan,
  ]);
  await expect(nilaiRincian(page, "Pendapatan")).toHaveText(pendapatan ?? "");
  await expect(nilaiRincian(page, "Laba bersih")).toHaveText(labaBersih ?? "");

  await page.getByLabel("Cari", { exact: true }).fill(`tidak-ada-${akhiran}`);
  await page.getByRole("button", { name: "Cari", exact: true }).click();

  await expect(
    isi(page).getByText("Tidak ada Pesanan yang cocok dengan pencarian ini."),
  ).toBeVisible();
  await expect(nilaiRincian(page, "Pendapatan")).toHaveText(pendapatan ?? "");

  await page.getByLabel("Cari", { exact: true }).fill("");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  // Ketuk sel Produk dan Varian, bukan Nomor Pesanan, supaya yang diuji adalah barisnya.
  await barisTabel(page)
    .filter({ hasText: dicari.nomorPesanan })
    .getByText(katalog.namaProduk)
    .click();

  await expect(page).toHaveURL(`/admin/pesanan/${dicari.nomorPesanan}`);
});

test("tabel tanpa Pesanan Selesai dalam saringan menampilkan pesan PRD §14.8", async ({
  page,
}) => {
  const katalog = await katalogUji({ awalan: "Kosong" });
  await masukSebagaiAdmin(page);

  await page.goto(`${ALAMAT}?produk=${katalog.produkId}`);

  await expect(
    isi(page).getByText("Belum ada Pesanan Selesai dalam rentang ini."),
  ).toBeVisible();
});
