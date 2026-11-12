import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dan ITEM_STOK_KEY berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk
// ke database app_test dan Item stok-nya dienkripsi dengan kunci uji. Server e2e menjalankan pekerja pg-boss
// (src/instrumentation.ts) dengan email tiruan dari .env.ci (EMAIL_MODE=tiruan). Email tiruan disimpan di
// memori proses server, jadi isi dan alamat tujuan email kirim ulang diuji di
// src/app/admin/(dasbor)/pesanan/aksi.test.ts; di sini yang diuji adalah halaman detail Pesanan beserta
// pekerjaan email yang dijalankan pekerja server.
import { db } from "../src/server/db";
import { riwayatStatusPesanan, varian } from "../src/server/db/schema";
import { pekerjaanEmailPesananSelesai } from "../src/server/pekerjaan-latar";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

const PASSWORD = "sandi-uji-admin-123";

// Produk bertanda [CONTOH] dengan akhiran unik per run. Namanya bukan Netflix, supaya tidak mengubah hasil
// pencarian "netflix" di cari-kategori-beranda.spec.ts yang berjalan bersamaan.
const NAMA_PRODUK = `Detail Pesanan ${randomUUID().slice(0, 8)}`;
const FORMAT = ["Email", "Password", "Profil"];
let varianId = "";

test.beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: NAMA_PRODUK,
    formatItemStok: FORMAT,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
});

// Koneksi database dan pg-boss tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

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

const emailUnik = () => `budi-${randomUUID()}@mail.com`;
const isi = (page: Page) => page.getByRole("main");
/** Panel email dan Produk beserta Varian di detail Pesanan. */
const panelPesanan = (page: Page) =>
  isi(page).getByRole("region", { name: "Pesanan", exact: true });

/** Teks setiap sel sebuah baris tabel, termasuk sel kepala baris. */
const teksSel = (baris: Locator) =>
  baris
    .locator("th, td")
    .evaluateAll((sel) =>
      sel.map((s) => (s.textContent ?? "").replace(/\s+/g, " ").trim()),
    );

/**
 * Pesanan Selesai dengan Item stok Terkirim dan riwayat perubahan status seperti checkout yang dibayar:
 * dibuat oleh Pembeli pukul 23.30 WIB 11 Nov 2026, lalu Selesai lewat kabar pembayaran Qrispy semenit
 * kemudian. Rinciannya contoh PRD §5.5. Isi Item stok seperti di prototipe [CONTOH], dengan kolom Email yang
 * unik, karena Item stok yang sama persis ditolak di Varian yang sama (PRD §4.2).
 */
async function pesananSelesai(email = emailUnik()) {
  const isiItemStok = [
    `miwe.akun-${randomUUID().slice(0, 8)}@contoh.id`,
    "Senja-7419",
    "Profil 3",
  ];
  const dipesan = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    email,
    dibuatPada: new Date("2026-11-11T16:30:00Z"),
    itemStok: {
      status: "Terkirim",
      nilai: isiItemStok,
      formatSaatTerkirim: FORMAT,
    },
  });
  await db.insert(riwayatStatusPesanan).values({
    pesananId: dipesan.id,
    waktu: new Date("2026-11-11T16:31:00Z"),
    status: "Selesai",
    pelaku: "Qrispy",
  });
  return { ...dipesan, email, isiItemStok };
}

/** Status setiap pekerjaan email "Pesanan selesai" Pesanan itu, setelah semuanya dijalankan pekerja server. */
async function harapkanPekerjaanEmailSelesai(
  pesananId: string,
  jumlah: number,
) {
  await expect(async () => {
    const pekerjaan = await pekerjaanEmailPesananSelesai(pesananId);
    expect(pekerjaan.map(({ state }) => state)).toEqual(
      Array.from({ length: jumlah }, () => "completed"),
    );
  }).toPass({ timeout: 30_000, intervals: [1_000] });
}

