import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { eq, sql } from "drizzle-orm";

import { db } from "../src/server/db";
import { pendaftar } from "../src/server/db/schema";

// Memasukkan Kode verifikasi (T43, PRD §7.3, §7.7). Server e2e memakai jam asli, jadi waktu kirim kode
// dimundurkan langsung di database untuk meniru kode yang dikirim beberapa menit lalu. Kode dibaca dari
// email tiruan lewat /api/email-tiruan. Batas tepat 10 menit diuji di test integrasi dengan jam palsu
// (src/server/auth/pendaftaran.test.ts).
const PASSWORD = "sandi-uji-kode-1";
const PESAN_KODE_SALAH =
  "Kode verifikasi salah. Periksa lagi kode di email terakhir dari kami.";
const PESAN_KODE_KEDALUWARSA =
  "Kode verifikasi sudah kedaluwarsa. Tekan Kirim ulang kode untuk menerima kode baru.";
const PESAN_KODE_HANGUS =
  "Kode verifikasi salah 5 kali, jadi kode ini tidak berlaku lagi. Tekan Kirim ulang kode untuk menerima kode baru.";
const PESAN_EMAIL_TERDAFTAR =
  "Email ini sudah terdaftar. Masuk dengan email ini, atau pakai Lupa password bila lupa password-nya.";

const emailBaru = () => `pendaftar-${randomUUID()}@example.test`;

