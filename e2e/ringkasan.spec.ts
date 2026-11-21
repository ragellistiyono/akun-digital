import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { and, count, eq, isNotNull, isNull, ne } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test, yang
// dipakai bersama test lain yang berjalan bersamaan.
import { db } from "../src/server/db";
import { pesanan, topUp, user, varian } from "../src/server/db/schema";
import { jumlahPesananBermasalah } from "../src/server/daftar-pesanan";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";
import { sisipkanPesanan } from "../src/server/uji-pesanan";
import { sisipkanTopUp } from "../src/server/uji-top-up";

const PASSWORD = "sandi-uji-admin-123";

// Produk [CONTOH] dengan akhiran unik per run.
let produkId = "";
let varianId = "";

test.beforeAll(async () => {
  produkId = await sisipkanProduk({
    nama: `Ringkasan ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 5 }],
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

const kartuBermasalah = (page: Page) =>
  page.getByRole("article", { name: "Pesanan Bermasalah" });

// UAT-I1 dan PRD §9.2 (▶ Keputusan 2026-11-17): kartu Pesanan Bermasalah menampilkan jumlah Pesanan
// Bermasalah saat ini dan membuka daftar Pesanan yang tersaring Bermasalah. Test lain yang berjalan bersamaan
// bisa mengubah jumlah itu di sela bacaan, jadi kartu hanya dibandingkan saat jumlah di database sama sebelum
// dan sesudah halaman dimuat, dan bagian itu diulang bila angkanya terganggu.
test("kartu Pesanan Bermasalah menampilkan jumlah Pesanan Bermasalah saat ini, dan mengetuknya membuka daftar Pesanan yang tersaring Bermasalah", async ({
  page,
}) => {
  const bermasalah = await sisipkanPesanan({
    varianId,
    status: "Bermasalah",
    dibuatPada: new Date(),
  });
  await masukSebagaiAdmin(page);

  await expect(async () => {
    const sebelum = await jumlahPesananBermasalah();
    await page.goto("/admin/ringkasan");
    const diKartu = await kartuBermasalah(page)
      .getByText(/^\d+$/)
      .textContent();
    const sesudah = await jumlahPesananBermasalah();

    expect(sesudah).toBe(sebelum);
    expect(Number(diKartu)).toBe(sebelum);
    expect(sebelum).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 30_000 });

  await kartuBermasalah(page).getByRole("link").click();

  await expect(page).toHaveURL("/admin/pesanan?status=Bermasalah");
  await expect(page.getByRole("main").getByLabel("Status")).toHaveValue(
    "Bermasalah",
  );
  await expect(
    page
      .getByRole("main")
      .getByRole("row", { name: new RegExp(bermasalah.nomorPesanan) }),
  ).toBeVisible();
});

/** Urutan kartu PRD §9.2 ▶ Keputusan 2026-11-20 (#204 dan #226), UAT-N4, dan UAT-O8. */
const URUTAN_KARTU = [
  "Pendapatan",
  "Total Harga modal",
  "Laba kotor",
  "Laba bersih",
  "Pesanan Selesai",
  "Pesanan Menunggu Pembayaran",
  "Pesanan Bermasalah",
  "Member aktif",
  "Total saldo Member",
  "Top up Bermasalah",
  "Item stok Tersedia",
  "Item stok Terkirim",
  "Varian stok menipis",
];

const kartu = (page: Page, nama: string) =>
  page.getByRole("main").getByRole("article", { name: nama, exact: true });

/** Angka dari teks kartu: "Rp 1.234" menjadi 1234, "−Rp 500" menjadi −500, dan "12" menjadi 12. */
const angkaDariTeks = (teks: string | null) => {
  const negatif = (teks ?? "").startsWith("−");
  const angka = Number((teks ?? "").replace(/[^\d]/g, ""));
  return negatif ? -angka : angka;
};

/** Angka hari ini di kartu tiga angka, yaitu angka besar pertama. */
const hariIniDi = async (page: Page, nama: string) =>
  angkaDariTeks(
    await kartu(page, nama).getByRole("definition").first().textContent(),
  );

/** Angka di kartu satu angka. */
const angkaDi = async (page: Page, nama: string) =>
  angkaDariTeks(await kartu(page, nama).getByText(/^\d+$/).textContent());

/** N di peringatan Pesanan Selesai tanpa Harga modal, atau 0 bila peringatannya tidak tampil. */
const PERINGATAN =
  /^(\d+) Pesanan Selesai belum dihitung labanya, karena Harga modal Varian-nya belum diisi\.$/;
async function nPeringatan(page: Page) {
  const catatan = page.getByRole("main").getByRole("note");
  if ((await catatan.count()) === 0) return 0;
  const teks = (await catatan.textContent())?.trim() ?? "";
  const cocok = PERINGATAN.exec(teks);
  expect(cocok, teks).not.toBeNull();
  return Number(cocok?.[1]);
}

/** Jumlah Pesanan Selesai yang sudah dibayar tanpa Harga modal di database, sepanjang waktu. */
async function jumlahSelesaiTanpaHargaModal() {
  const [{ jumlah }] = await db
    .select({ jumlah: count() })
    .from(pesanan)
    .where(
      and(
        eq(pesanan.status, "Selesai"),
        isNotNull(pesanan.waktuBayar),
        isNull(pesanan.hargaModal),
      ),
    );
  return jumlah;
}

// PRD §9.2 ▶ Keputusan 2026-11-20 (#204 dan #226), UAT-N4, dan UAT-O8: 13 kartu dengan urutan PRD, dengan Total
// saldo Member dan Top up Bermasalah tepat setelah Member aktif. Kartu uang dan kartu Pesanan Selesai menampilkan
// hari ini, bulan ini, dan sepanjang waktu. Ringkasan hanya berupa angka, tanpa grafik.
test("Ringkasan menampilkan 13 kartu dengan urutan PRD, kartu uang dan Pesanan Selesai bertiga angka, tanpa grafik", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);

  await expect(
    page
      .getByRole("main")
      .getByRole("article")
      .getByRole("heading", { level: 2 }),
  ).toHaveText(URUTAN_KARTU);

  for (const nama of [
    "Pendapatan",
    "Total Harga modal",
    "Laba kotor",
    "Laba bersih",
  ]) {
    await expect(kartu(page, nama).getByRole("term")).toHaveText([
      "Hari ini",
      "Bulan ini",
      "Sepanjang waktu",
    ]);
    await expect(kartu(page, nama).getByRole("definition")).toHaveText([
      /^−?Rp \d[\d.]*$/,
      /^−?Rp \d[\d.]*$/,
      /^−?Rp \d[\d.]*$/,
    ]);
  }
  await expect(kartu(page, "Pesanan Selesai").getByRole("term")).toHaveText([
    "Hari ini",
    "Bulan ini",
    "Sepanjang waktu",
  ]);
  await expect(
    kartu(page, "Pesanan Selesai").getByRole("definition"),
  ).toHaveText([/^\d+$/, /^\d+$/, /^\d+$/]);
  await expect(kartu(page, "Member aktif")).toContainText(
    /dari \d+ Member terdaftar/,
  );
  await expect(
    kartu(page, "Total saldo Member").getByText(/^Rp \d[\d.]*$/),
  ).toBeVisible();
  await expect(kartu(page, "Total saldo Member")).toContainText(
    "Saldo milik Member yang belum dibelanjakan. Ini uang Member, bukan Pendapatan.",
  );

  // Tidak ada grafik: tidak ada kanvas, gambar, atau SVG yang tidak disembunyikan dari pembaca layar.
  const isi = page.getByRole("main");
  await expect(isi.locator("canvas")).toHaveCount(0);
  await expect(isi.getByRole("img")).toHaveCount(0);
  await expect(isi.locator('svg:not([aria-hidden="true"])')).toHaveCount(0);
});

// PRD §9.2 ▶ Keputusan 2026-11-20 dan UAT-N4: kartu Pesanan Selesai dan Menunggu Pembayaran membuka daftar
// Pesanan yang tersaring ke status itu, dan kartu Member aktif membuka daftar Member.
test("kartu Pesanan Selesai, Pesanan Menunggu Pembayaran, dan Member aktif membuka halaman tujuannya", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  const status = page.getByRole("main").getByLabel("Status");

  await kartu(page, "Pesanan Selesai").getByRole("link").click();
  await expect(page).toHaveURL("/admin/pesanan?status=Selesai");
  await expect(status).toHaveValue("Selesai");

  await page.goto("/admin/ringkasan");
  await kartu(page, "Pesanan Menunggu Pembayaran").getByRole("link").click();
  await expect(page).toHaveURL("/admin/pesanan?status=Menunggu+Pembayaran");
  await expect(status).toHaveValue("Menunggu Pembayaran");

  await page.goto("/admin/ringkasan");
  await kartu(page, "Member aktif").getByRole("link").click();
  await expect(page).toHaveURL("/admin/member");
  await expect(
    page.getByRole("heading", { level: 1, name: "Member" }),
  ).toBeVisible();
});

// PRD §9.2 ▶ Keputusan 2026-11-20: kartu 9 dan 10 membuka menu Item stok (PRD §4.2).
test("kartu Item stok Tersedia dan Item stok Terkirim membuka menu Item stok", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);

  for (const nama of ["Item stok Tersedia", "Item stok Terkirim"]) {
    await page.goto("/admin/ringkasan");
    await kartu(page, nama).getByRole("link").click();
    // Daftar Varian memuat semua Varian di app_test, jadi halamannya diberi waktu muat lebih longgar.
    await expect(page).toHaveURL("/admin/item-stok", { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: "Item stok" }),
    ).toBeVisible();
  }
});

// PRD §9.2 ▶ Keputusan 2026-11-20 dan UAT-N4: kartu 1 sampai 4 membuka Laporan keuangan.
test("kartu Pendapatan, Total Harga modal, Laba kotor, dan Laba bersih membuka Laporan keuangan", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);

  for (const nama of [
    "Pendapatan",
    "Total Harga modal",
    "Laba kotor",
    "Laba bersih",
  ]) {
    await page.goto("/admin/ringkasan");
    await kartu(page, nama).getByRole("link").click();
    await expect(page).toHaveURL("/admin/laporan");
    await expect(
      page.getByRole("heading", { level: 1, name: "Laporan keuangan" }),
    ).toBeVisible();
  }
});

// UAT-N3 dan PRD §14.2: Pesanan Selesai tanpa Harga modal menambah Pendapatan tetapi tidak Laba kotor, dan
// peringatan menyebut jumlah Pesanan Selesai tanpa Harga modal sepanjang waktu. Test lain yang berjalan bersamaan
// bisa menambah Pesanan yang dibayar di sela bacaan, jadi bagian itu diulang bila angkanya terganggu.
test("Pesanan Selesai tanpa Harga modal menambah Pendapatan tetapi tidak Laba kotor, dan peringatannya tampil dengan N yang benar", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);

  await expect(async () => {
    await page.goto("/admin/ringkasan");
    const pendapatanSebelum = await hariIniDi(page, "Pendapatan");
    const labaKotorSebelum = await hariIniDi(page, "Laba kotor");
    const nSebelum = await nPeringatan(page);

    // Varian uji belum punya Harga modal, jadi Pesanan ini tercatat tanpa Harga modal.
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      rincian: {
        hargaJual: 20000,
        potonganVoucher: 0,
        kodeUnik: 321,
        totalBayar: 20321,
      },
      biayaTransaksi: 0,
      waktuBayar: new Date(),
    });
    await page.reload();

    expect((await hariIniDi(page, "Pendapatan")) - pendapatanSebelum).toBe(
      20321,
    );
    expect(await hariIniDi(page, "Laba kotor")).toBe(labaKotorSebelum);
    expect(await nPeringatan(page)).toBe(nSebelum + 1);
  }).toPass({ timeout: 30_000 });

  // N sama dengan jumlah Pesanan Selesai tanpa Harga modal di database, dibaca saat jumlah itu tidak berubah.
  await expect(async () => {
    const sebelum = await jumlahSelesaiTanpaHargaModal();
    await page.goto("/admin/ringkasan");
    const n = await nPeringatan(page);
    const sesudah = await jumlahSelesaiTanpaHargaModal();

    expect(sesudah).toBe(sebelum);
    expect(n).toBe(sebelum);
    expect(n).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 30_000 });
});

// PRD §9.2 ▶ Keputusan 2026-11-20, kartu 6, dan UAT-N4: checkout tanpa membayar menambah Pesanan Menunggu
// Pembayaran 1, dan membatalkan Pesanan itu mengembalikannya. Test lain yang berjalan bersamaan juga membuat
// dan menutup Pesanan Menunggu Pembayaran, jadi kartu dibandingkan dengan jumlah Pesanan Menunggu Pembayaran
// lain di database, yang dibaca sebelum dan sesudah halaman dimuat, dan bagian itu diulang bila terganggu.
test("Pesanan Menunggu Pembayaran bertambah 1 setelah checkout tanpa membayar, lalu kembali seperti semula setelah Pesanan itu dibatalkan", async ({
  page,
  browser,
}) => {
  // Tiga pembacaan kartu yang masing-masing bisa diulang, ditambah checkout dan pembatalan.
  test.setTimeout(120_000);
  const email = `budi-${randomUUID()}@example.test`;
  const menungguLain = async () => {
    const [{ jumlah }] = await db
      .select({ jumlah: count() })
      .from(pesanan)
      .where(
        and(
          eq(pesanan.status, "Menunggu Pembayaran"),
          ne(pesanan.email, email),
        ),
      );
    return jumlah;
  };
  const kartuSamaDengan = async (tambahan: number) => {
    await expect(async () => {
      const sebelum = await menungguLain();
      await page.goto("/admin/ringkasan");
      const diKartu = await angkaDi(page, "Pesanan Menunggu Pembayaran");
      const sesudah = await menungguLain();

      expect(sesudah).toBe(sebelum);
      expect(diKartu).toBe(sebelum + tambahan);
    }).toPass({ timeout: 30_000 });
  };
  await masukSebagaiAdmin(page);
  await kartuSamaDengan(0);

  // Pembeli checkout sampai Halaman bayar tanpa membayar.
  const konteksPembeli = await browser.newContext();
  const pembeli = await konteksPembeli.newPage();
  // Produk uji hanya punya satu Varian, jadi Varian itu sudah terpilih.
  await pembeli.goto(`/produk/${produkId}`);
  await pembeli.getByRole("button", { name: /^Beli/ }).click();
  await pembeli.getByRole("textbox", { name: "Email" }).fill(email);
  await pembeli.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(
    pembeli.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();

  await kartuSamaDengan(1);

  // Pembeli membatalkan Pesanan itu.
  await pembeli
    .getByRole("main")
    .getByRole("button", { name: "Batalkan" })
    .click();
  await expect(
    pembeli.getByRole("main").getByText("Dibatalkan", { exact: true }),
  ).toBeVisible();

  await kartuSamaDengan(0);
  await konteksPembeli.close();
});

// UAT-I1 dan PRD §9.2 (▶ Keputusan 2026-11-17): jumlah di kartu Member aktif sama dengan jumlah Member
// berstatus Aktif di daftar Member. Test lain yang berjalan bersamaan bisa menambah atau menonaktifkan Member
// di sela bacaan, jadi kartu hanya dibandingkan saat angkanya sama sebelum dan sesudah daftar Member dimuat,
// dan bagian itu diulang bila angkanya terganggu.
test("kartu Member aktif menampilkan jumlah yang sama dengan jumlah Member berstatus Aktif di daftar Member", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  const kartuMemberAktif = page.getByRole("article", { name: "Member aktif" });

  await expect(async () => {
    await page.goto("/admin/ringkasan");
    const sebelum = await kartuMemberAktif.getByText(/^\d+$/).textContent();
    await page.goto("/admin/member");
    const statusAktif = await page
      .getByRole("main")
      .getByRole("table")
      .locator("tbody td")
      .filter({ hasText: /^Aktif$/ })
      .count();
    await page.goto("/admin/ringkasan");
    const sesudah = await kartuMemberAktif.getByText(/^\d+$/).textContent();

    expect(sesudah).toBe(sebelum);
    expect(Number(sebelum)).toBe(statusAktif);
  }).toPass({ timeout: 30_000 });
});

// UAT-O8 dan PRD §9.2 ▶ Keputusan 2026-11-20 (#226): kartu Total saldo Member membuka daftar Member.
test("kartu Total saldo Member membuka daftar Member", async ({ page }) => {
  await masukSebagaiAdmin(page);

  await kartu(page, "Total saldo Member").getByRole("link").click();

  await expect(page).toHaveURL("/admin/member");
  await expect(
    page.getByRole("heading", { level: 1, name: "Member" }),
  ).toBeVisible();
});

/** Jumlah Top up Bermasalah di database saat ini. */
async function jumlahTopUpBermasalahDiDatabase() {
  const [{ jumlah }] = await db
    .select({ jumlah: count() })
    .from(topUp)
    .where(eq(topUp.status, "Bermasalah"));
  return jumlah;
}

// UAT-O5 langkah 1 dan PRD §9.2 ▶ Keputusan 2026-11-20 (#226): kartu Top up Bermasalah menampilkan jumlah Top up
// Bermasalah saat ini, ditonjolkan seperti kartu Pesanan Bermasalah, dan membuka menu Top up yang tersaring
// Bermasalah. Test lain bisa mengubah jumlah itu di sela bacaan, jadi kartu hanya dibandingkan saat jumlah di
// database sama sebelum dan sesudah halaman dimuat.
test("kartu Top up Bermasalah menampilkan jumlah Top up Bermasalah saat ini, dan mengetuknya membuka menu Top up yang tersaring Bermasalah", async ({
  page,
}) => {
  const email = `ringkasan-top-up-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  const [{ id: userId }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  // Top up Bermasalah seed [CONTOH]: Rp 50.000, Kode unik Rp 123.
  const bermasalah = await sisipkanTopUp({
    userId,
    status: "Bermasalah",
    biayaTransaksi: 0,
    waktuBayar: new Date(),
  });
  await masukSebagaiAdmin(page);
  const kartuTopUp = kartu(page, "Top up Bermasalah");

  await expect(async () => {
    const sebelum = await jumlahTopUpBermasalahDiDatabase();
    await page.goto("/admin/ringkasan");
    const diKartu = await kartuTopUp.getByText(/^\d+$/).textContent();
    const sesudah = await jumlahTopUpBermasalahDiDatabase();

    expect(sesudah).toBe(sebelum);
    expect(Number(diKartu)).toBe(sebelum);
    expect(sebelum).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 30_000 });
  await expect(kartuTopUp).toContainText(
    "Perlu tindakan. Buka daftar Top up Bermasalah",
  );

  await kartuTopUp.getByRole("link").click();

  await expect(page).toHaveURL("/admin/top-up?status=Bermasalah", {
    timeout: 15_000,
  });
  await expect(page.getByRole("main").getByLabel("Status")).toHaveValue(
    "Bermasalah",
  );
  await expect(
    page
      .getByRole("main")
      .getByRole("row", { name: new RegExp(bermasalah.nomorTopUp) }),
  ).toBeVisible();
});
