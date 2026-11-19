import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { and, eq } from "drizzle-orm";

// Bahan test katalog dan Pesanan. DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi Produk
// dan Pesanan ini masuk ke database app_test.
import { db } from "../src/server/db";
import { user, varian } from "../src/server/db/schema";
import { ubahStatusMember } from "../src/server/status-member";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

// Pengaturan toko berlaku untuk seluruh toko, jadi test di berkas ini berjalan berurutan dan setiap
// test menyimpan sendiri nilai yang ia periksa. Tombol WhatsApp Halaman Produk (T13), Halaman Pesanan
// Bermasalah (T19), login Member nonaktif (T48), checkout Member nonaktif (T48-b), dan Tautan atur ulang
// password milik Member nonaktif (T49-b) juga diuji di sini, karena hanya berkas ini yang mengubah nomor
// WhatsApp.
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
  // UAT-K1 dan PRD §11.1 ▶ Keputusan 2026-11-17: sesi Admin bukan Member, jadi tab Akun tampil untuk
  // Tamu, dengan tombol "Masuk" dan "Daftar" di atas tombol WhatsApp, lalu tautan halaman hukum di footer
  // toko (PRD §11.1 ▶ Keputusan 2026-11-20).
  const isiAkun = page.getByRole("main");
  const atas = async (nama: string) =>
    (await isiAkun
      .getByRole("link", { name: nama, exact: true })
      .boundingBox())!.y;
  expect(await atas("Masuk")).toBeLessThan(await atas("Daftar"));
  expect(await atas("Daftar")).toBeLessThan(
    await atas("Hubungi kami di WhatsApp"),
  );
  expect(await atas("Hubungi kami di WhatsApp")).toBeLessThan(
    (await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Syarat & Ketentuan" })
      .boundingBox())!.y,
  );

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

// Issue T48 dan PRD §7.5 ▶ Keputusan 2026-11-17, UAT-B3 langkah 4.
test("Member nonaktif yang login dengan password benar melihat pesan nonaktif dan tombol WhatsApp yang membuka wa.me dengan nomor dari Pengaturan toko", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);
  await page.getByLabel("Nomor WhatsApp").fill("0812-3456-7890");
  await simpan(page);
  await page.context().clearCookies();
  const email = `member-${randomUUID()}@example.test`;
  const passwordMember = "sandi-uji-member-123";
  await sisipkanMember({ email, password: passwordMember });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  await ubahStatusMember({ idMember: id, nonaktif: true });

  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(passwordMember);
  await page.getByRole("button", { name: "Masuk" }).click();

  const isi = page.getByRole("main");
  await expect(isi.getByRole("alert")).toHaveText(
    "Akun Member ini dinonaktifkan, jadi tidak bisa masuk. Hubungi kami di WhatsApp.",
  );
  await expect(
    isi.getByRole("link", { name: "Hubungi kami di WhatsApp" }),
  ).toHaveAttribute("href", "https://wa.me/6281234567890");
});

// Issue T64 dan PRD §11.3 ▶ Keputusan 2026-11-18: bagian "Tampilan" terletak setelah tombol "Masuk" dan
// "Daftar" (Tamu) atau "Keluar" (Member), dan sebelum tombol WhatsApp.
test("bagian Tampilan di tab Akun berada sebelum tombol WhatsApp, untuk Tamu dan Member", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);
  await page.getByLabel("Nomor WhatsApp").fill("0812-3456-7890");
  await simpan(page);
  await page.context().clearCookies();

  const isi = page.getByRole("main");
  const atas = async (elemen: ReturnType<Page["locator"]>) => {
    await expect(elemen).toBeVisible();
    return (await elemen.boundingBox())!.y;
  };
  const modeTampilan = isi.getByRole("radiogroup", { name: "Mode tampilan" });
  const whatsapp = isi.getByRole("link", { name: "Hubungi kami di WhatsApp" });

  await page.goto("/akun");
  expect(
    await atas(isi.getByRole("link", { name: "Daftar", exact: true })),
  ).toBeLessThan(await atas(modeTampilan));
  expect(await atas(modeTampilan)).toBeLessThan(await atas(whatsapp));

  const email = `member-${randomUUID()}@example.test`;
  const passwordMember = "sandi-uji-member-123";
  await sisipkanMember({ email, password: passwordMember });
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(passwordMember);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");

  await page.goto("/akun");
  expect(await atas(isi.getByRole("button", { name: "Keluar" }))).toBeLessThan(
    await atas(modeTampilan),
  );
  expect(await atas(modeTampilan)).toBeLessThan(await atas(whatsapp));
});

/** Member nonaktif baru dengan email unik. Hasilnya email Member itu. */
async function memberNonaktifBaru() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  await ubahStatusMember({ idMember: id, nonaktif: true });
  return email;
}

