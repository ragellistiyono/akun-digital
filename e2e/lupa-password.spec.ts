import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { eq, sql } from "drizzle-orm";

import { db } from "../src/server/db";
import { tautanAturUlangPassword, user } from "../src/server/db/schema";
import { sisipkanMember } from "../src/server/uji-member";

// Lupa password (T49, PRD §7.5 ▶ Keputusan 2026-11-17, UAT-G5). Server e2e memakai email tiruan dari .env.ci
// (EMAIL_MODE=tiruan), jadi tautan dibaca dari email lewat /api/email-tiruan. Tautan di email memakai
// APP_URL dari .env.ci (https://miwe.example [CONTOH]), jadi yang dibuka di server e2e adalah alamat
// halamannya saja. Server e2e memakai jam asli, jadi waktu kirim tautan dimundurkan langsung di database
// untuk meniru tautan yang dikirim beberapa waktu lalu. Batas tepat 30 menit dan jeda tepat 60 detik diuji
// di test integrasi dengan jam palsu (src/server/auth/atur-ulang-password.test.ts).
const PASSWORD_LAMA = "sandi-lama-member-1";
const PASSWORD_BARU = "sandi-baru-member-2";
const PESAN_TERKIRIM =
  "Bila email ini terdaftar sebagai Member, tautan atur ulang password sudah kami kirim. Periksa juga folder spam.";
const PESAN_PASSWORD_DIGANTI =
  "Password sudah diganti. Masuk dengan password baru.";
const PESAN_KEDALUWARSA =
  "Tautan ini sudah kedaluwarsa, karena hanya berlaku 30 menit. Minta tautan baru di halaman Lupa password.";
const PESAN_SUDAH_DIPAKAI =
  "Tautan ini sudah dipakai. Minta tautan baru di halaman Lupa password bila perlu mengganti password lagi.";
const PESAN_DIGANTI =
  "Tautan ini sudah diganti tautan yang lebih baru. Pakai tautan di email terakhir dari kami, atau minta tautan baru.";

async function memberBaru() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD_LAMA });
  return email;
}

async function masukMember(page: Page, email: string, password: string) {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

async function mintaTautan(page: Page, email: string) {
  await page.goto("/lupa-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Kirim tautan" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    PESAN_TERKIRIM,
  );
}

/** Alamat halaman (tanpa alamat toko) dari Tautan atur ulang password di setiap email ke alamat itu. */
async function alamatTautanKe(request: APIRequestContext, kepada: string) {
  const respons = await request.get(
    `/api/email-tiruan?kepada=${encodeURIComponent(kepada)}`,
  );
  expect(respons.status()).toBe(200);
  const isi = (await respons.json()) as { subjek: string; teks: string }[];
  return isi
    .filter(({ subjek }) => subjek === "Atur ulang password")
    .map(({ teks }) => {
      const cocok =
        /^https:\/\/miwe\.example(\/atur-ulang-password\/\S+)$/m.exec(teks);
      if (!cocok) throw new Error(`Email ke ${kepada} tidak memuat tautan.`);
      return cocok[1];
    });
}

async function alamatTautanTerakhir(
  request: APIRequestContext,
  kepada: string,
) {
  const alamat = (await alamatTautanKe(request, kepada)).at(-1);
  if (!alamat)
    throw new Error(`Belum ada email Atur ulang password ke ${kepada}.`);
  return alamat;
}

/** Memundurkan waktu kirim semua Tautan atur ulang password Member itu sebanyak `detik`. */
async function mundurkanTautan(email: string, detik: number) {
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  await db
    .update(tautanAturUlangPassword)
    .set({
      dikirimPada: sql`${tautanAturUlangPassword.dikirimPada} - make_interval(secs => ${detik})`,
    })
    .where(eq(tautanAturUlangPassword.userId, id));
}

async function simpanPasswordBaru(page: Page, password: string) {
  await page.getByLabel("Password baru").fill(password);
  await page.getByRole("button", { name: "Simpan password" }).click();
}

const isi = (page: Page) => page.getByRole("main");

// UAT-G5 langkah 1–5.
test("tautan yang masih berlaku menyimpan password baru, sesi di browser lain berakhir, login dengan password baru berhasil, dan tautan yang sama ditolak bila dibuka lagi", async ({
  page,
  browser,
  request,
}) => {
  const email = await memberBaru();
  const laptop = await (await browser.newContext()).newPage();
  await masukMember(laptop, email, PASSWORD_LAMA);
  await expect(laptop).toHaveURL("/riwayat");

  // Halaman Lupa password ditautkan dari halaman Masuk.
  await page.goto("/masuk");
  await isi(page).getByRole("link", { name: "Lupa password?" }).click();
  await expect(page).toHaveURL("/lupa-password");
  await mintaTautan(page, email);
  // Permintaan kedua langsung sesudahnya menampilkan pesan yang sama, tetapi tidak mengirim email baru.
  await mintaTautan(page, email);
  expect(await alamatTautanKe(request, email)).toHaveLength(1);

  const alamat = await alamatTautanTerakhir(request, email);
  await page.goto(alamat);
  await simpanPasswordBaru(page, "abc1234");
  await expect(
    isi(page).getByText("Password baru kurang dari 8 karakter."),
  ).toBeVisible();

  await simpanPasswordBaru(page, PASSWORD_BARU);
  await expect(page).toHaveURL("/masuk?password=diganti");
  await expect(isi(page).getByRole("status")).toHaveText(
    PESAN_PASSWORD_DIGANTI,
  );

  // Sesi di laptop sudah berakhir: tab Akun tampil untuk Tamu, tanpa tombol "Keluar".
  await laptop.goto("/akun");
  await expect(
    laptop.getByRole("main").getByRole("button", { name: "Keluar" }),
  ).toHaveCount(0);
  await laptop.context().close();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_BARU);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");

  await page.goto(alamat);
  await expect(isi(page).getByRole("alert")).toHaveText(PESAN_SUDAH_DIPAKAI);
  await expect(page.getByLabel("Password baru")).toHaveCount(0);
});

