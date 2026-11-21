import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test. Server e2e
// memakai Qrispy tiruan dari .env.ci (QRISPY_MODE=tiruan). Database dipakai bersama test lain yang berjalan bersamaan,
// jadi setiap test memakai Member dengan email unik.
import { db } from "../src/server/db";
import { riwayatSaldo, topUp, user } from "../src/server/db/schema";
import { prosesKabarPembayaranTopUp } from "../src/server/kabar-pembayaran-top-up";
import { buatTopUp } from "../src/server/top-up";
import { sisipkanMember } from "../src/server/uji-member";

// Halaman Top up dan Halaman bayar Top up (T77, PRD §15.3, §15.4, UAT-O2, UAT-O3), serta kabar pembayaran Top up
// lewat Qrispy tiruan, yang pemicu bayarnya ada di POST /api/qrispy-tiruan/bayar (T78, PRD §15.5).

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

const PASSWORD_MEMBER = "sandi-uji-member-123";
const ALAMAT_TOP_UP = "/akun/top-up";

/** Member baru dengan email unik, beserta id-nya. */
async function memberBaru() {
  const email = `budi-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return { email, id };
}

/** Login Member di halaman Masuk yang sedang terbuka. */
async function isiLogin(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();
}

const isi = (page: Page) => page.getByRole("main");
const formTopUp = (page: Page) =>
  isi(page).getByRole("form", { name: "Top up" });
const rincian = (page: Page) =>
  isi(page).getByRole("region", { name: "Rincian pembayaran" });
/** Pesan sekali tampil di Riwayat saldo (PRD §15.3). */
const pesanStatus = (page: Page) => isi(page).getByRole("status");

/** Top up itu langsung dari database. */
async function bacaTopUp(nomorTopUp: string) {
  const [baris] = await db
    .select({
      status: topUp.status,
      kodeUnik: topUp.kodeUnik,
      totalBayar: topUp.totalBayar,
      qrisId: topUp.qrisId,
    })
    .from(topUp)
    .where(eq(topUp.nomorTopUp, nomorTopUp));
  return baris;
}

const rupiah = (nilai: number) =>
  `Rp ${new Intl.NumberFormat("id-ID").format(nilai)}`;

// UAT-O2 langkah 2–3, PRD §15.3.
test("nominal di luar batas ditolak dengan pesan PRD, tombol cepat mengisi isian, lalu Top up Rp 10.000 membuka Halaman bayar Top up", async ({
  page,
}) => {
  const { email } = await memberBaru();
  // Tamu yang membuka Halaman Top up diarahkan ke Masuk, lalu kembali ke sini setelah login.
  await page.goto(ALAMAT_TOP_UP);
  await expect(page).toHaveURL(
    `/masuk?kembali=${encodeURIComponent(ALAMAT_TOP_UP)}`,
  );
  await isiLogin(page, email);
  await expect(page).toHaveURL(ALAMAT_TOP_UP);

  const form = formTopUp(page);
  const nominal = form.getByLabel("Nominal top up");
  const bayar = form.getByRole("button", { name: "Bayar dengan QRIS" });

  await nominal.fill("9999");
  await bayar.click();
  await expect(form).toContainText("Nominal top up minimal Rp 10.000.");
  await expect(nominal).toHaveAttribute("aria-invalid", "true");

  await nominal.fill("499001");
  await bayar.click();
  await expect(form).toContainText("Nominal top up maksimal Rp 499.000.");

  await nominal.fill("");
  await bayar.click();
  await expect(form).toContainText("Nominal top up belum diisi.");
  await expect(page).toHaveURL(ALAMAT_TOP_UP);

  await form.getByRole("button", { name: "Rp 50.000" }).click();
  await expect(nominal).toHaveValue("50000");
  await form.getByRole("button", { name: "Rp 200.000" }).click();
  await expect(nominal).toHaveValue("200000");

  await nominal.fill("10000");
  await bayar.click();
  await expect(page).toHaveURL(/\/akun\/top-up\/TOPUP-[A-Z2-9]{6}$/);
  const nomorTopUp = page.url().split("/").at(-1) ?? "";

  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();
  await expect(
    isi(page).getByRole("img", { name: `QRIS Top up ${nomorTopUp}` }),
  ).toBeVisible();
  await expect(
    isi(page).getByText("sisa waktu bayar", { exact: true }),
  ).toBeVisible();
  await expect(isi(page).getByRole("region", { name: "Top up" })).toContainText(
    nomorTopUp,
  );

  const dibuat = await bacaTopUp(nomorTopUp);
  expect(dibuat.status).toBe("Menunggu Pembayaran");
  await expect(
    rincian(page).getByRole("row", { name: /^Nominal top up/ }),
  ).toContainText("Rp 10.000");
  await expect(
    rincian(page).getByRole("row", { name: /^Kode unik/ }),
  ).toContainText(rupiah(dibuat.kodeUnik));
  await expect(
    rincian(page).getByRole("row", { name: /^Total bayar/ }),
  ).toContainText(rupiah(dibuat.totalBayar));
  await expect(
    isi(page).getByRole("link", { name: "Simpan gambar QR" }),
  ).toHaveAttribute("download", `QRIS-${nomorTopUp}.png`);
});

// UAT-O3 langkah 2–3, PRD §15.3.
test("Bayar dengan QRIS selagi Top up masih menunggu membuka Top up itu, lalu Batalkan membuatnya Dibatalkan dan membawa Member ke tab Akun", async ({
  page,
}) => {
  const { email } = await memberBaru();
  await page.goto("/masuk");
  await isiLogin(page, email);
  await expect(page).toHaveURL("/riwayat");

  await page.goto(ALAMAT_TOP_UP);
  await formTopUp(page).getByLabel("Nominal top up").fill("10000");
  await formTopUp(page)
    .getByRole("button", { name: "Bayar dengan QRIS" })
    .click();
  await expect(page).toHaveURL(/\/akun\/top-up\/TOPUP-[A-Z2-9]{6}$/);
  const pertama = page.url();

  await page.goto(ALAMAT_TOP_UP);
  await formTopUp(page).getByLabel("Nominal top up").fill("20000");
  await formTopUp(page)
    .getByRole("button", { name: "Bayar dengan QRIS" })
    .click();
  await expect(page).toHaveURL(pertama);
  await expect(
    rincian(page).getByRole("row", { name: /^Nominal top up/ }),
  ).toContainText("Rp 10.000");

  await isi(page).getByRole("button", { name: "Batalkan" }).click();
  await expect(page).toHaveURL("/akun");
  const nomorTopUp = pertama.split("/").at(-1) ?? "";
  expect((await bacaTopUp(nomorTopUp)).status).toBe("Dibatalkan");

  // Top up yang sudah Dibatalkan tidak tampil lagi bagi Member.
  await page.goto(pertama);
  await expect(page).toHaveURL("/akun");
});

test("Tamu dan Member lain tidak bisa membuka Halaman bayar Top up milik orang lain", async ({
  page,
}) => {
  const pemilik = await memberBaru();
  const hasil = await buatTopUp({ idMember: pemilik.id, nominal: "10000" });
  if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);
  const alamat = `${ALAMAT_TOP_UP}/${hasil.nomorTopUp}`;

  // Tamu diarahkan ke Masuk.
  await page.goto(alamat);
  await expect(page).toHaveURL(`/masuk?kembali=${encodeURIComponent(alamat)}`);

  // Member lain melihat halaman tidak ditemukan, tanpa QR dan rincian Top up itu.
  const lain = await memberBaru();
  await isiLogin(page, lain.email);
  await expect(page).toHaveURL(alamat);
  const respons = await page.goto(alamat);
  expect(respons?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Top up tidak ditemukan" }),
  ).toBeVisible();
  await expect(isi(page)).not.toContainText(hasil.nomorTopUp);
  await expect(isi(page).getByRole("img", { name: /QRIS/ })).toHaveCount(0);

  // Top up itu tetap Menunggu Pembayaran.
  expect((await bacaTopUp(hasil.nomorTopUp)).status).toBe(
    "Menunggu Pembayaran",
  );
});

// UAT-O3 langkah 1 dan 3, PRD §15.10 (issue T79): tombol "Top up" dan "Lanjutkan bayar" di tab Akun.
test('tab Akun menampilkan tombol "Top up", lalu selama Top up menunggu tampil "Top up Rp 10.000 menunggu pembayaran" dengan tombol "Lanjutkan bayar" yang membuka Halaman bayar Top up', async ({
  page,
}) => {
  const { email } = await memberBaru();
  await page.goto("/masuk");
  await isiLogin(page, email);
  await expect(page).toHaveURL("/riwayat");

  await page.goto("/akun");
  const kotak = isi(page).getByRole("region", { name: "Saldo", exact: true });
  await expect(kotak).not.toContainText("menunggu pembayaran");
  await expect(
    kotak.getByRole("link", { name: "Lanjutkan bayar" }),
  ).toHaveCount(0);
  await kotak.getByRole("link", { name: "Top up", exact: true }).click();
  await expect(page).toHaveURL(ALAMAT_TOP_UP);

  await formTopUp(page).getByLabel("Nominal top up").fill("10000");
  await formTopUp(page)
    .getByRole("button", { name: "Bayar dengan QRIS" })
    .click();
  await expect(page).toHaveURL(/\/akun\/top-up\/TOPUP-[A-Z2-9]{6}$/);
  const halamanBayar = page.url();

  await page.goto("/akun");
  await expect(kotak).toContainText("Top up Rp 10.000 menunggu pembayaran");
  await kotak.getByRole("link", { name: "Lanjutkan bayar" }).click();
  await expect(page).toHaveURL(halamanBayar);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();

  // Setelah dibatalkan, tulisan menunggu hilang.
  await isi(page).getByRole("button", { name: "Batalkan" }).click();
  await expect(page).toHaveURL("/akun");
  await expect(kotak).not.toContainText("menunggu pembayaran");
  await expect(
    kotak.getByRole("link", { name: "Lanjutkan bayar" }),
  ).toHaveCount(0);
});

/** Saldo Member itu dan baris Riwayat saldo-nya, langsung dari database. */
async function saldoDanRiwayat(idMember: string) {
  const [{ saldo }] = await db
    .select({ saldo: user.saldo })
    .from(user)
    .where(eq(user.id, idMember));
  const riwayat = await db
    .select({
      jenis: riwayatSaldo.jenis,
      nominal: riwayatSaldo.nominal,
      rujukan: riwayatSaldo.rujukan,
    })
    .from(riwayatSaldo)
    .where(eq(riwayatSaldo.userId, idMember));
  return { saldo, riwayat };
}

// UAT-O2 langkah 3–4, PRD §15.3, §15.5 (issue T78).
test("Top up Rp 10.000 yang dibayar lewat Qrispy tiruan menambah saldo tepat Rp 10.000, lalu Halaman bayar Top up berpindah sendiri ke Riwayat saldo dengan pesan PRD", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const { email, id } = await memberBaru();
  await page.goto("/masuk");
  await isiLogin(page, email);
  await expect(page).toHaveURL("/riwayat");

  await page.goto(ALAMAT_TOP_UP);
  await formTopUp(page).getByLabel("Nominal top up").fill("10000");
  await formTopUp(page)
    .getByRole("button", { name: "Bayar dengan QRIS" })
    .click();
  await expect(page).toHaveURL(/\/akun\/top-up\/TOPUP-[A-Z2-9]{6}$/);
  const nomorTopUp = page.url().split("/").at(-1) ?? "";
  const dibuat = await bacaTopUp(nomorTopUp);
  expect(dibuat.totalBayar).toBeGreaterThan(10000);

  const respons = await request.post("/api/qrispy-tiruan/bayar", {
    data: { qrisId: dibuat.qrisId, amount: dibuat.totalBayar },
  });
  expect(respons.status()).toBe(200);

  // Status QRIS ditanyakan ke Qrispy paling sering sekali per 15 detik, dan sekali sudah ditanyakan saat halaman
  // dibuka (ADR-0004), jadi pembayarannya terbaca paling lambat sekitar 15 detik kemudian.
  await expect(page).toHaveURL("/akun/riwayat-saldo", { timeout: 25_000 });
  await expect(pesanStatus(page)).toHaveText(
    "Top up Rp 10.000 berhasil. Saldo sekarang Rp 10.000.",
  );
  await expect(isi(page)).toContainText(nomorTopUp);

  expect(await saldoDanRiwayat(id)).toEqual({
    saldo: 10000,
    riwayat: [{ jenis: "Top up", nominal: 10000, rujukan: nomorTopUp }],
  });
  expect((await bacaTopUp(nomorTopUp)).status).toBe("Berhasil");

  // PRD §15.3 ▶ Keputusan 2026-11-21 (#240): pesan itu hanya muncul sekali. Riwayat saldo yang dimuat ulang atau
  // dibuka lagi tidak menampilkannya.
  await page.reload();
  await expect(isi(page)).toContainText(nomorTopUp);
  await expect(pesanStatus(page)).toHaveCount(0);
  await page.goto("/akun");
  await page.goto("/akun/riwayat-saldo");
  await expect(isi(page)).toContainText(nomorTopUp);
  await expect(pesanStatus(page)).toHaveCount(0);

  // Halaman bayar Top up yang dibuka lagi membawa Member ke Riwayat saldo tanpa pesan itu, dan tanpa menambah saldo
  // lagi.
  await page.goto(`${ALAMAT_TOP_UP}/${nomorTopUp}`);
  await expect(page).toHaveURL("/akun/riwayat-saldo");
  await expect(isi(page)).toContainText(nomorTopUp);
  await expect(pesanStatus(page)).toHaveCount(0);
  expect((await saldoDanRiwayat(id)).saldo).toBe(10000);
});

/** Pesan penjelas PRD §15.3 ▶ Keputusan 2026-11-21 (#240) setelah "Batalkan" untuk Top up yang sudah dibayar. */
const PESAN_SUDAH_DIBAYAR =
  "Pembayaran Anda sudah masuk, jadi Top up tidak dibatalkan.";

/**
 * Login sebagai Member baru, lalu membuat Top up Rp 10.000 sampai Halaman bayar Top up terbuka. Halaman itu tidak
 * menanyakan statusnya ke server toko, supaya pembayaran yang dicatat test hanya terbaca lewat "Batalkan".
 */
async function bukaHalamanBayarTopUp(page: Page) {
  const member = await memberBaru();
  await page.route("**/akun/top-up/*/status", (rute) => rute.abort());
  await page.goto("/masuk");
  await isiLogin(page, member.email);
  await expect(page).toHaveURL("/riwayat");
  await page.goto(ALAMAT_TOP_UP);
  await formTopUp(page).getByLabel("Nominal top up").fill("10000");
  await formTopUp(page)
    .getByRole("button", { name: "Bayar dengan QRIS" })
    .click();
  await expect(page).toHaveURL(/\/akun\/top-up\/TOPUP-[A-Z2-9]{6}$/);
  const nomorTopUp = page.url().split("/").at(-1) ?? "";
  return { ...member, nomorTopUp, ...(await bacaTopUp(nomorTopUp)) };
}

// PRD §15.3 ▶ Keputusan 2026-11-21 (#240) (issue T78-b).
test("Batalkan yang ditolak Qrispy tiruan karena Top up sudah dibayar dengan nominal cukup membawa Member ke Riwayat saldo dengan pesan penjelas tanpa pesan berhasil, sekali saja, dan Top up Berhasil", async ({
  page,
  request,
}) => {
  const dibuka = await bukaHalamanBayarTopUp(page);
  const respons = await request.post("/api/qrispy-tiruan/bayar", {
    data: { qrisId: dibuka.qrisId, amount: dibuka.totalBayar },
  });
  expect(respons.status()).toBe(200);

  await isi(page).getByRole("button", { name: "Batalkan" }).click();

  await expect(page).toHaveURL("/akun/riwayat-saldo");
  await expect(pesanStatus(page)).toHaveText(PESAN_SUDAH_DIBAYAR);
  await expect(isi(page)).not.toContainText("berhasil. Saldo sekarang");
  await expect(isi(page)).toContainText(dibuka.nomorTopUp);
  expect((await bacaTopUp(dibuka.nomorTopUp)).status).toBe("Berhasil");
  expect((await saldoDanRiwayat(dibuka.id)).saldo).toBe(10000);

  await page.reload();
  await expect(isi(page)).toContainText(dibuka.nomorTopUp);
  await expect(pesanStatus(page)).toHaveCount(0);
});

// PRD §15.3 ▶ Keputusan 2026-11-21 (#240) (issue T78-b).
test("Batalkan yang ditolak Qrispy tiruan karena Top up sudah dibayar dengan nominal kurang membawa Member ke Halaman Top up Bermasalah tanpa pesan penjelas", async ({
  page,
  request,
}) => {
  const dibuka = await bukaHalamanBayarTopUp(page);
  const respons = await request.post("/api/qrispy-tiruan/bayar", {
    data: { qrisId: dibuka.qrisId, amount: 10000 },
  });
  expect(respons.status()).toBe(200);

  await isi(page).getByRole("button", { name: "Batalkan" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Top up" }),
  ).toBeVisible();
  await expect(page).toHaveURL(`${ALAMAT_TOP_UP}/${dibuka.nomorTopUp}`);
  await expect(isi(page)).toContainText(
    "Pembayaran Anda sudah kami terima, tetapi saldo belum bertambah. Hubungi kami lewat WhatsApp.",
  );
  await expect(isi(page)).not.toContainText(PESAN_SUDAH_DIBAYAR);
  expect((await bacaTopUp(dibuka.nomorTopUp)).status).toBe("Bermasalah");
  expect((await saldoDanRiwayat(dibuka.id)).saldo).toBe(0);
});

// PRD §15.3 ▶ Keputusan 2026-11-21 (#240) (issue T78-b): pembayarannya tercatat sebelum "Batalkan" diproses.
test("Batalkan untuk Top up yang sudah Berhasil menampilkan pesan penjelas yang sama, dan Top up tidak dibatalkan", async ({
  page,
}) => {
  const dibuka = await bukaHalamanBayarTopUp(page);
  expect(
    await prosesKabarPembayaranTopUp({
      qrisId: dibuka.qrisId,
      nominalDiterima: dibuka.totalBayar,
      waktuBayar: new Date(),
    }),
  ).toEqual({ hasil: "diproses" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();

  await isi(page).getByRole("button", { name: "Batalkan" }).click();

  await expect(page).toHaveURL("/akun/riwayat-saldo");
  await expect(pesanStatus(page)).toHaveText(PESAN_SUDAH_DIBAYAR);
  expect((await bacaTopUp(dibuka.nomorTopUp)).status).toBe("Berhasil");
  expect((await saldoDanRiwayat(dibuka.id)).saldo).toBe(10000);
});

// PRD §15.4, §15.5 butir 2, dan pola Halaman Pesanan Bermasalah (§6.2) (issue T78).
test("Top up yang dibayar dengan nominal kurang lewat Qrispy tiruan menampilkan Halaman Top up Bermasalah, dan saldo tidak berubah", async ({
  page,
  request,
}) => {
  const { email, id } = await memberBaru();
  const hasil = await buatTopUp({ idMember: id, nominal: "10000" });
  if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);
  const dibuat = await bacaTopUp(hasil.nomorTopUp);
  const respons = await request.post("/api/qrispy-tiruan/bayar", {
    data: { qrisId: dibuat.qrisId, amount: 10000 },
  });
  expect(respons.status()).toBe(200);

  const alamat = `${ALAMAT_TOP_UP}/${hasil.nomorTopUp}`;
  await page.goto(alamat);
  await isiLogin(page, email);
  await expect(page).toHaveURL(alamat);

  await expect(
    page.getByRole("heading", { level: 1, name: "Top up" }),
  ).toBeVisible();
  await expect(isi(page)).toContainText(hasil.nomorTopUp);
  await expect(
    isi(page).getByText("Bermasalah", { exact: true }),
  ).toBeVisible();
  await expect(isi(page)).toContainText(
    "Pembayaran Anda sudah kami terima, tetapi saldo belum bertambah. Hubungi kami lewat WhatsApp.",
  );
  await expect(isi(page).getByRole("img", { name: /QRIS/ })).toHaveCount(0);
  await expect(
    rincian(page).getByRole("row", { name: /^Total bayar/ }),
  ).toContainText(rupiah(dibuat.totalBayar));

  expect((await bacaTopUp(hasil.nomorTopUp)).status).toBe("Bermasalah");
  expect(await saldoDanRiwayat(id)).toEqual({ saldo: 0, riwayat: [] });
});
