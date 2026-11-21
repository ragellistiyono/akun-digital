import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test, yang
// dipakai bersama test lain yang berjalan bersamaan. Karena itu angka yang dibandingkan selalu disaring ke
// Kategori milik test itu sendiri. Berkas ini tidak mencatat Biaya operasional, supaya total bulan di
// biaya-operasional.spec.ts tidak terganggu.
import { db } from "../src/server/db";
import { user, varian } from "../src/server/db/schema";
import { sisipkanKategori, sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";
import { sisipkanPesanan } from "../src/server/uji-pesanan";
import { sisipkanTopUp } from "../src/server/uji-top-up";
import { tanggalIsianWib, tanggalWib } from "../src/server/zona-waktu-toko";

// Laporan keuangan (T71, T72, T73, T81, PRD §11.1, §14.5, §14.6, §14.7, §14.8, §15.8, UAT-N6, UAT-N7, UAT-N8, UAT-O9).
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

/** Baris rincian angka berlabel tepat itu. */
const barisRincian = (page: Page, label: string) =>
  isi(page)
    .getByRole("table", { name: "Rincian angka" })
    .getByRole("row")
    .filter({
      has: page.getByRole("rowheader", { name: label, exact: true }),
    });

/** Nominal baris rincian angka berlabel itu, sebagai teks. */
const nilaiRincian = (page: Page, label: string) =>
  barisRincian(page, label).getByRole("cell");

/** Baris data tabel Pesanan Selesai, tanpa baris judul kolom. */
const barisTabel = (page: Page) =>
  isi(page)
    .getByRole("table", { name: "Pesanan Selesai", exact: true })
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader") });

const KETERANGAN_BIAYA_OPERASIONAL =
  "Laba bersih ini belum dikurangi Biaya operasional dan Top up, karena saringan Produk, Kategori, atau Metode sedang aktif.";

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
      .getByLabel("Produk", { exact: true })
      .getByRole("option", { name: `${nonaktif.namaProduk} (nonaktif)` }),
  ).toHaveCount(1);

  await page.getByLabel("Kategori", { exact: true }).selectOption({
    label: streaming.namaKategori,
  });

  const opsiProduk = page
    .getByLabel("Produk", { exact: true })
    .getByRole("option");
  await expect(opsiProduk).toHaveText(["Semua", streaming.namaProduk]);

  await page.getByRole("button", { name: "Tampilkan" }).click();

  await expect(page).toHaveURL(new RegExp(`kategori=${streaming.kategoriId}`));
  await expect(isi(page).getByRole("note")).toHaveText(
    KETERANGAN_BIAYA_OPERASIONAL,
  );
  await expect(barisRincian(page, "− Biaya operasional")).toHaveCount(0);

  // Produk tanpa Kategori.
  await page
    .getByLabel("Kategori", { exact: true })
    .selectOption({ label: "Semua" });
  await page
    .getByLabel("Produk", { exact: true })
    .selectOption({ label: lain.namaProduk });
  await page.getByRole("button", { name: "Tampilkan" }).click();

  await expect(page).toHaveURL(new RegExp(`produk=${lain.produkId}`));
  await expect(page.getByLabel("Produk", { exact: true })).toHaveValue(
    lain.produkId,
  );
  await expect(isi(page).getByRole("note")).toHaveText(
    KETERANGAN_BIAYA_OPERASIONAL,
  );
  await expect(barisRincian(page, "− Biaya operasional")).toHaveCount(0);
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

  await page.goto(`${ALAMAT}?kategori=${katalog.kategoriId}`);

  // Kolom PRD §14.8 dan Metode (§14.6 ▶ Keputusan 2026-11-20), dengan Pesanan terbaru dibayar di atas.
  await expect(
    isi(page)
      .getByRole("table", { name: "Pesanan Selesai", exact: true })
      .getByRole("columnheader"),
  ).toHaveText([
    "Nomor Pesanan",
    "Waktu bayar (WIB)",
    "Metode",
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
  await expect(barisTabel(page).first().getByRole("cell").nth(1)).toHaveText(
    "QRIS",
  );
  await expect(barisTabel(page).first().getByRole("cell").nth(4)).toHaveText(
    "—",
  );
  await expect(barisTabel(page).first().getByRole("cell").nth(5)).toHaveText(
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
    isi(page)
      .getByRole("region", { name: "Pesanan Selesai" })
      .getByText("Belum ada Pesanan Selesai dalam rentang ini."),
  ).toBeVisible();
});

