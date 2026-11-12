import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dan ITEM_STOK_KEY berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk
// ke database app_test dan Item stok-nya dienkripsi dengan kunci uji. Server e2e menjalankan pekerja pg-boss
// (src/instrumentation.ts) dengan email tiruan dari .env.ci (EMAIL_MODE=tiruan). Email tiruan disimpan di
// memori proses server, jadi isi dan alamat tujuan email diuji di
// src/app/admin/(dasbor)/pesanan/aksi.test.ts; di sini diperiksa bahwa pekerja server menjalankan pekerjaan
// email "Pesanan selesai" sampai selesai.
import { db } from "../src/server/db";
import { varian } from "../src/server/db/schema";
import { bacaStokVarian } from "../src/server/item-stok";
import { pekerjaanEmailPesananSelesai } from "../src/server/pekerjaan-latar";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

const PASSWORD = "sandi-uji-admin-123";
const FORMAT = ["Email", "Password", "Profil"];

// Koneksi database dan pg-boss tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

/**
 * Varian "1 Bulan" sebuah Produk [CONTOH] baru dengan Stok Varian itu. Namanya berakhiran unik dan bukan
 * Netflix, supaya tidak mengubah hasil pencarian "netflix" di cari-kategori-beranda.spec.ts yang berjalan
 * bersamaan.
 */
async function varianBerstok(stok: number) {
  const produkId = await sisipkanProduk({
    nama: `Selesaikan Bermasalah ${randomUUID().slice(0, 8)}`,
    formatItemStok: FORMAT,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: stok }],
  });
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return id;
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
/** Pil status dan tanda di bawah Nomor Pesanan, di kepala detail Pesanan. */
const kepala = (page: Page) => isi(page).locator("h1 + div");
const panelPenyelesaian = (page: Page) =>
  isi(page).getByRole("region", { name: "Selesaikan Pesanan Bermasalah" });
/** Panel email dan Produk beserta Varian di detail Pesanan. */
const panelPesanan = (page: Page) =>
  isi(page).getByRole("region", { name: "Pesanan", exact: true });

/** Teks setiap sel sebuah baris tabel. */
const teksSel = (baris: Locator) =>
  baris
    .locator("th, td")
    .evaluateAll((sel) =>
      sel.map((s) => (s.textContent ?? "").replace(/\s+/g, " ").trim()),
    );

/** Tombol penegasan setiap aksi penyelesaian (PRD §5.9, ▶ Keputusan 2026-11-12). */
const TOMBOL_PENEGASAN = {
  "Kirim Item stok": "Ya, kirim Item stok",
  "Tandai Dana Dikembalikan": "Ya, tandai Dana Dikembalikan",
};

/** Kalimat penegasan "Kirim Item stok" untuk Pesanan ber-email itu. */
const penegasanKirim = (email: string) =>
  `Kirim satu Item stok Tersedia dari Varian yang sama ke Pesanan ini? Pesanan menjadi Selesai, dan email "Pesanan selesai" dikirim ke ${email}. Aksi ini tidak bisa dibatalkan.`;

const PENEGASAN_DANA =
  "Tandai Pesanan ini Dana Dikembalikan? Pesanan ini tidak akan mendapat Item stok, jadi pastikan uangnya sudah dikembalikan di luar sistem. Aksi ini tidak bisa dibatalkan.";

/** Menekan salah satu aksi penyelesaian, lalu menerima penegasannya. */
async function selesaikanDenganPenegasan(
  page: Page,
  aksi: keyof typeof TOMBOL_PENEGASAN,
) {
  const panel = panelPenyelesaian(page);
  await panel.getByRole("button", { name: aksi, exact: true }).click();
  await panel
    .getByRole("button", { name: TOMBOL_PENEGASAN[aksi], exact: true })
    .click();
}

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