async function daftar(page: Page, email: string) {
  await page.goto("/daftar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page).toHaveURL("/daftar/verifikasi");
}

/** Kode dari email "Kode verifikasi: <kode>" terakhir yang dikirim server e2e ke alamat itu. */
async function kodeTerakhir(request: APIRequestContext, kepada: string) {
  const respons = await request.get(
    `/api/email-tiruan?kepada=${encodeURIComponent(kepada)}`,
  );
  const isi = (await respons.json()) as { subjek: string }[];
  const cocok = /^Kode verifikasi: (\d{6})$/.exec(isi.at(-1)?.subjek ?? "");
  if (!cocok) throw new Error(`Belum ada email Kode verifikasi ke ${kepada}.`);
  return cocok[1];
}

/** Memundurkan waktu kirim kode terakhir Pendaftar itu sebanyak `detik`. */
async function mundurkanKode(email: string, detik: number) {
  await db
    .update(pendaftar)
    .set({
      kodeDikirimPada: sql`${pendaftar.kodeDikirimPada} - make_interval(secs => ${detik})`,
    })
    .where(eq(pendaftar.email, email));
}

async function masukkanKode(page: Page, kode: string) {
  // Tunggu kiriman sebelumnya selesai, karena form dikosongkan setelah setiap kiriman.
  const tombol = page.getByRole("button", { name: "Verifikasi" });
  await expect(tombol).toBeEnabled();
  await page.getByLabel("Kode verifikasi").fill(kode);
  await tombol.click();
}

/** Menekan "Kirim ulang kode" setelah jeda 60 detik dilewati dengan memundurkan kode terakhir. */
async function kirimUlangSetelahJeda(page: Page, email: string) {
  await mundurkanKode(email, 61);
  await page.getByRole("button", { name: "Kirim ulang kode" }).click();
}

const peringatan = (page: Page) => page.getByRole("main").getByRole("alert");
const kodeLainDari = (kode: string) =>
  kode === "000000" ? "111111" : "000000";

test("kode benar pada menit ke-9 mengaktifkan akun: Pendaftar langsung masuk sebagai Member dan dibawa ke Riwayat Pesanan", async ({
  page,
  request,
}) => {
  const email = emailBaru();
  await daftar(page, email);
  await mundurkanKode(email, 9 * 60);

  await masukkanKode(page, await kodeTerakhir(request, email));

  await expect(page).toHaveURL("/riwayat");
  await page.goto("/akun");
  await expect(page.getByRole("main").getByText(email)).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("button", { name: "Keluar" }),
  ).toBeVisible();

  // Setelah aktif, Member bisa login dengan password-nya dan email itu tidak bisa didaftarkan lagi.
  await page.getByRole("main").getByRole("button", { name: "Keluar" }).click();
  await expect(
    page.getByRole("main").getByRole("button", { name: "Keluar" }),
  ).toHaveCount(0);
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");

  await page.goto("/daftar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("sandi-uji-kode-2");
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(peringatan(page)).toHaveText(PESAN_EMAIL_TERDAFTAR);
});

test("kode salah dan kode kedaluwarsa ditolak dengan pesannya masing-masing", async ({
  page,
  request,
}) => {
  const email = emailBaru();
  await daftar(page, email);
  const kode = await kodeTerakhir(request, email);

  await masukkanKode(page, kodeLainDari(kode));
  await expect(peringatan(page)).toHaveText(PESAN_KODE_SALAH);

  await mundurkanKode(email, 11 * 60);
  await masukkanKode(page, kode);
  await expect(peringatan(page)).toHaveText(PESAN_KODE_KEDALUWARSA);
  await expect(page).toHaveURL("/daftar/verifikasi");
});

test("isian kosong atau bukan 6 angka ditolak dengan pesan di bawah isian", async ({
  page,
}) => {
  await daftar(page, emailBaru());

  await masukkanKode(page, "");
  await expect(page.getByText("Kode verifikasi belum diisi.")).toBeVisible();

  await masukkanKode(page, "12a4");
  await expect(
    page.getByText("Kode verifikasi terdiri dari 6 angka."),
  ).toBeVisible();
});

// UAT-G4 langkah 3.
test("setelah 5 kali salah, kode yang benar pun ditolak karena hangus; kode baru dari Kirim ulang kode diterima", async ({
  page,
  request,
}) => {
  const email = emailBaru();
  await daftar(page, email);
  const kode = await kodeTerakhir(request, email);

  for (let ke = 1; ke <= 5; ke++) {
    await masukkanKode(page, kodeLainDari(kode));
    await expect(peringatan(page)).toHaveText(PESAN_KODE_SALAH);
  }
  await masukkanKode(page, kode);
  await expect(peringatan(page)).toHaveText(PESAN_KODE_HANGUS);

  await kirimUlangSetelahJeda(page, email);
  // PRD §7.3 ▶ Keputusan 2026-11-17 (#174): pesan kode hangus hilang, hanya kabar kode baru yang tampil.
  await expect(peringatan(page)).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    `Kode verifikasi baru sudah kami kirim ke ${email}.`,
  );

  await masukkanKode(page, await kodeTerakhir(request, email));
  await expect(page).toHaveURL("/riwayat");
});

test('pesan "Kode verifikasi salah." hilang setelah Kirim ulang kode berhasil', async ({
  page,
  request,
}) => {
  const email = emailBaru();
  await daftar(page, email);
  const kode = await kodeTerakhir(request, email);

  await masukkanKode(page, kodeLainDari(kode));
  await expect(peringatan(page)).toHaveText(PESAN_KODE_SALAH);

  await kirimUlangSetelahJeda(page, email);
  await expect(peringatan(page)).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    `Kode verifikasi baru sudah kami kirim ke ${email}.`,
  );
});

test("Kirim ulang kode yang ditolak karena jeda 60 detik membiarkan pesan kode sebelumnya", async ({
  page,
  request,
}) => {
  const email = emailBaru();
  await daftar(page, email);
  const kode = await kodeTerakhir(request, email);

  await masukkanKode(page, kodeLainDari(kode));
  await page.getByRole("button", { name: "Kirim ulang kode" }).click();

  await expect(
    page.getByRole("main").getByText("Kode verifikasi baru bisa dikirim lagi"),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByText(PESAN_KODE_SALAH),
  ).toBeVisible();
});