/** Grafik berjudul itu (PRD §14.7). */
const grafik = (page: Page, judul: string) =>
  isi(page).getByRole("figure", { name: judul, exact: true });

test("mengetuk batang atau titik grafik menampilkan label kelompok dan nilainya, dan hari tanpa Pesanan Selesai bernilai 0 (UAT-N7)", async ({
  page,
}) => {
  const katalog = await katalogUji({ awalan: "Grafik" });
  const waktuBayar = new Date(Date.now() - 60 * 1000);
  // Rincian contoh PRD §5.5 dari sisipkanPesanan: Total bayar Rp 45.123, potongan voucher Rp 5.000, dan Kode
  // unik Rp 123. Dengan Harga modal Rp 35.000, Laba kotor Rp 15.000 dan Laba bersih Rp 10.123 (saringan Kategori
  // aktif, jadi Biaya operasional tidak dikurangkan).
  await sisipkanPesanan({
    varianId: katalog.varianId,
    status: "Selesai",
    hargaModal: 35000,
    biayaTransaksi: 0,
    waktuBayar,
  });
  const hariBayar = tanggalWib(waktuBayar);
  const hariSebelumnya = tanggalWib(
    new Date(waktuBayar.getTime() - 24 * 60 * 60 * 1000),
  );
  await masukSebagaiAdmin(page);

  await page.goto(`${ALAMAT}?kategori=${katalog.kategoriId}`);

  const pendapatan = grafik(page, "Pendapatan");
  await pendapatan
    .getByRole("button", { name: `${hariBayar} · Rp 45.123`, exact: true })
    .click();
  await expect(pendapatan.getByRole("status")).toHaveText(
    `${hariBayar} · Rp 45.123`,
  );

  const laba = grafik(page, "Laba kotor dan Laba bersih");
  await laba
    .getByRole("button", {
      name: `${hariBayar} · Laba bersih Rp 10.123`,
      exact: true,
    })
    .click();
  await expect(laba.getByRole("status")).toHaveText(
    `${hariBayar} · Laba bersih Rp 10.123`,
  );

  const jumlah = grafik(page, "Jumlah Pesanan Selesai");
  await jumlah
    .getByRole("button", { name: `${hariBayar} · 1`, exact: true })
    .click();
  await expect(jumlah.getByRole("status")).toHaveText(`${hariBayar} · 1`);
  await jumlah
    .getByRole("button", { name: `${hariSebelumnya} · 0`, exact: true })
    .click();
  await expect(jumlah.getByRole("status")).toHaveText(`${hariSebelumnya} · 0`);
});

test("di lebar 360 px, grafik 30 hari bergulir di dalam kartunya dan halaman tidak bergulir ke samping (PRD §11.1, UAT-N7)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await masukSebagaiAdmin(page);

  await page.goto(ALAMAT);

  const pendapatan = grafik(page, "Pendapatan");
  await expect(pendapatan.getByRole("button")).toHaveCount(30);
  // Wadah gulir grafik lebih sempit dari isinya, jadi grafik bergulir di dalam kartu.
  const bergulirDiKartu = await pendapatan
    .getByRole("group", { name: "Grafik Pendapatan" })
    .evaluate((svg) => {
      const wadah = svg.closest(".overflow-x-auto");
      return wadah !== null && wadah.scrollWidth > wadah.clientWidth;
    });
  expect(bergulirDiKartu).toBe(true);
  const lebarHalaman = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(lebarHalaman).toBeLessThanOrEqual(360);
});

