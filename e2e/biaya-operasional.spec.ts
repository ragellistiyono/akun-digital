import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi biaya ini masuk ke database app_test.
import { tambahBiayaOperasional } from "../src/server/biaya-operasional";
import { tanggalIsianWib } from "../src/server/zona-waktu-toko";

// Halaman Biaya operasional di bawah Laporan keuangan (T69, PRD §14.4, UAT-N5). Test di berkas ini berjalan
// berurutan, dan tidak ada berkas e2e lain yang mencatat Biaya operasional, jadi selisih total bulan ini hanya
// berasal dari test yang sedang berjalan.
// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.
const PASSWORD = "sandi-uji-admin-123";
const ALAMAT = "/admin/laporan/biaya-operasional";

const hariIni = tanggalIsianWib(new Date());
const bulanIni = hariIni.slice(0, 7);

/** Tanggal "YYYY-MM-DD" yang bergeser `hari` hari dan `bulan` bulan dari hari ini. */
function tanggalGeser({
  hari = 0,
  bulan = 0,
}: {
  hari?: number;
  bulan?: number;
}) {
  const [t, b, h] = hariIni.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1 + bulan, bulan === 0 ? h + hari : 1))
    .toISOString()
    .slice(0, 10);
}

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

const keteranganUnik = (keterangan: string) =>
  `${keterangan} ${randomUUID().slice(0, 8)}`;

/** Total Biaya operasional bulan yang tampil, dalam rupiah. */
async function totalTampil(page: Page) {
  const teks = await isi(page)
    .getByRole("region", { name: /^Total Biaya operasional/ })
    .locator("p")
    .innerText();
  return Number(teks.replace(/\D/g, ""));
}

/** Baris data daftar biaya, tanpa baris judul kolom. */
const barisBiaya = (page: Page) =>
  isi(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader") });

const barisBerketerangan = (page: Page, keterangan: string) =>
  barisBiaya(page).filter({
    has: page.getByRole("rowheader", { name: keterangan, exact: true }),
  });

/** Isian dengan label itu beserta pesan di bawahnya. */
async function harapGalat(page: Page, label: string, pesan: string) {
  const isian = page.getByLabel(label, { exact: true });
  await expect(isian).toHaveAttribute("aria-invalid", "true");
  await expect(isian).toHaveAccessibleDescription(pesan);
}

// UAT-N5 langkah 2 dan 3.
test("Admin menambah biaya hari ini Rp 10.000, yang tampil paling atas di bulan berjalan dan menambah totalnya Rp 10.000; tanggal besok, keterangan kosong atau 101 karakter, dan nominal 0 ditolak di isiannya", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await page.goto(ALAMAT);
  await expect(
    page.getByRole("heading", { level: 1, name: "Biaya operasional" }),
  ).toBeVisible();
  await expect(page.getByLabel("Bulan")).toHaveValue(bulanIni);
  const totalAwal = await totalTampil(page);

  await isi(page).getByRole("link", { name: "Tambah biaya" }).click();
  await expect(page).toHaveURL(`${ALAMAT}/baru`);
  await expect(page.getByLabel("Tanggal")).toHaveValue(hariIni);
  const keterangan = keteranganUnik("Uji biaya");
  await page.getByLabel("Keterangan").fill(keterangan);
  await page.getByLabel("Nominal").fill("10000");
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(page).toHaveURL(`${ALAMAT}?bulan=${bulanIni}`);
  await expect(barisBiaya(page).first()).toContainText(keterangan);
  await expect(barisBiaya(page).first()).toContainText("Rp 10.000");
  expect(await totalTampil(page)).toBe(totalAwal + 10000);

  // Langkah 3: setiap isian ditolak dengan pesan di bawahnya, dan biayanya tidak dicatat.
  await page.goto(`${ALAMAT}/baru`);
  await page.getByLabel("Tanggal").fill(tanggalGeser({ hari: 1 }));
  await page.getByLabel("Keterangan").fill("   ");
  await page.getByLabel("Nominal").fill("0");
  await page.getByRole("button", { name: "Simpan" }).click();
  await harapGalat(
    page,
    "Tanggal",
    "Tanggal ini belum terjadi. Pilih tanggal paling lambat hari ini, dan periksa juga tahunnya.",
  );
  await harapGalat(
    page,
    "Keterangan",
    "Keterangan belum diisi. Ketik untuk apa biaya ini, misalnya Sewa server November.",
  );
  await harapGalat(
    page,
    "Nominal",
    "Nominal kurang dari Rp 1. Isi nominal minimal Rp 1.",
  );

  await page.getByLabel("Tanggal").fill(hariIni);
  await page.getByLabel("Keterangan").fill("x".repeat(101));
  await page.getByLabel("Nominal").fill("10000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await harapGalat(
    page,
    "Keterangan",
    "Keterangan lebih dari 100 karakter. Persingkat menjadi paling banyak 100 karakter.",
  );
  await expect(page).toHaveURL(`${ALAMAT}/baru`);

  await page.goto(ALAMAT);
  expect(await totalTampil(page)).toBe(totalAwal + 10000);
});