const PESAN_CHECKOUT_NONAKTIF =
  "Email ini milik Member yang dinonaktifkan, jadi Pesanan tidak dibuat. Hubungi kami di WhatsApp.";

/** Membuka Checkout Varian itu sebagai Tamu, mengisi email, lalu menekan "Bayar dengan QRIS". */
async function checkoutSebagaiTamu(
  page: Page,
  varianId: string,
  email: string,
) {
  await page.goto(`/checkout?varianId=${varianId}`);
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();
}

// Issue T48-b, PRD §5.2 ▶ Keputusan 2026-11-17 (#174), UAT-B3 langkah 5.
test("Tamu yang checkout dengan email Member nonaktif melihat pesan penolakan dan tombol WhatsApp yang membuka wa.me dengan nomor dari Pengaturan toko", async ({
  page,
  context,
}) => {
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);
  await page.getByLabel("Nomor WhatsApp").fill("0812-3456-7890");
  await simpan(page);
  await context.clearCookies();
  const email = await memberNonaktifBaru();

  await checkoutSebagaiTamu(page, idVarianSatuBulan, email);

  const isi = page.getByRole("main");
  await expect(isi.getByRole("alert")).toHaveText(PESAN_CHECKOUT_NONAKTIF);
  await expect(page).toHaveURL(/\/checkout\?varianId=/);
  // wa.me milik pihak luar tidak dibuka sungguhan; cukup alamat yang dituju tombol itu.
  await context.route("https://wa.me/**", (rute) =>
    rute.fulfill({ status: 200, contentType: "text/plain", body: "wa.me" }),
  );
  const halamanWhatsapp = context.waitForEvent("page");
  await isi.getByRole("link", { name: "Hubungi kami di WhatsApp" }).click();
  await expect(await halamanWhatsapp).toHaveURL("https://wa.me/6281234567890");
});

