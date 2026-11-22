import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test. Database itu
// dipakai bersama test lain yang berjalan bersamaan, jadi setiap test memakai Member dengan email unik. Top up dibuat
// dan dibayar langsung lewat fungsi server dengan Qrispy tiruan di proses test ini.
import { db } from "../src/server/db";
import { topUp, user } from "../src/server/db/schema";
import { prosesKabarPembayaranTopUp } from "../src/server/kabar-pembayaran-top-up";
import type { Qrispy } from "../src/server/qrispy";
import { qrispyTiruan } from "../src/server/qrispy-tiruan";
import { batalkanTopUp, buatTopUp } from "../src/server/top-up";
import { sisipkanMember } from "../src/server/uji-member";

// Menu Top up di dasbor admin dan penyelesaian Top up Bermasalah (T79, PRD §15.4, §15.9, UAT-O4, UAT-O5).

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

const PASSWORD_ADMIN = "sandi-uji-admin-123";
const ALAMAT = "/admin/top-up";
const MUAT = { timeout: 15_000 };

// Membuat Admin persis seperti pemilik di server: `pnpm admin:buat <email>`, password lewat input.
function buatAdminLewatPerintah() {
  const email = `admin-${randomUUID()}@example.test`;
  const hasil = spawnSync("pnpm", ["--silent", "admin:buat", email], {
    input: `${PASSWORD_ADMIN}\n${PASSWORD_ADMIN}\n`,
    encoding: "utf8",
  });
  expect(hasil.status, hasil.stderr).toBe(0);
  return email;
}

async function masukSebagaiAdmin(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(buatAdminLewatPerintah());
  await page.getByLabel("Password").fill(PASSWORD_ADMIN);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/admin/ringkasan");
}

const isi = (page: Page) => page.getByRole("main");

/** Teks setiap sel sebuah baris tabel, termasuk sel kepala baris. */
const teksSel = (baris: Locator) =>
  baris
    .locator("th, td")
    .evaluateAll((sel) =>
      sel.map((s) => (s.textContent ?? "").replace(/\s+/g, " ").trim()),
    );

const rupiah = (nilai: number) =>
  `Rp ${new Intl.NumberFormat("id-ID").format(nilai)}`;