test("tautan yang dibuka 30 menit setelah dikirim ditolak karena kedaluwarsa", async ({
  page,
  request,
}) => {
  const email = await memberBaru();
  await mintaTautan(page, email);
  await mundurkanTautan(email, 30 * 60);

  await page.goto(await alamatTautanTerakhir(request, email));

  await expect(isi(page).getByRole("alert")).toHaveText(PESAN_KEDALUWARSA);
  await expect(page.getByLabel("Password baru")).toHaveCount(0);
  await isi(page).getByRole("link", { name: "Minta tautan baru" }).click();
  await expect(page).toHaveURL("/lupa-password");
});

test("tautan lama ditolak setelah tautan baru dikirim, dan tautan baru tetap bisa dipakai", async ({
  page,
  request,
}) => {
  const email = await memberBaru();
  await mintaTautan(page, email);
  await mundurkanTautan(email, 60);
  await mintaTautan(page, email);
  const [alamatLama, alamatBaru] = await alamatTautanKe(request, email);

  await page.goto(alamatLama);
  await expect(isi(page).getByRole("alert")).toHaveText(PESAN_DIGANTI);

  await page.goto(alamatBaru);
  await simpanPasswordBaru(page, PASSWORD_BARU);
  await expect(page).toHaveURL("/masuk?password=diganti");
});

test("email yang terkunci karena 5 kali salah password bisa langsung login dengan password baru setelah atur ulang", async ({
  page,
  request,
}) => {
  const email = await memberBaru();
  for (let i = 1; i <= 5; i++) {
    await masukMember(page, email, "password-yang-salah");
    await expect(isi(page).getByRole("alert")).toBeVisible();
  }
  await masukMember(page, email, PASSWORD_LAMA);
  await expect(isi(page).getByRole("alert")).toContainText("dikunci 15 menit");

  await mintaTautan(page, email);
  await page.goto(await alamatTautanTerakhir(request, email));
  await simpanPasswordBaru(page, PASSWORD_BARU);
  await expect(page).toHaveURL("/masuk?password=diganti");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_BARU);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");
});

test("tautan yang tidak dikenal menampilkan halaman tidak ditemukan", async ({
  page,
}) => {
  await page.goto(`/atur-ulang-password/${"A".repeat(43)}`);

  await expect(
    isi(page).getByRole("heading", { name: "Tautan tidak ditemukan" }),
  ).toBeVisible();
});