// Issue T48-b: penolakan checkout lain tidak menampilkan tombol WhatsApp, walaupun nomornya sudah diisi.
test("checkout Varian yang stoknya habis ditolak dengan pesan stok habis tanpa tombol WhatsApp", async ({
  page,
  browser,
  baseURL,
}) => {
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);
  await page.getByLabel("Nomor WhatsApp").fill("0812-3456-7890");
  await simpan(page);
  await page.context().clearCookies();
  const produkId = await sisipkanProduk({
    nama: `Stok Terakhir ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 1 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  await page.goto(`/checkout?varianId=${varianId}`);
  // Selagi form ini terbuka, Pembeli lain di browser lain checkout dan menahan Item stok terakhir.
  const browserLain = await browser.newContext({ baseURL });
  try {
    await checkoutSebagaiTamu(
      await browserLain.newPage(),
      varianId,
      `budi-${randomUUID()}@example.test`,
    );
    await browserLain.pages()[0].waitForURL(/\/pesanan\//);
  } finally {
    await browserLain.close();
  }

  await page
    .getByRole("textbox", { name: "Email" })
    .fill(`budi-${randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();

  const isi = page.getByRole("main");
  await expect(isi.getByRole("alert")).toHaveText(
    "Stok Varian ini sudah habis, jadi Pesanan tidak dibuat. Pilih Varian lain, atau Produk lain di Beranda.",
  );
  await expect(isi.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);
  await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
});

const PESAN_TAUTAN_MEMBER_NONAKTIF =
  "Akun Member ini dinonaktifkan, jadi password tidak bisa diganti. Hubungi kami di WhatsApp.";

/**
 * Member aktif baru meminta Tautan atur ulang password di halaman Lupa password, lalu Admin menonaktifkannya.
 * Hasilnya alamat halaman tautan itu, dibaca dari email tiruan (.env.ci, APP_URL https://miwe.example
 * [CONTOH]) tanpa alamat tokonya.
 */
async function tautanMemberYangLaluDinonaktifkan(
  page: Page,
  request: APIRequestContext,
) {
  const email = `budi-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  await page.goto("/lupa-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Kirim tautan" }).click();
  await expect(page.getByRole("main").getByRole("status")).toBeVisible();
  const respons = await request.get(
    `/api/email-tiruan?kepada=${encodeURIComponent(email)}`,
  );
  const [surat] = (await respons.json()) as { teks: string }[];
  const cocok = /^https:\/\/miwe\.example(\/atur-ulang-password\/\S+)$/m.exec(
    surat.teks,
  );
  if (!cocok) throw new Error(`Email ke ${email} tidak memuat tautan.`);
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  await ubahStatusMember({ idMember: id, nonaktif: true });
  return cocok[1];
}

// Issue T49-b, PRD §7.5 ▶ Keputusan 2026-11-17 (#174), UAT-G5 langkah 8.
test("tautan atur ulang password yang dibuka setelah Member-nya dinonaktifkan menampilkan pesan nonaktif dan tombol WhatsApp, tanpa form password", async ({
  page,
  request,
}) => {
  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);
  await page.getByLabel("Nomor WhatsApp").fill("0812-3456-7890");
  await simpan(page);
  await page.context().clearCookies();
  const alamat = await tautanMemberYangLaluDinonaktifkan(page, request);

  await page.goto(alamat);

  const isi = page.getByRole("main");
  await expect(isi.getByRole("alert")).toHaveText(PESAN_TAUTAN_MEMBER_NONAKTIF);
  await expect(
    isi.getByRole("link", { name: "Hubungi kami di WhatsApp" }),
  ).toHaveAttribute("href", "https://wa.me/6281234567890");
  await expect(page.getByLabel("Password baru")).toHaveCount(0);
  await expect(
    isi.getByRole("button", { name: "Simpan password" }),
  ).toHaveCount(0);
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

// PRD §11.1 ▶ Keputusan 2026-11-20: tautan kedua halaman itu di tab Akun datang dari footer toko (diuji di
// atas), dan tidak lagi diulang di isi tab, supaya tidak tampil dua kali.
test("isi tab Akun tidak mengulang tautan Syarat & Ketentuan dan Kebijakan Privasi dari footer", async ({
  page,
}) => {
  await page.goto("/akun");

  await expect(
    page.getByRole("main").getByRole("link", { name: /Syarat|Privasi/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: /Syarat|Privasi/ }),
  ).toHaveCount(2);
});

test("selama nomor WhatsApp belum diisi, tab Akun tidak menampilkan tombol WhatsApp", async ({
  page,
  request,
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

  // Penolakan checkout karena email milik Member nonaktif hanya menampilkan pesannya (issue T48-b, PRD §5.2 ▶
  // Keputusan 2026-11-17).
  await page.context().clearCookies();
  await checkoutSebagaiTamu(
    page,
    idVarianSatuBulan,
    await memberNonaktifBaru(),
  );
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    PESAN_CHECKOUT_NONAKTIF,
  );
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);
  await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);

  // Tautan atur ulang password milik Member nonaktif hanya menampilkan pesannya, tanpa form password (issue
  // T49-b, PRD §7.5 ▶ Keputusan 2026-11-17).
  await page.goto(await tautanMemberYangLaluDinonaktifkan(page, request));
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    PESAN_TAUTAN_MEMBER_NONAKTIF,
  );
  await expect(page.getByLabel("Password baru")).toHaveCount(0);
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

/** Menyimpan Ambang stok menipis lewat halaman Pengaturan toko. */
async function simpanAmbang(page: Page, ambang: string) {
  await page.goto("/admin/pengaturan");
  await page.getByLabel("Ambang stok menipis").fill(ambang);
  await simpan(page);
}

/** Membuka Ringkasan lewat menu admin, lalu mengambil kartu dan daftar Stok menipis. */
async function bukaRingkasan(page: Page) {
  await page
    .getByRole("navigation", { name: "Menu admin" })
    .getByRole("link", { name: "Ringkasan" })
    .click();
  await expect(page).toHaveURL("/admin/ringkasan");
  return {
    kartu: page.getByRole("article", { name: "Varian stok menipis" }),
    daftar: page.getByRole("region", { name: "Stok menipis" }),
  };
}

// UAT-I2 dan PRD §9.2, §9.4 (▶ Keputusan 2026-11-17). Katalog persiapan bersama docs/UAT.md [CONTOH], dengan
// akhiran unik per run. Database test dipakai bersama oleh berkas test lain yang juga membuat Varian ber-stok
// sedikit, jadi daftar hanya diperiksa untuk Produk test ini, dan kartu dibandingkan dengan jumlah baris
// daftar di halaman yang sama. Hanya berkas ini yang mengubah Ambang stok menipis.
test("daftar Stok menipis di Ringkasan urut dari Stok Varian terkecil, setiap barisnya membuka halaman Varian, dan daftar serta kartunya mengikuti Ambang stok menipis", async ({
  page,
}) => {
  const akhiran = randomUUID().slice(0, 8);
  const netflix = await sisipkanProduk({
    nama: `Netflix Premium ${akhiran}`,
    varian: [
      { nama: "1 Bulan", hargaJual: 50000, Tersedia: 10 },
      // Item stok Ditahan tidak dihitung (PRD §5.3): Stok Varian 4.
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4, Ditahan: 2 },
    ],
  });
  await sisipkanProduk({
    nama: `YouTube Premium ${akhiran}`,
    varian: [
      { nama: "1 Bulan", hargaJual: 20000 },
      { nama: "3 Bulan", hargaJual: 55000, Tersedia: 3 },
      // Varian nonaktif tidak masuk daftar.
      { nama: "1 Tahun", hargaJual: 199000, Tersedia: 1, aktif: false },
    ],
  });
  await sisipkanProduk({
    nama: `Spotify Premium ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 25000 }],
  });
  // Varian dari Produk nonaktif tidak masuk daftar.
  await sisipkanProduk({
    nama: `Game Lama ${akhiran}`,
    aktif: false,
    varian: [{ nama: "Paket", hargaJual: 30000, Tersedia: 1 }],
  });
  const [{ id: idNetflixTigaBulan }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(and(eq(varian.produkId, netflix), eq(varian.nama, "3 Bulan")));

  await masukSebagaiAdmin(page);
  await bukaPengaturanToko(page);
  // Nilai awal Ambang stok menipis adalah 5 (PRD §9.4); test ini tetap menyimpannya sendiri.
  await simpanAmbang(page, "5");

  // Langkah 1: ambang 5.
  let { kartu, daftar } = await bukaRingkasan(page);
  const barisTestIni = daftar
    .getByRole("listitem")
    .filter({ hasText: akhiran });
  await expect(barisTestIni).toHaveText([
    `Spotify Premium ${akhiran}1 BulanStok 0`,
    `YouTube Premium ${akhiran}1 BulanStok 0`,
    `YouTube Premium ${akhiran}3 BulanStok 3`,
    `Netflix Premium ${akhiran}3 BulanStok 4`,
  ]);
  // Daftar ada di bawah kartu angka.
  const kotakKartu = await kartu.boundingBox();
  const kotakDaftar = await daftar.boundingBox();
  expect(kotakDaftar!.y).toBeGreaterThan(kotakKartu!.y + kotakKartu!.height);
  // Kartu menghitung baris yang sama dengan daftar.
  await expect(kartu).toContainText("Stok Varian 5 atau kurang");
  await expect(
    kartu.getByText(String(await daftar.getByRole("link").count()), {
      exact: true,
    }),
  ).toBeVisible();

  await barisTestIni
    .filter({ hasText: `Netflix Premium ${akhiran}` })
    .getByRole("link")
    .click();
  await expect(page).toHaveURL(
    `/admin/produk/${netflix}/varian/${idNetflixTigaBulan}`,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Varian 3 Bulan" }),
  ).toBeVisible();

  // Langkah 2: ambang 3. Netflix Premium 3 Bulan keluar, YouTube Premium 3 Bulan tetap ada.
  await simpanAmbang(page, "3");
  ({ kartu, daftar } = await bukaRingkasan(page));
  await expect(barisTestIni).toHaveText([
    `Spotify Premium ${akhiran}1 BulanStok 0`,
    `YouTube Premium ${akhiran}1 BulanStok 0`,
    `YouTube Premium ${akhiran}3 BulanStok 3`,
  ]);
  await expect(kartu).toContainText("Stok Varian 3 atau kurang");
  await expect(
    kartu.getByText(String(await daftar.getByRole("link").count()), {
      exact: true,
    }),
  ).toBeVisible();

  await simpanAmbang(page, "5");
});