/** Member baru dengan email unik, beserta id-nya. */
async function memberBaru() {
  const email = `topup-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return { email, id };
}

/** Qrispy tiruan yang menerbitkan QRIS dengan Kode unik itu. */
function qrispyKodeUnik(kodeUnik: number) {
  return {
    ...qrispyTiruan,
    buatQris: async (masukan) => ({
      ...(await qrispyTiruan.buatQris(masukan)),
      amount: masukan.amount + kodeUnik,
      uniqueId: kodeUnik,
    }),
  } satisfies Qrispy;
}

/** Top up Menunggu Pembayaran baru milik Member itu, dengan Kode unik itu. */
async function topUpMenunggu(
  idMember: string,
  nominalTopUp: number,
  kodeUnik: number,
) {
  const qrispy = qrispyKodeUnik(kodeUnik);
  const hasil = await buatTopUp(
    { idMember, nominal: String(nominalTopUp) },
    { qrispy },
  );
  if (hasil.hasil !== "dibuat") throw new Error(`Top up gagal: ${hasil.hasil}`);
  const [{ qrisId }] = await db
    .select({ qrisId: topUp.qrisId })
    .from(topUp)
    .where(eq(topUp.nomorTopUp, hasil.nomorTopUp));
  return { nomorTopUp: hasil.nomorTopUp, qrisId, qrispy };
}

/** Top up yang dibayar dengan nominal itu lewat kabar pembayaran Qrispy. */
async function topUpDibayar(
  idMember: string,
  {
    nominalTopUp,
    kodeUnik,
    nominalDiterima,
  }: { nominalTopUp: number; kodeUnik: number; nominalDiterima: number },
) {
  const menunggu = await topUpMenunggu(idMember, nominalTopUp, kodeUnik);
  await prosesKabarPembayaranTopUp({
    qrisId: menunggu.qrisId,
    nominalDiterima,
    waktuBayar: new Date(),
  });
  return menunggu.nomorTopUp;
}

/** Top up Bermasalah seperti seed [CONTOH]: Rp 50.000, Total bayar Rp 50.123, nominal diterima Rp 50.000. */
const topUpBermasalah = (idMember: string) =>
  topUpDibayar(idMember, {
    nominalTopUp: 50000,
    kodeUnik: 123,
    nominalDiterima: 50000,
  });

/** Status Top up itu dan saldo Member pemiliknya, langsung dari database. */
async function statusDanSaldo(nomorTopUp: string) {
  const [baris] = await db
    .select({ status: topUp.status, saldo: user.saldo })
    .from(topUp)
    .innerJoin(user, eq(topUp.userId, user.id))
    .where(eq(topUp.nomorTopUp, nomorTopUp));
  return baris;
}

// PRD §11.1 ▶ Keputusan 2026-11-20 (#226), §15.9.
test("menu samping menampilkan Top up tepat di bawah Member dan membuka daftar Top up", async ({
  page,
}) => {
  await masukSebagaiAdmin(page);
  const menu = page.getByRole("navigation", { name: "Menu admin" });

  await expect(menu.getByRole("listitem")).toHaveText([
    "Ringkasan",
    "Laporan keuangan",
    /^Pesanan/,
    "Member",
    "Top up",
    "Kategori",
    "Produk",
    "Item stok",
    "Voucher",
    "Pengaturan toko",
  ]);

  await menu.getByRole("link", { name: "Top up" }).click();
  await expect(page).toHaveURL(ALAMAT, MUAT);
  await expect(
    page.getByRole("heading", { level: 1, name: "Top up" }),
  ).toBeVisible();
  await expect(menu.getByRole("link", { name: "Top up" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

// UAT-O4 langkah 1–2, PRD §15.9.
test("daftar memuat Top up semua status, yang terbaru di atas, lalu saringan Berhasil dan pencarian sebagian email berhuruf besar hanya menampilkan Top up yang cocok", async ({
  page,
}) => {
  const { email, id } = await memberBaru();
  const berhasil = await topUpDibayar(id, {
    nominalTopUp: 10000,
    kodeUnik: 77,
    nominalDiterima: 10077,
  });
  const dibatalkan = await topUpMenunggu(id, 20000, 88);
  await batalkanTopUp(
    { nomorTopUp: dibatalkan.nomorTopUp, idMember: id },
    { qrispy: dibatalkan.qrispy },
  );
  const bermasalah = await topUpBermasalah(id);

  await masukSebagaiAdmin(page);
  // Sebagian email Member ini dengan huruf besar, misalnya "TOPUP-1A2B3C4D".
  const sebagianEmail = email.slice(0, 14).toUpperCase();
  await page.goto(`${ALAMAT}?cari=${encodeURIComponent(sebagianEmail)}`, MUAT);

  const tabel = isi(page).getByRole("table", { name: "Daftar Top up" });
  await expect(tabel.getByRole("columnheader")).toHaveText([
    "Nomor Top up",
    "Waktu dibuat (WIB)",
    "Email Member",
    "Nominal top up",
    "Total bayar",
    "Status",
  ]);
  const baris = tabel.locator("tbody tr");
  await expect(baris).toHaveCount(3);
  expect(await teksSel(baris.nth(0))).toEqual([
    bermasalah,
    expect.stringMatching(/\d/),
    email,
    "Rp 50.000",
    "Rp 50.123",
    "Bermasalah",
  ]);
  expect((await teksSel(baris.nth(1)))[0]).toBe(dibatalkan.nomorTopUp);
  expect((await teksSel(baris.nth(1)))[5]).toBe("Dibatalkan");
  expect(await teksSel(baris.nth(2))).toEqual([
    berhasil,
    expect.stringMatching(/\d/),
    email,
    "Rp 10.000",
    "Rp 10.077",
    "Berhasil",
  ]);
  // Top up Bermasalah ditonjolkan dengan warna status Bermasalah.
  await expect(
    baris.nth(0).getByText("Bermasalah", { exact: true }),
  ).toHaveClass(/text-st-masalah/);

  const form = isi(page).getByRole("search", { name: "Saring Top up" });
  await expect(form.getByLabel("Cari")).toHaveValue(sebagianEmail);
  await form.getByLabel("Status").selectOption("Berhasil");
  await form.getByRole("button", { name: "Saring" }).click();
  await expect(page).toHaveURL(/status=Berhasil/, MUAT);
  await expect(baris).toHaveCount(1);
  expect((await teksSel(baris.nth(0)))[0]).toBe(berhasil);
});

// UAT-O4 langkah 3, PRD §15.9.
test("detail Top up yang sudah dibayar menampilkan rincian, nominal diterima, Biaya transaksi, riwayat status dengan pelakunya, dan tautan ke halaman Member", async ({
  page,
}) => {
  const { email, id } = await memberBaru();
  const nomorTopUp = await topUpDibayar(id, {
    nominalTopUp: 10000,
    kodeUnik: 77,
    nominalDiterima: 10077,
  });
  const [{ biayaTransaksi }] = await db
    .select({ biayaTransaksi: topUp.biayaTransaksi })
    .from(topUp)
    .where(eq(topUp.nomorTopUp, nomorTopUp));

  await masukSebagaiAdmin(page);
  await page.goto(`${ALAMAT}?cari=${nomorTopUp}`, MUAT);
  await isi(page).getByRole("link", { name: nomorTopUp }).click();
  await expect(page).toHaveURL(`${ALAMAT}/${nomorTopUp}`, MUAT);

  await expect(
    page.getByRole("heading", { level: 1, name: nomorTopUp }),
  ).toBeVisible();
  const rincian = isi(page).getByRole("region", { name: "Rincian pembayaran" });
  for (const [label, nilai] of [
    ["Nominal top up", "Rp 10.000"],
    ["Kode unik", "Rp 77"],
    ["Total bayar", "Rp 10.077"],
    ["Nominal diterima", "Rp 10.077"],
    ["Biaya transaksi", rupiah(biayaTransaksi ?? -1)],
  ]) {
    await expect(
      rincian.getByRole("row", { name: new RegExp(`^${label}`) }),
    ).toContainText(nilai);
  }

  const riwayat = isi(page).getByRole("table", {
    name: "Riwayat perubahan status",
  });
  const barisRiwayat = riwayat.locator("tbody tr");
  await expect(barisRiwayat).toHaveCount(2);
  expect((await teksSel(barisRiwayat.nth(0))).slice(1)).toEqual([
    "Menunggu Pembayaran",
    "Member",
  ]);
  expect((await teksSel(barisRiwayat.nth(1))).slice(1)).toEqual([
    "Berhasil",
    "Qrispy",
  ]);

  // Top up Berhasil tidak punya aksi penyelesaian.
  await expect(
    isi(page).getByRole("button", { name: "Tambahkan ke saldo" }),
  ).toHaveCount(0);

  await isi(page)
    .getByRole("region", { name: "Top up", exact: true })
    .getByRole("link", { name: email })
    .click();
  await expect(page).toHaveURL(`/admin/member/${id}`, MUAT);
});

// UAT-O5 langkah 2, PRD §15.9.
test('"Tambahkan ke saldo" ditegaskan lebih dulu, lalu menjadikan Top up Bermasalah Berhasil dengan pelaku Admin dan menambah saldo Rp 50.000', async ({
  page,
}) => {
  const { email, id } = await memberBaru();
  const nomorTopUp = await topUpBermasalah(id);

  await masukSebagaiAdmin(page);
  await page.goto(`${ALAMAT}/${nomorTopUp}`, MUAT);
  const panel = isi(page).getByRole("region", {
    name: "Selesaikan Top up Bermasalah",
  });
  await expect(
    isi(page).getByRole("region", { name: "Rincian pembayaran" }),
  ).toContainText("Rp 50.000");

  // Batal pada Modal penegasan tidak mengubah apa pun (PRD §9.10).
  await panel.getByRole("button", { name: "Tambahkan ke saldo" }).click();
  const modal = page.getByRole("alertdialog", { name: "Tambahkan ke saldo?" });
  await expect(modal).toContainText(
    `Tambahkan Rp 50.000 ke saldo ${email}? Top up ini menjadi Berhasil, dan Riwayat saldo mencatat baris Top up. Aksi ini tidak bisa dibatalkan.`,
  );
  await modal.getByRole("button", { name: "Batal" }).click();
  await expect(modal).toHaveCount(0);
  expect(await statusDanSaldo(nomorTopUp)).toEqual({
    status: "Bermasalah",
    saldo: 0,
  });

  await panel.getByRole("button", { name: "Tambahkan ke saldo" }).click();
  await modal.getByRole("button", { name: "Ya, tambahkan ke saldo" }).click();
  await expect(panel).toHaveCount(0, MUAT);
  await expect(isi(page).locator("h1 + div")).toHaveText("Berhasil");
  const barisRiwayat = isi(page)
    .getByRole("table", { name: "Riwayat perubahan status" })
    .locator("tbody tr");
  await expect(barisRiwayat).toHaveCount(3);
  expect((await teksSel(barisRiwayat.nth(2))).slice(1)).toEqual([
    "Berhasil",
    "Admin",
  ]);
  expect(await statusDanSaldo(nomorTopUp)).toEqual({
    status: "Berhasil",
    saldo: 50000,
  });
});

// UAT-O5 langkah 3, PRD §15.9.
test('"Tandai Dana Dikembalikan" ditegaskan lebih dulu, lalu menjadikan Top up Bermasalah Dana Dikembalikan tanpa mengubah saldo', async ({
  page,
}) => {
  const { email, id } = await memberBaru();
  const nomorTopUp = await topUpBermasalah(id);

  await masukSebagaiAdmin(page);
  await page.goto(`${ALAMAT}/${nomorTopUp}`, MUAT);
  const panel = isi(page).getByRole("region", {
    name: "Selesaikan Top up Bermasalah",
  });
  await panel.getByRole("button", { name: "Tandai Dana Dikembalikan" }).click();
  const modal = page.getByRole("alertdialog", {
    name: "Tandai Dana Dikembalikan?",
  });
  await expect(modal).toContainText(
    `Tandai Top up ini Dana Dikembalikan? Saldo ${email} tidak bertambah, jadi pastikan uangnya sudah dikembalikan di luar sistem. Aksi ini tidak bisa dibatalkan.`,
  );
  expect(await statusDanSaldo(nomorTopUp)).toEqual({
    status: "Bermasalah",
    saldo: 0,
  });
  await modal
    .getByRole("button", { name: "Ya, tandai Dana Dikembalikan" })
    .click();
  await expect(panel).toHaveCount(0, MUAT);
  await expect(isi(page).locator("h1 + div")).toHaveText("Dana Dikembalikan");
  expect(await statusDanSaldo(nomorTopUp)).toEqual({
    status: "Dana Dikembalikan",
    saldo: 0,
  });
});