// PRD §11.1 ▶ Keputusan 2026-11-20 dan UAT-N6 langkah 1: "Laporan keuangan" tepat di bawah Ringkasan di menu samping.
test("menu samping menampilkan Laporan keuangan tepat di bawah Ringkasan, dan mengetuknya membuka Laporan keuangan", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await masukSebagaiAdmin(page);

  const menu = page.getByRole("navigation", { name: "Menu admin" });
  const tautan = await menu.getByRole("link").allTextContents();
  expect(tautan.slice(0, 2).map((t) => t.trim())).toEqual([
    "Ringkasan",
    "Laporan keuangan",
  ]);

  await menu.getByRole("link", { name: "Laporan keuangan" }).click();
  await expect(page).toHaveURL(ALAMAT);
  await expect(
    page.getByRole("heading", { level: 1, name: "Laporan keuangan" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("link", { name: "Laporan keuangan" }),
  ).toHaveAttribute("aria-current", "page");
});

// PRD §14.7 grafik 4 dan 5, UAT-N7: Produk terlaris urut jumlah Pesanan Selesai dengan Pendapatan di sebelahnya,
// dan Pendapatan per Kategori. Di lebar 360 px halaman tidak bergulir ke samping, juga dengan nama Produk panjang.
test("di lebar 360 px, Produk terlaris dan Pendapatan per Kategori tampil dengan nilainya tanpa halaman bergulir ke samping (UAT-N7)", async ({
  page,
}) => {
  const katalog = await katalogUji({ awalan: "Terlaris" });
  const akhiran = randomUUID().slice(0, 8);
  const namaPanjang = `Produk dengan nama yang sangat panjang sekali ${akhiran}`;
  const produkPanjang = await sisipkanProduk({
    nama: namaPanjang,
    kategoriId: katalog.kategoriId,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  const [{ id: varianPanjang }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkPanjang));
  const sekarang = Date.now();
  // Produk pertama: 2 Pesanan Selesai Rp 45.123 (rincian contoh PRD §5.5). Produk bernama panjang: 1 Pesanan.
  for (const [varianId, menit] of [
    [katalog.varianId, 3],
    [katalog.varianId, 2],
    [varianPanjang, 1],
  ] as const) {
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      biayaTransaksi: 0,
      waktuBayar: new Date(sekarang - menit * 60 * 1000),
    });
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await masukSebagaiAdmin(page);

  await page.goto(`${ALAMAT}?kategori=${katalog.kategoriId}`);

  const terlaris = grafik(page, "Produk terlaris");
  const baris = terlaris
    .getByRole("list", { name: "Grafik Produk terlaris" })
    .getByRole("button");
  await expect(baris).toHaveCount(2);
  await expect(baris.nth(0)).toHaveAccessibleName(
    `${katalog.namaProduk} · 2 Pesanan · Rp 90.246`,
  );
  await expect(baris.nth(1)).toHaveAccessibleName(
    `${namaPanjang} · 1 Pesanan · Rp 45.123`,
  );
  await baris.nth(1).click();
  await expect(terlaris.getByRole("status")).toHaveText(
    `${namaPanjang} · 1 Pesanan · Rp 45.123`,
  );

  const perKategori = grafik(page, "Pendapatan per Kategori")
    .getByRole("list", { name: "Grafik Pendapatan per Kategori" })
    .getByRole("button");
  await expect(perKategori).toHaveCount(1);
  await expect(perKategori).toHaveAccessibleName(
    `${katalog.namaKategori} · 3 Pesanan · Rp 135.369`,
  );

  const lebarHalaman = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(lebarHalaman).toBeLessThanOrEqual(360);
});

/** Label baris rincian angka, dari atas ke bawah. */
const labelRincian = (page: Page) =>
  isi(page)
    .getByRole("table", { name: "Rincian angka" })
    .getByRole("rowheader");

/** Teks kolom Metode semua baris tabel Pesanan Selesai. */
const metodeTabel = (page: Page) =>
  barisTabel(page)
    .locator("td:nth-of-type(2)")
    .evaluateAll((sel) => sel.map((s) => (s.textContent ?? "").trim()));

const BARIS_INFORMASI_TOP_UP =
  /^Top up Berhasil: \d+, Rp \d[\d.]* \(uang Member, bukan Pendapatan\)$/;

// UAT-O9 dan PRD §14.6 ▶ Keputusan 2026-11-20 (#226): rincian angka memuat baris Top up dan baris informasi Top up
// Berhasil. Saringan Metode Saldo dan QRIS membatasi tabel ke Pesanan bermetode itu, dan menghilangkan baris
// Biaya operasional serta Top up dengan keterangan baru; saringan Produk dengan Metode Semua memberi keterangan yang
// sama.
test("saringan Metode membatasi tabel ke Pesanan bermetode itu dan menghilangkan baris Biaya operasional dan Top up (UAT-O9)", async ({
  page,
}) => {
  const katalog = await katalogUji({ awalan: "Metode" });
  const sekarang = Date.now();
  const qris = await sisipkanPesanan({
    varianId: katalog.varianId,
    status: "Selesai",
    hargaModal: 35000,
    biayaTransaksi: 0,
    waktuBayar: new Date(sekarang - 2 * 60 * 1000),
  });
  const saldo = await sisipkanPesanan({
    varianId: katalog.varianId,
    status: "Selesai",
    metode: "Saldo",
    rincian: {
      hargaJual: 50000,
      potonganVoucher: 0,
      kodeUnik: 0,
      totalBayar: 50000,
    },
    hargaModal: 35000,
    biayaTransaksi: 0,
    waktuBayar: new Date(sekarang - 60 * 1000),
  });
  const email = `laporan-top-up-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  const [{ id: userId }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  // Top up Berhasil contoh PRD §15.8.
  await sisipkanTopUp({
    userId,
    status: "Berhasil",
    nominalTopUp: 150000,
    kodeUnik: 200,
    biayaTransaksi: 1052,
    waktuBayar: new Date(sekarang - 3 * 60 * 1000),
  });
  await masukSebagaiAdmin(page);

  // Langkah 1: tanpa saringan.
  await page.goto(ALAMAT);
  await expect(labelRincian(page)).toHaveText([
    "Pendapatan",
    "Pesanan Selesai",
    "Total Harga modal",
    "Laba kotor",
    "− Potongan voucher",
    "+ Kode unik",
    "− Biaya transaksi",
    "− Biaya operasional",
    "+ Kode unik Top up",
    "− Biaya transaksi Top up",
    "Laba bersih",
  ]);
  await expect(
    isi(page)
      .getByRole("table", { name: "Rincian angka" })
      .getByText(BARIS_INFORMASI_TOP_UP),
  ).toBeVisible();
  await expect(isi(page).getByText(KETERANGAN_BIAYA_OPERASIONAL)).toHaveCount(
    0,
  );

  // Langkah 2: Metode Saldo, lalu QRIS.
  for (const [metode, pesananMetode] of [
    ["Saldo", saldo],
    ["QRIS", qris],
  ] as const) {
    await page.getByLabel("Metode", { exact: true }).selectOption(metode);
    await page.getByRole("button", { name: "Tampilkan" }).click();

    await expect(page).toHaveURL(new RegExp(`metode=${metode}`));
    await expect(page.getByLabel("Metode", { exact: true })).toHaveValue(
      metode,
    );
    // Test lain bisa menambah Pesanan tanpa Harga modal, jadi catatan peringatannya boleh ikut tampil.
    await expect(
      isi(page)
        .getByRole("note")
        .filter({ hasText: KETERANGAN_BIAYA_OPERASIONAL }),
    ).toHaveCount(1);
    await expect(labelRincian(page)).toHaveText([
      "Pendapatan",
      "Pesanan Selesai",
      "Total Harga modal",
      "Laba kotor",
      "− Potongan voucher",
      "+ Kode unik",
      "− Biaya transaksi",
      "Laba bersih",
    ]);
    await expect(
      isi(page)
        .getByRole("table", { name: "Rincian angka" })
        .getByText(BARIS_INFORMASI_TOP_UP),
    ).toHaveCount(0);
    await expect(
      barisTabel(page).filter({ hasText: pesananMetode.nomorPesanan }),
    ).toHaveCount(1);
    expect(new Set(await metodeTabel(page))).toEqual(new Set([metode]));
  }

  // Langkah 3: Metode Semua dengan saringan Produk.
  await page.getByLabel("Metode", { exact: true }).selectOption("");
  await page
    .getByLabel("Produk", { exact: true })
    .selectOption({ label: katalog.namaProduk });
  await page.getByRole("button", { name: "Tampilkan" }).click();

  await expect(page).toHaveURL(new RegExp(`produk=${katalog.produkId}`));
  await expect(page.getByLabel("Metode", { exact: true })).toHaveValue("");
  await expect(isi(page).getByRole("note")).toHaveText(
    KETERANGAN_BIAYA_OPERASIONAL,
  );
  await expect(barisRincian(page, "+ Kode unik Top up")).toHaveCount(0);
  await expect(barisTabel(page).getByRole("rowheader")).toHaveText([
    saldo.nomorPesanan,
    qris.nomorPesanan,
  ]);
  expect(await metodeTabel(page)).toEqual(["Saldo", "QRIS"]);
});