// UAT-I3 langkah 3, PRD §9.5: detail menampilkan rincian nominal (PRD §5.5), Item stok, dan riwayat perubahan
// status dengan waktu dalam WIB (PRD §9.1), status, dan pelakunya.
test("dari daftar Pesanan, Admin membuka detail Pesanan yang menampilkan rincian nominal, Item stok, dan riwayat perubahan status", async ({
  page,
}) => {
  const dipesan = await pesananSelesai();
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/pesanan?cari=${dipesan.nomorPesanan}`);

  await isi(page).getByRole("link", { name: dipesan.nomorPesanan }).click();

  await expect(page).toHaveURL(`/admin/pesanan/${dipesan.nomorPesanan}`);
  await expect(
    page.getByRole("heading", { level: 1, name: dipesan.nomorPesanan }),
  ).toBeVisible();
  await expect(panelPesanan(page)).toContainText(dipesan.email);
  await expect(panelPesanan(page)).toContainText(`${NAMA_PRODUK} · 1 Bulan`);

  const rincian = isi(page).getByRole("region", { name: "Rincian pembayaran" });
  for (const [label, nilai] of [
    ["Harga jual", "Rp 50.000"],
    ["Potongan voucher", "− Rp 5.000"],
    ["Kode unik", "Rp 123"],
    ["Total bayar", "Rp 45.123"],
  ]) {
    await expect(rincian.getByRole("row", { name: label })).toContainText(
      nilai,
    );
  }

  const itemStok = isi(page).getByRole("region", { name: "Item stok" });
  for (const [i, nama] of FORMAT.entries()) {
    await expect(itemStok.getByText(nama, { exact: true })).toBeVisible();
    await expect(
      itemStok.getByText(dipesan.isiItemStok[i], { exact: true }),
    ).toBeVisible();
  }

  const riwayat = isi(page)
    .getByRole("region", { name: "Riwayat perubahan status" })
    .getByRole("table");
  await expect(riwayat.getByRole("columnheader")).toHaveText([
    "Waktu (WIB)",
    "Status",
    "Pelaku",
  ]);
  const baris = riwayat.getByRole("row");
  await expect(baris).toHaveCount(3);
  expect(await teksSel(baris.nth(1))).toEqual([
    "11 Nov 2026 23.30",
    "Menunggu Pembayaran",
    "Pembeli",
  ]);
  expect(await teksSel(baris.nth(2))).toEqual([
    "11 Nov 2026 23.31",
    "Selesai",
    "Qrispy",
  ]);
});

// UAT-F2, PRD §6.4: kirim ulang, lalu koreksi email menjadi Email B dan kirim ulang. Email yang dikirim pekerja
// server tersimpan di memori server, jadi di sini diperiksa bahwa pekerjaan emailnya selesai dijalankan.
test("Admin mengirim ulang email, lalu mengoreksi email Pesanan dan mengirim ulang; detail dan daftar Pesanan menampilkan email baru", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const dipesan = await pesananSelesai();
  const emailB = emailUnik();
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/pesanan/${dipesan.nomorPesanan}`);

  const kirimUlang = isi(page).getByRole("form", { name: "Kirim ulang email" });
  await kirimUlang.getByRole("button", { name: "Kirim ulang email" }).click();
  await expect(kirimUlang.getByRole("status")).toContainText(
    `Email "Pesanan selesai" sedang dikirim ulang ke ${dipesan.email}.`,
  );
  await harapkanPekerjaanEmailSelesai(dipesan.id, 1);

  const koreksi = isi(page).getByRole("form", { name: "Koreksi email" });
  await expect(koreksi.getByLabel("Email baru")).toHaveValue(dipesan.email);
  await koreksi.getByLabel("Email baru").fill(emailB);
  await koreksi.getByRole("button", { name: "Simpan dan kirim ulang" }).click();
  await expect(koreksi.getByRole("status")).toContainText(
    `Email Pesanan diganti menjadi ${emailB}`,
  );
  await harapkanPekerjaanEmailSelesai(dipesan.id, 2);
  await expect(panelPesanan(page)).toContainText(emailB);
  await expect(panelPesanan(page)).not.toContainText(dipesan.email);

  await page.goto(`/admin/pesanan?cari=${emailB}`);
  const tabel = isi(page).getByRole("table");
  await expect(tabel.getByRole("row")).toHaveCount(2);
  await expect(
    tabel.getByRole("row", { name: new RegExp(dipesan.nomorPesanan) }),
  ).toContainText(emailB);
});

// Issue T25: kirim ulang tidak tersedia untuk Pesanan selain Selesai, dan Item stok hanya tampil bila sudah
// Terkirim. Issue T25-b: email Pesanan Bermasalah bisa dikoreksi, dan koreksinya hanya menyimpan email baru.
test("detail Pesanan Bermasalah menampilkan koreksi email yang hanya menyimpan, tanpa kirim ulang email maupun Item stok", async ({
  page,
}) => {
  const email = emailUnik();
  const bermasalah = await sisipkanPesanan({
    varianId,
    status: "Bermasalah",
    email,
    dibuatPada: new Date("2026-11-11T09:05:00+07:00"),
  });
  await masukSebagaiAdmin(page);

  await page.goto(`/admin/pesanan/${bermasalah.nomorPesanan}`);

  await expect(
    page.getByRole("heading", { level: 1, name: bermasalah.nomorPesanan }),
  ).toBeVisible();
  await expect(
    isi(page).getByRole("region", { name: "Rincian pembayaran" }),
  ).toBeVisible();
  await expect(
    isi(page).getByRole("region", { name: "Riwayat perubahan status" }),
  ).toBeVisible();
  await expect(
    isi(page).getByRole("button", { name: "Kirim ulang email" }),
  ).toHaveCount(0);
  const koreksi = isi(page).getByRole("form", { name: "Koreksi email" });
  await expect(koreksi.getByLabel("Email baru")).toHaveValue(email);
  await expect(
    koreksi.getByRole("button", { name: "Simpan email" }),
  ).toBeVisible();
  await expect(
    isi(page).getByRole("button", { name: "Simpan dan kirim ulang" }),
  ).toHaveCount(0);
  await expect(
    isi(page).getByRole("region", { name: "Item stok" }),
  ).toHaveCount(0);
});

test("Nomor Pesanan yang tidak ada menampilkan halaman tidak ditemukan", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);

  const respons = await page.goto("/admin/pesanan/MIWE-ZZZZZZ");

  expect(respons?.status()).toBe(404);
});

test("Tamu yang membuka detail Pesanan diarahkan ke halaman login", async ({
  page,
}) => {
  const dipesan = await pesananSelesai();

  await page.goto(`/admin/pesanan/${dipesan.nomorPesanan}`);

  await expect(page).toHaveURL("/admin");
  await expect(page.getByText(dipesan.email)).toHaveCount(0);
});

test("di lebar 390 px detail Pesanan tidak membuat halaman bergulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const dipesan = await pesananSelesai();
  await masukSebagaiAdmin(page);

  await page.goto(`/admin/pesanan/${dipesan.nomorPesanan}`);

  await expect(
    isi(page).getByRole("region", { name: "Riwayat perubahan status" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
