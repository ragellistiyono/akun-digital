import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dan ITEM_STOK_KEY berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk
// ke database app_test. Database itu dipakai bersama test lain yang berjalan bersamaan dan bisa berisi
// ribuan Pesanan sisa run sebelumnya, jadi setiap test hanya memeriksa Pesanan miliknya sendiri, yang
// dicari lewat email unik atau Nomor Pesanan-nya.
import { db } from "../src/server/db";
import { pesanan, varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

const PASSWORD = "sandi-uji-admin-123";

// Produk bertanda [CONTOH] dengan akhiran unik per run. Namanya bukan Netflix, supaya tidak mengubah hasil
// pencarian "netflix" di cari-kategori-beranda.spec.ts yang berjalan bersamaan.
const NAMA_PRODUK = `Daftar Pesanan ${randomUUID().slice(0, 8)}`;
let varianId = "";

test.beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: NAMA_PRODUK,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
});

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

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
const tabel = (page: Page) => isi(page).getByRole("table");
const barisPesanan = (page: Page, nomorPesanan: string) =>
  tabel(page).getByRole("row", { name: new RegExp(nomorPesanan) });

/** Teks setiap sel sebuah baris tabel, termasuk sel kepala baris. */
const teksSel = (baris: Locator) =>
  baris
    .locator("th, td")
    .evaluateAll((sel) =>
      sel.map((s) => (s.textContent ?? "").replace(/\s+/g, " ").trim()),
    );

/** Mengisi saringan daftar Pesanan, lalu menekan Saring. */
async function saring(
  page: Page,
  {
    status,
    dari,
    sampai,
    cari,
  }: { status?: string; dari?: string; sampai?: string; cari?: string },
) {
  const form = isi(page).getByRole("search", { name: "Saring Pesanan" });
  if (status) await form.getByLabel("Status").selectOption({ label: status });
  if (dari) await form.getByLabel("Dari tanggal").fill(dari);
  if (sampai) await form.getByLabel("Sampai tanggal").fill(sampai);
  if (cari) await form.getByLabel("Cari").fill(cari);
  await form.getByRole("button", { name: "Saring" }).click();
}

// UAT-I3, PRD §9.5: kolom daftar Pesanan, dengan waktu dibuat dalam WIB (PRD §9.1) dan tanda "Email gagal"
// (PRD §6.4). Rincian sisipkanPesanan adalah contoh PRD §5.5, jadi Total bayarnya Rp 45.123.
test("daftar Pesanan menampilkan Nomor Pesanan, waktu dibuat dalam WIB, email, Produk dan Varian, Total bayar, pil status, dan tanda Email gagal", async ({
  page,
}) => {
  const email = emailUnik();
  const emailGagal = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    email,
    dibuatPada: new Date("2026-11-11T16:30:00Z"),
    emailGagal: true,
  });
  const emailTerkirim = await sisipkanPesanan({
    varianId,
    status: "Bermasalah",
    email,
    dibuatPada: new Date("2026-11-11T09:05:00+07:00"),
  });
  await masukSebagaiAdmin(page);

  await page.goto("/admin/pesanan");
  await expect(
    page.getByRole("heading", { level: 1, name: "Pesanan" }),
  ).toBeVisible();
  await saring(page, { cari: email });

  await expect(tabel(page).getByRole("columnheader")).toHaveText([
    "Nomor Pesanan",
    "Waktu dibuat (WIB)",
    "Email",
    "Produk dan Varian",
    "Total bayar",
    "Status",
  ]);
  // Yang terbaru dibuat di atas.
  await expect(tabel(page).getByRole("row")).toHaveCount(3);
  await expect(tabel(page).getByRole("row").nth(1)).toContainText(
    emailGagal.nomorPesanan,
  );
  expect(await teksSel(barisPesanan(page, emailGagal.nomorPesanan))).toEqual([
    emailGagal.nomorPesanan,
    "11 Nov 2026 23.30",
    email,
    `${NAMA_PRODUK} · 1 Bulan`,
    "Rp 45.123",
    "Selesai Email gagal",
  ]);
  expect(await teksSel(barisPesanan(page, emailTerkirim.nomorPesanan))).toEqual(
    [
      emailTerkirim.nomorPesanan,
      "11 Nov 2026 09.05",
      email,
      `${NAMA_PRODUK} · 1 Bulan`,
      "Rp 45.123",
      "Bermasalah",
    ],
  );
});

// UAT-I3 langkah 2, PRD §7.4 dan tests/golden/kesamaan-email.json: email dicari tanpa membedakan huruf
// besar dan kecil, dan Nomor Pesanan menemukan tepat Pesanan itu.
test('mencari "BUDI@mail.com" menemukan Pesanan budi@mail.com, dan mencari Nomor Pesanan menemukan tepat Pesanan itu', async ({
  page,
}) => {
  const akhiran = randomUUID();
  const budi = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    email: `budi+${akhiran}@mail.com`,
  });
  const lain = await sisipkanPesanan({ varianId, status: "Selesai" });
  await masukSebagaiAdmin(page);
  await page.goto("/admin/pesanan");

  await saring(page, { cari: `BUDI+${akhiran.toUpperCase()}@mail.com` });
  await expect(tabel(page).getByRole("row")).toHaveCount(2);
  await expect(barisPesanan(page, budi.nomorPesanan)).toBeVisible();
  // Isian Cari tetap berisi teks yang dicari.
  await expect(isi(page).getByLabel("Cari")).toHaveValue(
    `BUDI+${akhiran.toUpperCase()}@mail.com`,
  );

  await isi(page).getByLabel("Cari").clear();
  await saring(page, { cari: lain.nomorPesanan });
  await expect(tabel(page).getByRole("row")).toHaveCount(2);
  await expect(barisPesanan(page, lain.nomorPesanan)).toBeVisible();
});