// UAT-E6, PRD §5.7, §5.9, dan §6.4: email Pesanan Bermasalah pertama dikoreksi menjadi Email A tanpa mengirim
// email, lalu Pesanan itu diselesaikan dengan "Kirim Item stok"; yang kedua ditandai Dana Dikembalikan.
// Pengecekan kartu "Bermasalah" diganti daftar Pesanan dasbor admin (UAT M1). Email tiruan disimpan di memori
// server, jadi alamat tujuan email "Pesanan selesai" diuji di aksi.test.ts.
test('Admin mengoreksi email Pesanan Bermasalah pertama lalu menyelesaikannya dengan "Kirim Item stok", dan menandai yang kedua Dana Dikembalikan', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const varianId = await varianBerstok(2);
  const pertama = await sisipkanPesanan({ varianId, status: "Bermasalah" });
  const kedua = await sisipkanPesanan({ varianId, status: "Bermasalah" });
  const emailA = `budi-${randomUUID()}@mail.com`;
  await masukSebagaiAdmin(page);

  await page.goto(`/admin/pesanan/${pertama.nomorPesanan}`);
  await expect(kepala(page)).toHaveText("Bermasalah");
  const koreksi = isi(page).getByRole("form", { name: "Koreksi email" });
  await koreksi.getByLabel("Email baru").fill(emailA);
  await koreksi.getByRole("button", { name: "Simpan email" }).click();
  await expect(koreksi.getByRole("status")).toHaveText(
    `Email Pesanan diganti menjadi ${emailA}. Belum ada email yang dikirim: email "Pesanan selesai" dikirim ke alamat itu setelah Anda menekan "Kirim Item stok".`,
  );
  await expect(panelPesanan(page)).toContainText(emailA);
  await expect(kepala(page)).toHaveText("Bermasalah");
  expect(await pekerjaanEmailPesananSelesai(pertama.id)).toEqual([]);

  await selesaikanDenganPenegasan(page, "Kirim Item stok");

  await expect(kepala(page)).toHaveText("Selesai");
  await expect(panelPenyelesaian(page)).toHaveCount(0);
  const itemStok = isi(page).getByRole("region", { name: "Item stok" });
  for (const nama of FORMAT) {
    await expect(itemStok.getByText(nama, { exact: true })).toBeVisible();
  }
  const riwayat = isi(page)
    .getByRole("region", { name: "Riwayat perubahan status" })
    .getByRole("row");
  await expect(riwayat).toHaveCount(2);
  expect((await teksSel(riwayat.nth(1))).slice(1)).toEqual([
    "Selesai",
    "Admin",
  ]);
  expect((await bacaStokVarian(varianId)).jumlahPerStatus).toEqual({
    Tersedia: 1,
    Ditahan: 0,
    Terkirim: 1,
  });
  // Email "Pesanan selesai" dikirim pekerja server lewat T23, ke email Pesanan yang sudah dikoreksi.
  await expect(async () => {
    const pekerjaan = await pekerjaanEmailPesananSelesai(pertama.id);
    expect(pekerjaan.map(({ state }) => state)).toEqual(["completed"]);
  }).toPass({ timeout: 30_000, intervals: [1_000] });
  await expect(panelPesanan(page)).toContainText(emailA);
  await page.goto(`/admin/pesanan?cari=${pertama.nomorPesanan}`);
  await expect(
    isi(page)
      .getByRole("table")
      .getByRole("row", { name: new RegExp(pertama.nomorPesanan) }),
  ).toContainText(emailA);

  await page.goto(`/admin/pesanan/${kedua.nomorPesanan}`);
  await selesaikanDenganPenegasan(page, "Tandai Dana Dikembalikan");

  await expect(kepala(page)).toHaveText("Dana Dikembalikan");
  await expect(panelPenyelesaian(page)).toHaveCount(0);
  await expect(
    isi(page).getByRole("region", { name: "Item stok" }),
  ).toHaveCount(0);
  expect((await bacaStokVarian(varianId)).stokVarian).toBe(1);

  // Kedua Pesanan tidak lagi ada di daftar Pesanan Bermasalah.
  for (const { nomorPesanan } of [pertama, kedua]) {
    await page.goto(`/admin/pesanan?status=Bermasalah&cari=${nomorPesanan}`);
    await expect(
      isi(page).getByText("Tidak ada Pesanan yang cocok dengan saringan ini."),
    ).toBeVisible();
  }
});