// UAT-I2 langkah 3 dan PRD §9.4 ▶ Keputusan 2026-11-17: bilangan bulat 0 sampai 999.
for (const { ambang, pesan } of [
  {
    ambang: "1000",
    pesan:
      "Ambang stok menipis hanya boleh 0 sampai 999. Tulis angka di rentang itu, lalu simpan lagi.",
  },
  {
    ambang: "2,5",
    pesan:
      "Ambang stok menipis harus bilangan bulat, tanpa koma, titik, atau huruf. Tulis angka 0 sampai 999, misalnya 5, lalu simpan lagi.",
  },
]) {
  test(`Ambang stok menipis ${ambang} ditolak dengan pesan, dan nilai lama tetap tersimpan`, async ({
    page,
  }) => {
    await masukSebagaiAdmin(page);
    await bukaPengaturanToko(page);
    await simpanAmbang(page, "7");

    const isian = page.getByLabel("Ambang stok menipis");
    await isian.fill(ambang);
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(isian).toHaveAttribute("aria-invalid", "true");
    await expect(isian).toHaveAccessibleDescription(pesan);
    // Isian tetap berisi ketikan Admin supaya mudah diperbaiki.
    await expect(isian).toHaveValue(ambang);
    await expect(page.getByRole("status")).toHaveText("");

    await page.reload();
    await expect(page.getByLabel("Ambang stok menipis")).toHaveValue("7");

    await simpanAmbang(page, "5");
  });
}

test("Tamu yang membuka /admin/pengaturan diarahkan ke halaman login /admin", async ({
  page,
}) => {
  await page.goto("/admin/pengaturan");

  await expect(page).toHaveURL("/admin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Masuk ke dasbor admin" }),
  ).toBeVisible();
});
