import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { sisipkanMember } from "../src/server/uji-member";

// Ganti password di tab Akun Member (T46, PRD §7.6 ▶ Keputusan 2026-11-17, UAT-G7 langkah 3–4).
const PASSWORD_LAMA = "sandi-lama-member-1";
const PASSWORD_BARU = "sandi-baru-member-2";
const PESAN_PASSWORD_LAMA_SALAH =
  "Password lama salah, jadi password tidak diganti.";
const PESAN_PASSWORD_SALAH =
  "Email atau password salah. Periksa keduanya, lalu coba masuk lagi.";

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

async function gantiPassword(
  page: Page,
  passwordLama: string,
  passwordBaru: string,
) {
  await page.goto("/akun");
  await page.getByLabel("Password lama").fill(passwordLama);
  await page.getByLabel("Password baru").fill(passwordBaru);
  await page.getByRole("button", { name: "Ganti password" }).click();
}

const isi = (page: Page) => page.getByRole("main");

test("password lama yang salah ditolak dengan pesannya, dan password tidak berubah", async ({
  page,
}) => {
  const email = await memberBaru();
  await masukMember(page, email, PASSWORD_LAMA);
  await expect(page).toHaveURL("/riwayat");

  await gantiPassword(page, "password-yang-salah", PASSWORD_BARU);

  await expect(isi(page).getByRole("alert")).toHaveText(
    PESAN_PASSWORD_LAMA_SALAH,
  );
  await expect(isi(page).getByText("Password sudah diganti.")).toHaveCount(0);

  // Password lama masih dipakai: keluar, lalu password baru ditolak dan password lama diterima.
  await isi(page).getByRole("button", { name: "Keluar" }).click();
  await expect(isi(page).getByRole("button", { name: "Keluar" })).toHaveCount(
    0,
  );
  await masukMember(page, email, PASSWORD_BARU);
  await expect(isi(page).getByRole("alert")).toHaveText(PESAN_PASSWORD_SALAH);
  await masukMember(page, email, PASSWORD_LAMA);
  await expect(page).toHaveURL("/riwayat");
});

test("password baru 7 karakter ditolak, dan password tidak berubah", async ({
  page,
}) => {
  const email = await memberBaru();
  await masukMember(page, email, PASSWORD_LAMA);
  await expect(page).toHaveURL("/riwayat");

  // Contoh 7 karakter dari tests/golden/panjang-password.json.
  await gantiPassword(page, PASSWORD_LAMA, "abc1234");

  await expect(isi(page).getByLabel("Password baru")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    isi(page).getByText(
      "Password baru kurang dari 8 karakter. Buat password baru dengan minimal 8 karakter.",
    ),
  ).toBeVisible();
  await expect(isi(page).getByText("Password sudah diganti.")).toHaveCount(0);

  await isi(page).getByRole("button", { name: "Keluar" }).click();
  await expect(isi(page).getByRole("button", { name: "Keluar" })).toHaveCount(
    0,
  );
  await masukMember(page, email, "abc1234");
  await expect(isi(page).getByRole("alert")).toHaveText(PESAN_PASSWORD_SALAH);
});