// PRD §5.9: Pesanan Bermasalah tampil menonjol di menu. Jumlahnya dihitung dari semua Pesanan, dan test lain
// yang berjalan bersamaan bisa membuat Pesanan Bermasalah di sela kedua bacaan, jadi bagian itu diulang
// dengan Pesanan baru bila angkanya terganggu.
test("setelah Pesanan Bermasalah diselesaikan, jumlah Pesanan Bermasalah di menu langsung berkurang tanpa memuat ulang halaman", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const varianId = await varianBerstok(0);
  await masukSebagaiAdmin(page);

  await expect(async () => {
    const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });
    await page.goto(`/admin/pesanan/${dipesan.nomorPesanan}`);
    const sebelum = await jumlahBermasalahDiMenu(page);
    expect(sebelum).toBeGreaterThanOrEqual(1);

    await selesaikanDenganPenegasan(page, "Tandai Dana Dikembalikan");
    await expect(kepala(page)).toHaveText("Dana Dikembalikan");

    expect(await jumlahBermasalahDiMenu(page)).toBe(sebelum - 1);
  }).toPass({ timeout: 60_000 });
});

// Issue T26-b, PRD §5.9 dan DESIGN.md Navigation (▶ Keputusan 2026-11-12), UAT-E6: "Kirim Item stok" tidak
// bisa dibatalkan, jadi ditegaskan di tempat lebih dulu, tanpa dialog. Klik ganda pada tombolnya hanya membuka
// penegasan, Batal tidak mengubah apa pun, dan Pesanan baru Selesai setelah penegasan diterima. Klik ganda
// pada tombol penegasan tetap hanya memberi satu Item stok.
test('"Kirim Item stok" meminta penegasan di tempat: Pesanan tetap Bermasalah bila Admin memilih Batal, dan baru Selesai setelah penegasan diterima', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const varianId = await varianBerstok(2);
  const email = `budi-${randomUUID()}@mail.com`;
  const dipesan = await sisipkanPesanan({
    varianId,
    status: "Bermasalah",
    email,
  });
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/pesanan/${dipesan.nomorPesanan}`);
  const panel = panelPenyelesaian(page);

  await panel
    .getByRole("button", { name: "Kirim Item stok", exact: true })
    .dblclick();

  await expect(
    panel.getByText(penegasanKirim(email), { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Ya, kirim Item stok", exact: true }),
  ).toBeEnabled();
  await expect(panel.getByRole("button", { name: "Batal" })).toBeEnabled();
  await expect(
    panel.getByRole("button", {
      name: "Tandai Dana Dikembalikan",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(kepala(page)).toHaveText("Bermasalah");

  await panel.getByRole("button", { name: "Batal" }).click();

  await expect(panel.getByText(penegasanKirim(email))).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Kirim Item stok", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(kepala(page)).toHaveText("Bermasalah");
  expect((await bacaStokVarian(varianId)).jumlahPerStatus).toEqual({
    Tersedia: 2,
    Ditahan: 0,
    Terkirim: 0,
  });
  expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);

  await panel
    .getByRole("button", { name: "Kirim Item stok", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Ya, kirim Item stok", exact: true })
    .dblclick();

  await expect(kepala(page)).toHaveText("Selesai");
  await expect(panel).toHaveCount(0);
  expect((await bacaStokVarian(varianId)).jumlahPerStatus).toEqual({
    Tersedia: 1,
    Ditahan: 0,
    Terkirim: 1,
  });
});

// Issue T26-b, PRD §5.9 dan DESIGN.md Navigation (▶ Keputusan 2026-11-12), UAT-E6: "Tandai Dana Dikembalikan"
// juga ditegaskan di tempat lebih dulu.
test('"Tandai Dana Dikembalikan" meminta penegasan di tempat: Pesanan tetap Bermasalah bila Admin memilih Batal, dan baru Dana Dikembalikan setelah penegasan diterima', async ({
  page,
}) => {
  const varianId = await varianBerstok(1);
  const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/pesanan/${dipesan.nomorPesanan}`);
  const panel = panelPenyelesaian(page);

  await panel
    .getByRole("button", { name: "Tandai Dana Dikembalikan", exact: true })
    .dblclick();

  await expect(panel.getByText(PENEGASAN_DANA, { exact: true })).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: "Ya, tandai Dana Dikembalikan",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    panel.getByRole("button", { name: "Kirim Item stok", exact: true }),
  ).toHaveCount(0);
  await expect(kepala(page)).toHaveText("Bermasalah");

  await panel.getByRole("button", { name: "Batal" }).click();

  await expect(panel.getByText(PENEGASAN_DANA)).toHaveCount(0);
  await expect(
    panel.getByRole("button", {
      name: "Tandai Dana Dikembalikan",
      exact: true,
    }),
  ).toBeEnabled();
  await page.reload();
  await expect(kepala(page)).toHaveText("Bermasalah");

  await selesaikanDenganPenegasan(page, "Tandai Dana Dikembalikan");

  await expect(kepala(page)).toHaveText("Dana Dikembalikan");
  await expect(panel).toHaveCount(0);
  expect((await bacaStokVarian(varianId)).stokVarian).toBe(1);
});