// PRD §9.1, §9.5: status Selesai dengan tanggal 11 Nov 2026 memuat Pesanan pukul 23.30 WIB (16.30 UTC),
// tetapi tidak memuat Pesanan pukul 00.30 WIB keesokan harinya maupun Pesanan Bermasalah hari itu.
test("saringan status Selesai dan tanggal hanya menampilkan Pesanan Selesai yang dibuat pada tanggal itu menurut WIB", async ({
  page,
}) => {
  const email = emailUnik();
  const pukul2330Wib = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    email,
    dibuatPada: new Date("2026-11-11T16:30:00Z"),
  });
  const besokPukul0030Wib = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    email,
    dibuatPada: new Date("2026-11-12T00:30:00+07:00"),
  });
  const bermasalah = await sisipkanPesanan({
    varianId,
    status: "Bermasalah",
    email,
    dibuatPada: new Date("2026-11-11T12:00:00+07:00"),
  });
  await masukSebagaiAdmin(page);
  await page.goto("/admin/pesanan");

  await saring(page, {
    status: "Selesai",
    dari: "2026-11-11",
    sampai: "2026-11-11",
    cari: email,
  });

  await expect(barisPesanan(page, pukul2330Wib.nomorPesanan)).toBeVisible();
  await expect(tabel(page).getByRole("row")).toHaveCount(2);
  await expect(barisPesanan(page, besokPukul0030Wib.nomorPesanan)).toHaveCount(
    0,
  );
  await expect(barisPesanan(page, bermasalah.nomorPesanan)).toHaveCount(0);
  // Saringan yang dipakai tetap terisi di form.
  await expect(isi(page).getByLabel("Status")).toHaveValue("Selesai");
  await expect(isi(page).getByLabel("Dari tanggal")).toHaveValue("2026-11-11");
  await expect(isi(page).getByLabel("Sampai tanggal")).toHaveValue(
    "2026-11-11",
  );
});

/** Jumlah Pesanan Bermasalah di menu Pesanan. Menu tanpa angka berarti tidak ada Pesanan Bermasalah. */
async function jumlahBermasalahDiMenu(page: Page) {
  const tautan = page
    .getByRole("navigation", { name: "Menu admin" })
    .getByRole("link", { name: /^Pesanan/ });
  await expect(tautan).toBeVisible();
  const cocok = /(\d+) Pesanan Bermasalah/.exec(
    (await tautan.textContent()) ?? "",
  );
  return cocok ? Number(cocok[1]) : 0;
}

// PRD §5.9: Pesanan Bermasalah tampil menonjol. Jumlahnya dihitung dari semua Pesanan, dan test lain yang
// berjalan bersamaan bisa membuat Pesanan Bermasalah di sela kedua bacaan, jadi bagian itu diulang bila
// angkanya terganggu.
test("menu Pesanan menampilkan jumlah Pesanan Bermasalah, yang berkurang setelah satu Pesanan Bermasalah berpindah status", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);

  await expect(async () => {
    const { id } = await sisipkanPesanan({ varianId, status: "Bermasalah" });
    await page.goto("/admin/pesanan");
    const sebelum = await jumlahBermasalahDiMenu(page);
    expect(sebelum).toBeGreaterThanOrEqual(1);

    await db
      .update(pesanan)
      .set({ status: "Dana Dikembalikan" })
      .where(eq(pesanan.id, id));
    await page.reload();

    expect(await jumlahBermasalahDiMenu(page)).toBe(sebelum - 1);
  }).toPass({ timeout: 30_000 });
});

test("pintasan Pesanan Bermasalah menyaring daftar menjadi Pesanan Bermasalah saja", async ({
  page,
}) => {
  const bermasalah = await sisipkanPesanan({
    varianId,
    status: "Bermasalah",
    dibuatPada: new Date(),
  });
  await masukSebagaiAdmin(page);
  await page.goto("/admin/pesanan");

  await isi(page).getByRole("link", { name: "Pesanan Bermasalah" }).click();

  await expect(page).toHaveURL("/admin/pesanan?status=Bermasalah");
  await expect(isi(page).getByLabel("Status")).toHaveValue("Bermasalah");
  const kolomStatus = tabel(page).locator("tbody tr td:last-child");
  await expect(kolomStatus.first()).toBeVisible();
  for (const teks of await kolomStatus.allTextContents()) {
    expect(teks).toContain("Bermasalah");
  }
  // Pesanan Bermasalah yang baru dibuat ada di halaman pertama, karena yang terbaru di atas.
  await expect(barisPesanan(page, bermasalah.nomorPesanan)).toBeVisible();
});

test("di lebar 390 px daftar Pesanan tidak membuat halaman bergulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await masukSebagaiAdmin(page);

  await page.goto("/admin/pesanan");

  await expect(tabel(page)).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