// UAT-G7 langkah 3–4 dengan dua konteks browser: ponsel dan laptop.
test("setelah diganti, perangkat lain keluar, perangkat ini tetap masuk, dan hanya password baru yang diterima", async ({
  browser,
}) => {
  const email = await memberBaru();
  const ponsel = await (await browser.newContext()).newPage();
  const laptop = await (await browser.newContext()).newPage();
  await masukMember(ponsel, email, PASSWORD_LAMA);
  await expect(ponsel).toHaveURL("/riwayat");
  await masukMember(laptop, email, PASSWORD_LAMA);
  await expect(laptop).toHaveURL("/riwayat");

  await gantiPassword(laptop, PASSWORD_LAMA, PASSWORD_BARU);

  await expect(isi(laptop).getByRole("status")).toHaveText(
    "Password sudah diganti.",
  );
  await expect(isi(laptop).getByLabel("Password lama")).toHaveValue("");
  await expect(isi(laptop).getByLabel("Password baru")).toHaveValue("");

  // Laptop tetap masuk setelah dimuat ulang.
  await laptop.reload();
  await expect(isi(laptop).getByText(email)).toBeVisible();
  await expect(
    isi(laptop).getByRole("button", { name: "Keluar" }),
  ).toBeVisible();

  // Ponsel sudah keluar setelah dimuat ulang.
  await ponsel.goto("/akun");
  await expect(isi(ponsel).getByText(email)).toHaveCount(0);
  await expect(isi(ponsel).getByRole("button", { name: "Keluar" })).toHaveCount(
    0,
  );

  // Di ponsel yang sudah keluar, password lama ditolak dan password baru diterima.
  await masukMember(ponsel, email, PASSWORD_LAMA);
  await expect(isi(ponsel).getByRole("alert")).toHaveText(PESAN_PASSWORD_SALAH);
  await masukMember(ponsel, email, PASSWORD_BARU);
  await expect(ponsel).toHaveURL("/riwayat");

  await ponsel.context().close();
  await laptop.context().close();
});

// UAT-G7 ▶ Keputusan 2026-11-17 (#174) langkah 5–6. Jam kunci yang tepat diuji di test integrasi dengan
// jam palsu; server e2e memakai jam asli, jadi di sini cukup bentuk jam WIB-nya.
test("setelah password lama salah 5 kali berturut-turut, password lama yang benar pun ditolak dengan pesan kunci, dan login tetap bisa", async ({
  page,
}) => {
  const email = await memberBaru();
  const pesanTerkunci =
    /^Password lama salah 5 kali berturut-turut, jadi ganti password dikunci 15 menit\. Coba lagi mulai pukul \d{2}\.\d{2} WIB\.$/;
  await masukMember(page, email, PASSWORD_LAMA);
  await expect(page).toHaveURL("/riwayat");

  for (let i = 1; i <= 4; i++) {
    await gantiPassword(page, "password-yang-salah", PASSWORD_BARU);
    await expect(isi(page).getByRole("alert")).toHaveText(
      PESAN_PASSWORD_LAMA_SALAH,
    );
  }
  await gantiPassword(page, "password-yang-salah", PASSWORD_BARU);
  await expect(isi(page).getByRole("alert")).toHaveText(pesanTerkunci);

  await gantiPassword(page, PASSWORD_LAMA, PASSWORD_BARU);
  await expect(isi(page).getByRole("alert")).toHaveText(pesanTerkunci);
  await expect(isi(page).getByText("Password sudah diganti.")).toHaveCount(0);

  // Kunci ganti password tidak memengaruhi login: keluar, lalu login lagi dengan password yang sekarang.
  await isi(page).getByRole("button", { name: "Keluar" }).click();
  await expect(isi(page).getByRole("button", { name: "Keluar" })).toHaveCount(
    0,
  );
  await masukMember(page, email, PASSWORD_LAMA);
  await expect(page).toHaveURL("/riwayat");
});

test("tab Akun Member tidak punya isian ganti email maupun tombol hapus akun", async ({
  page,
}) => {
  const email = await memberBaru();
  await masukMember(page, email, PASSWORD_LAMA);
  await expect(page).toHaveURL("/riwayat");

  await page.goto("/akun");

  await expect(
    isi(page).getByRole("button", { name: "Ganti password" }),
  ).toBeVisible();
  // Isian di tab Akun hanya password lama dan password baru; email tampil sebagai teks. Radio pilihan mode
  // tampilan (T64, PRD §11.3) bukan isian data akun.
  await expect(isi(page).getByRole("textbox")).toHaveCount(2);
  await expect(
    isi(page).locator(
      "input:not([type=password]):not([type=hidden]):not([type=radio])",
    ),
  ).toHaveCount(0);
  await expect(isi(page).getByLabel(/email/i)).toHaveCount(0);
  await expect(isi(page).getByText(/hapus akun/i)).toHaveCount(0);
  await expect(isi(page).getByRole("button", { name: /hapus/i })).toHaveCount(
    0,
  );
});