// Issue T26: bila Stok Varian 0, aksi ditolak dengan pesan untuk mengisi stok dulu, dan status tetap
// Bermasalah.
test('"Kirim Item stok" saat Stok Varian 0 menampilkan pesan untuk mengisi stok dulu, dan Pesanan tetap Bermasalah', async ({
  page,
}) => {
  const varianId = await varianBerstok(0);
  const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/pesanan/${dipesan.nomorPesanan}`);

  await selesaikanDenganPenegasan(page, "Kirim Item stok");

  await expect(panelPenyelesaian(page).getByRole("status")).toHaveText(
    'Item stok tidak dikirim, karena Stok Varian Pesanan ini 0, jadi Pesanan tetap Bermasalah. Isi Item stok Varian itu dulu di menu Produk, lalu tekan "Kirim Item stok" lagi. Item stok dari Varian lain tidak bisa dipakai.',
  );
  await expect(kepala(page)).toHaveText("Bermasalah");
  // Pesannya meminta Admin menekan "Kirim Item stok" lagi, jadi tombol itu langsung tersedia kembali.
  await expect(
    panelPenyelesaian(page).getByRole("button", {
      name: "Kirim Item stok",
      exact: true,
    }),
  ).toBeEnabled();
  await page.reload();
  await expect(kepala(page)).toHaveText("Bermasalah");
  await expect(
    panelPenyelesaian(page).getByRole("button", { name: "Kirim Item stok" }),
  ).toBeEnabled();
});

// Issue T26: kedua aksi tidak tersedia untuk Pesanan selain Bermasalah.
test('detail Pesanan Selesai tidak menampilkan "Kirim Item stok" maupun "Tandai Dana Dikembalikan"', async ({
  page,
}) => {
  const varianId = await varianBerstok(1);
  const dipesan = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    itemStok: {
      status: "Terkirim",
      nilai: [
        `miwe.akun-${randomUUID().slice(0, 8)}@contoh.id`,
        "Senja-7419",
        "Profil 3",
      ],
      formatSaatTerkirim: FORMAT,
    },
  });
  await masukSebagaiAdmin(page);

  await page.goto(`/admin/pesanan/${dipesan.nomorPesanan}`);

  await expect(kepala(page)).toHaveText("Selesai");
  await expect(
    isi(page).getByRole("button", { name: "Kirim ulang email" }),
  ).toBeVisible();
  await expect(panelPenyelesaian(page)).toHaveCount(0);
  await expect(
    isi(page).getByRole("button", { name: "Kirim Item stok" }),
  ).toHaveCount(0);
  await expect(
    isi(page).getByRole("button", { name: "Tandai Dana Dikembalikan" }),
  ).toHaveCount(0);
});

test("di lebar 390 px detail Pesanan Bermasalah tidak membuat halaman bergulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const varianId = await varianBerstok(1);
  const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });
  await masukSebagaiAdmin(page);

  await page.goto(`/admin/pesanan/${dipesan.nomorPesanan}`);

  await expect(
    panelPenyelesaian(page).getByRole("button", {
      name: "Tandai Dana Dikembalikan",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
