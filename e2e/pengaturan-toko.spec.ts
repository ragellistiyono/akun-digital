import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// Bahan test katalog dan Pesanan. DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi Produk
// dan Pesanan ini masuk ke database app_test.
import { db } from "../src/server/db";
import { varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

// Pengaturan toko berlaku untuk seluruh toko, jadi test di berkas ini berjalan berurutan dan setiap
// test menyimpan sendiri nilai yang ia periksa. Tombol WhatsApp Halaman Produk (T13) dan Halaman Pesanan
// Bermasalah (T19) juga diuji di sini, karena hanya berkas ini yang mengubah nomor WhatsApp.
test.describe.configure({ mode: "serial" });

const PASSWORD = "sandi-uji-admin-123";

// Netflix Premium dari persiapan bersama docs/UAT.md [CONTOH], dengan akhiran unik per run.
let alamatHalamanProduk = "";
let idVarianSatuBulan = "";

test.beforeAll(async () => {
  const id = await sisipkanProduk({
    nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, hargaNormal: 75000, Tersedia: 10 },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
    ],
  });
  alamatHalamanProduk = `/produk/${id}`;
  [{ id: idVarianSatuBulan }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, id))
    .orderBy(varian.hargaJual)
    .limit(1);
});

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

async function bukaPengaturanToko(page: Page) {
  await page
    .getByRole("navigation", { name: "Menu admin" })
    .getByRole("link", { name: "Pengaturan toko" })
    .click();
  await expect(page).toHaveURL("/admin/pengaturan");
  await expect(
    page.getByRole("heading", { level: 1, name: "Pengaturan toko" }),
  ).toBeVisible();
}

async function simpan(page: Page) {
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Pengaturan toko tersimpan.",
  );
}

test("setelah Admin mengubah nomor WhatsApp, tombol WhatsApp di tab Akun membuka wa.me dengan nomor baru", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);

  // UAT-I5 dan PRD §9.8 ▶ Keputusan 2026-11-11 (#53): nomor bentuk 08 dirapikan menjadi 62.
  const nomor = page.getByLabel("Nomor WhatsApp");
  await nomor.fill("0812-3456-7890");
  await simpan(page);
  // Isian menampilkan nomor yang tersimpan, yaitu hasil rapinya.
  await expect(nomor).toHaveValue("6281234567890");
  await page.goto("/akun");
  await expect(
    page.getByRole("link", { name: "Hubungi kami di WhatsApp" }),
  ).toHaveAttribute("href", "https://wa.me/6281234567890");

  await page.goto("/admin/pengaturan");
  await expect(nomor).toHaveValue("6281234567890");
  await nomor.fill("+62 812 0000 0002");
  await simpan(page);
  await expect(nomor).toHaveValue("6281200000002");

  // Ponsel 390 px: tab Akun dibuka lewat navigasi bawah.
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("link", { name: "Akun" })
    .click();
  await expect(page).toHaveURL("/akun");

  // wa.me milik pihak luar tidak dibuka sungguhan; cukup alamat yang dituju tombol itu.
  await context.route("https://wa.me/**", (rute) =>
    rute.fulfill({ status: 200, contentType: "text/plain", body: "wa.me" }),
  );
  const halamanWhatsapp = context.waitForEvent("page");
  await page.getByRole("link", { name: "Hubungi kami di WhatsApp" }).click();
  const whatsapp = await halamanWhatsapp;
  await expect(whatsapp).toHaveURL("https://wa.me/6281200000002");
});

// UAT-C2 dan PRD §3.3: Halaman Produk menampilkan tombol kontak WhatsApp dari Pengaturan toko.
test("setelah Admin mengisi nomor WhatsApp, Halaman Produk menampilkan tombol WhatsApp yang membuka wa.me dengan nomor itu", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);
  await page.getByLabel("Nomor WhatsApp").fill("0812-3456-7890");
  await simpan(page);

  await page.goto(alamatHalamanProduk);
  const garansi = page.getByRole("region", { name: "Ketentuan garansi" });
  await expect(
    garansi.getByRole("link", { name: "Tanya lewat WhatsApp" }),
  ).toHaveAttribute("href", "https://wa.me/6281234567890");
});

// Issue T19 dan PRD §5.9: Pesanan Bermasalah menampilkan kalimat keterangan dan tombol WhatsApp dari T05.
test("Pesanan Bermasalah menampilkan kalimat keterangan dan tombol WhatsApp yang membuka wa.me dengan nomor dari Pengaturan toko", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);
  await page.getByLabel("Nomor WhatsApp").fill("0812-3456-7890");
  await simpan(page);
  const { tautan } = await sisipkanPesanan({
    varianId: idVarianSatuBulan,
    status: "Bermasalah",
  });

  await page.goto(`/pesanan/${tautan}`);
  const isi = page.getByRole("main");
  await expect(
    isi.getByText(
      "Pembayaran Anda sudah kami terima, tetapi Item stok belum bisa dikirim. Hubungi kami lewat WhatsApp.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    isi.getByRole("link", { name: "Hubungi kami di WhatsApp" }),
  ).toHaveAttribute("href", "https://wa.me/6281234567890");
});