// UAT-N5 langkah 5.
test("mengubah nominal memperbarui total, dan menghapus biaya meminta persetujuan di Modal penegasan lebih dulu", async ({
  page,
}) => {
  const keterangan = keteranganUnik("Uji biaya");
  await tambahBiayaOperasional({
    tanggal: hariIni,
    keterangan,
    nominal: 10000,
  });
  await masukSebagaiAdmin(page);
  await page.goto(ALAMAT);
  const totalAwal = await totalTampil(page);

  await barisBerketerangan(page, keterangan)
    .getByRole("link", { name: `Ubah ${keterangan}` })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ubah Biaya operasional" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nominal")).toHaveValue("10.000");
  await page.getByLabel("Nominal").fill("12000");
  await page.getByRole("button", { name: "Simpan" }).click();

  // Menyimpan form langsung berjalan tanpa Modal penegasan (PRD §9.10).
  await expect(page).toHaveURL(`${ALAMAT}?bulan=${bulanIni}`);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(barisBerketerangan(page, keterangan)).toContainText("Rp 12.000");
  expect(await totalTampil(page)).toBe(totalAwal + 2000);

  await barisBerketerangan(page, keterangan)
    .getByRole("link", { name: `Ubah ${keterangan}` })
    .click();
  const nama = `Biaya operasional "${keterangan}"`;
  await page.getByRole("button", { name: "Hapus Biaya operasional" }).click();
  // Belum terhapus: Modal penegasan menyebut akibatnya lebih dulu (PRD §9.10).
  const modal = page.getByRole("alertdialog", {
    name: "Hapus Biaya operasional?",
  });
  await expect(modal).toContainText(
    `Hapus ${nama}? Biaya ini terhapus dan tidak bisa dikembalikan.`,
  );
  await modal.getByRole("button", { name: "Batal" }).click();
  await expect(modal).toHaveCount(0);
  await page.goto(ALAMAT);
  await expect(barisBerketerangan(page, keterangan)).toHaveCount(1);

  await barisBerketerangan(page, keterangan)
    .getByRole("link", { name: `Ubah ${keterangan}` })
    .click();
  await page.getByRole("button", { name: "Hapus Biaya operasional" }).click();
  await modal.getByRole("button", { name: `Ya, hapus ${nama}` }).click();

  await expect(page).toHaveURL(`${ALAMAT}?bulan=${bulanIni}`);
  await expect(barisBerketerangan(page, keterangan)).toHaveCount(0);
  expect(await totalTampil(page)).toBe(totalAwal - 10000);
});

test("memilih bulan lalu hanya menampilkan biaya bertanggal bulan lalu beserta totalnya", async ({
  page,
}) => {
  const bulanLalu = tanggalGeser({ bulan: -1 }).slice(0, 7);
  const biayaBulanLalu = keteranganUnik("Iklan Instagram");
  await tambahBiayaOperasional({
    tanggal: `${bulanLalu}-01`,
    keterangan: biayaBulanLalu,
    nominal: 75000,
  });
  const biayaBulanIni = keteranganUnik("Domain toko");
  await tambahBiayaOperasional({
    tanggal: hariIni,
    keterangan: biayaBulanIni,
    nominal: 200000,
  });
  await masukSebagaiAdmin(page);
  await page.goto(ALAMAT);

  await page.getByLabel("Bulan").selectOption(bulanLalu);
  await page.getByRole("button", { name: "Tampilkan" }).click();

  await expect(page).toHaveURL(`${ALAMAT}?bulan=${bulanLalu}`);
  await expect(barisBerketerangan(page, biayaBulanLalu)).toHaveCount(1);
  await expect(barisBerketerangan(page, biayaBulanIni)).toHaveCount(0);
  expect(await totalTampil(page)).toBe(75000);
});

test("Tamu yang membuka halaman Biaya operasional, form tambah, atau form ubah diarahkan ke halaman login admin", async ({
  page,
}) => {
  const { id } = await tambahBiayaOperasional({
    tanggal: hariIni,
    keterangan: keteranganUnik("Biaya tamu"),
    nominal: 1,
  });
  for (const alamat of [ALAMAT, `${ALAMAT}/baru`, `${ALAMAT}/${id}`]) {
    await page.goto(alamat);
    await expect(page).toHaveURL("/admin");
  }
});

test("menu samping dan Ringkasan belum menaut ke halaman Biaya operasional", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await expect(
    page.getByRole("navigation", { name: "Menu admin" }),
  ).toBeVisible();
  await expect(page.locator(`a[href^="${ALAMAT}"]`)).toHaveCount(0);
});