// UAT-I5
test("setelah Admin mengubah teks Syarat & Ketentuan dan Kebijakan Privasi, kedua halaman menampilkan teks baru dengan setiap baris sebagai paragraf", async ({
  page,
}) => {
  const penanda = randomUUID().slice(0, 8);
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);

  await page
    .getByLabel("Syarat & Ketentuan")
    .fill(
      `Syarat ${penanda} pasal satu.\nPasal dua berlaku untuk <b>semua</b> Pesanan.\n\nPasal tiga.`,
    );
  await page
    .getByLabel("Kebijakan Privasi")
    .fill(`Kebijakan ${penanda}.\nEmail hanya dipakai untuk Pesanan.`);
  await simpan(page);

  await page.goto("/syarat-ketentuan");
  const isiSyarat = page.getByRole("main");
  await expect(
    isiSyarat.getByRole("heading", { level: 1, name: "Syarat & Ketentuan" }),
  ).toBeVisible();
  // Teks tampil apa adanya, termasuk tanda < dan > yang tidak dibaca sebagai HTML.
  await expect(isiSyarat.locator("p")).toHaveText([
    `Syarat ${penanda} pasal satu.`,
    "Pasal dua berlaku untuk <b>semua</b> Pesanan.",
    "Pasal tiga.",
  ]);

  await page.goto("/kebijakan-privasi");
  const isiKebijakan = page.getByRole("main");
  await expect(
    isiKebijakan.getByRole("heading", { level: 1, name: "Kebijakan Privasi" }),
  ).toBeVisible();
  await expect(isiKebijakan.locator("p")).toHaveText([
    `Kebijakan ${penanda}.`,
    "Email hanya dipakai untuk Pesanan.",
  ]);
});

for (const halaman of ["/", "/kategori", "/riwayat", "/akun"]) {
  test(`footer toko di ${halaman} menautkan halaman Syarat & Ketentuan dan Kebijakan Privasi`, async ({
    page,
  }) => {
    await page.goto(halaman);

    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link")).toHaveText([
      "Syarat & Ketentuan",
      "Kebijakan Privasi",
    ]);

    await footer.getByRole("link", { name: "Syarat & Ketentuan" }).click();
    await expect(page).toHaveURL("/syarat-ketentuan");
    await expect(
      page.getByRole("heading", { level: 1, name: "Syarat & Ketentuan" }),
    ).toBeVisible();

    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Kebijakan Privasi" })
      .click();
    await expect(page).toHaveURL("/kebijakan-privasi");
    await expect(
      page.getByRole("heading", { level: 1, name: "Kebijakan Privasi" }),
    ).toBeVisible();
  });
}

// PRD §11.1 ▶ Keputusan 2026-11-11: tab Akun berisi tombol WhatsApp serta tautan kedua halaman itu.
test("tab Akun menautkan halaman Syarat & Ketentuan dan Kebijakan Privasi", async ({
  page,
}) => {
  await page.goto("/akun");

  const isi = page.getByRole("main");
  await expect(isi.getByRole("link", { name: /Syarat|Privasi/ })).toHaveText([
    "Syarat & Ketentuan",
    "Kebijakan Privasi",
  ]);
  await isi.getByRole("link", { name: "Kebijakan Privasi" }).click();
  await expect(page).toHaveURL("/kebijakan-privasi");
});

test("selama nomor WhatsApp belum diisi, tab Akun tidak menampilkan tombol WhatsApp", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);
  await page.getByLabel("Nomor WhatsApp").fill("");
  await simpan(page);

  await page.goto("/akun");
  await expect(
    page.getByRole("heading", { level: 1, name: "Akun" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);
  await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);

  // Halaman Produk juga tidak menampilkan tombol WhatsApp.
  await page.goto(alamatHalamanProduk);
  await expect(
    page.getByRole("region", { name: "Ketentuan garansi" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);
  await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
});

// UAT-I5 langkah 3.
test("nomor WhatsApp luar negeri ditolak dengan pesan bahwa nomor harus nomor Indonesia", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);

  const nomor = page.getByLabel("Nomor WhatsApp");
  await nomor.fill("+1 555 0100");
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(nomor).toHaveAttribute("aria-invalid", "true");
  await expect(nomor).toHaveAccessibleDescription(
    "Nomor WhatsApp harus nomor Indonesia, yang diawali 0, 62, atau +62. Tulis nomornya misalnya 0812-3456-7890, lalu simpan lagi.",
  );
  // Isian tetap berisi ketikan Admin supaya mudah diperbaiki.
  await expect(nomor).toHaveValue("+1 555 0100");
  await expect(page.getByRole("status")).toHaveText("");
});

// PRD §13 ▶ Keputusan 2026-11-11: isian Ambang stok menipis pindah ke M2.
test("halaman Pengaturan toko tidak punya isian Ambang stok menipis", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);

  const form = page.locator("form").filter({
    has: page.getByRole("button", { name: "Simpan" }),
  });
  await expect(form.getByRole("textbox")).toHaveCount(3);
  await expect(form.getByLabel("Nomor WhatsApp")).toBeVisible();
  await expect(form.getByLabel("Syarat & Ketentuan")).toBeVisible();
  await expect(form.getByLabel("Kebijakan Privasi")).toBeVisible();
  await expect(page.getByText(/ambang|stok menipis/i)).toHaveCount(0);
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
});

test("Tamu yang membuka /admin/pengaturan diarahkan ke halaman login /admin", async ({
  page,
}) => {
  await page.goto("/admin/pengaturan");

  await expect(page).toHaveURL("/admin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Masuk ke dasbor admin" }),
  ).toBeVisible();
});
