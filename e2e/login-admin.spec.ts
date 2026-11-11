import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "sandi-uji-admin-123";

// Menjalankan `pnpm admin:buat <email>` persis seperti pemilik di server, dengan password diketik
// dua kali lewat input. DATABASE_URL dari .env.ci (app_test) ikut diwariskan ke perintah itu.
function jalankanAdminBuat(email: string, password: string) {
  return spawnSync("pnpm", ["--silent", "admin:buat", email], {
    input: `${password}\n${password}\n`,
    encoding: "utf8",
  });
}

function buatAdminLewatPerintah() {
  const email = `admin-${randomUUID()}@example.test`;
  const hasil = jalankanAdminBuat(email, PASSWORD);
  expect(hasil.status, hasil.stderr).toBe(0);
  return email;
}

async function masuk(page: Page, email: string, password = PASSWORD) {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

const judulLogin = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Masuk ke dasbor admin" });

test("Admin yang dibuat dengan pnpm admin:buat bisa login di /admin, melihat dasbor admin, lalu keluar", async ({
  page,
}) => {
  const email = buatAdminLewatPerintah();

  await masuk(page, email);

  await expect(page).toHaveURL("/admin/ringkasan");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ringkasan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Menu admin" }),
  ).toBeVisible();

  // Admin yang masih punya sesi tidak diminta login lagi.
  await page.goto("/admin");
  await expect(page).toHaveURL("/admin/ringkasan");

  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL("/admin");
  await expect(judulLogin(page)).toBeVisible();

  await page.goto("/admin/ringkasan");
  await expect(page).toHaveURL("/admin");
});

// UAT-B4 (PRD §2.2, ▶ Keputusan 2026-11-11 #53): password Admin minimal 8 karakter. Password contoh
// diambil dari kasus "7 karakter" dan "8 karakter" di tests/golden/panjang-password.json.
test("pnpm admin:buat menolak password 7 karakter tanpa membuat Admin, lalu password 8 karakter membuat Admin yang bisa login", async ({
  page,
}) => {
  const email = `admin-${randomUUID()}@example.test`;

  const ditolak = jalankanAdminBuat(email, "abc1234");
  expect(ditolak.status).not.toBe(0);
  expect(ditolak.stderr).toContain("minimal 8 karakter");
  expect(ditolak.stdout).not.toContain("sudah dibuat");

  // Email yang sama masih bisa dipakai, jadi Admin tadi memang tidak dibuat.
  const dibuat = jalankanAdminBuat(email, "abc12345");
  expect(dibuat.status, dibuat.stderr).toBe(0);
  expect(dibuat.stdout).toContain(`Admin ${email} sudah dibuat.`);

  await masuk(page, email, "abc12345");
  await expect(page).toHaveURL("/admin/ringkasan");
});

// UAT-B2
for (const alamat of ["/admin/pesanan", "/admin/ringkasan"]) {
  test(`Tamu yang membuka ${alamat} diarahkan ke halaman login /admin`, async ({
    page,
  }) => {
    await page.goto(alamat);

    await expect(page).toHaveURL("/admin");
    await expect(judulLogin(page)).toBeVisible();
  });
}

test("password yang salah ditolak dengan pesan yang menyebut sebab dan langkah berikutnya", async ({
  page,
}) => {
  const email = buatAdminLewatPerintah();

  await masuk(page, email, "password-yang-salah");

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Email atau password salah. Periksa keduanya, lalu coba masuk lagi.",
  );
  await expect(page).toHaveURL("/admin");
  // Email tetap terisi supaya Admin cukup mengetik ulang password.
  await expect(page.getByLabel("Email")).toHaveValue(email);

  await page.goto("/admin/ringkasan");
  await expect(page).toHaveURL("/admin");
});

// UAT-G6 langkah 4 (PRD §7.7). Jam kunci yang tepat diuji di test integrasi dengan jam palsu;
// server e2e memakai jam asli, jadi di sini cukup bentuk jam WIB-nya.
test("setelah password salah 5 kali berturut-turut, password benar pun ditolak dengan jam login boleh dicoba lagi dalam WIB", async ({
  page,
}) => {
  const email = buatAdminLewatPerintah();
  const peringatan = page.getByRole("main").getByRole("alert");
  const pesanTerkunci =
    /^Password salah 5 kali berturut-turut, jadi login dengan email ini dikunci 15 menit\. Coba masuk lagi mulai pukul \d{2}\.\d{2} WIB\.$/;

  for (let i = 1; i <= 4; i++) {
    await masuk(page, email, "password-yang-salah");
    await expect(peringatan).toHaveText(
      "Email atau password salah. Periksa keduanya, lalu coba masuk lagi.",
    );
  }

  await masuk(page, email, "password-yang-salah");
  await expect(peringatan).toHaveText(pesanTerkunci);

  // Email ditulis dengan huruf besar tetap dihitung sebagai email yang sama.
  await masuk(page, email.toUpperCase());
  await expect(peringatan).toHaveText(pesanTerkunci);
  await expect(page).toHaveURL("/admin");

  await page.goto("/admin/ringkasan");
  await expect(page).toHaveURL("/admin");
});

test("isian kosong ditolak dengan pesan di setiap isian", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(page.getByLabel("Email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.getByText("Email belum diisi. Ketik email Admin Anda."),
  ).toBeVisible();
  await expect(
    page.getByText("Password belum diisi. Ketik password Admin Anda."),
  ).toBeVisible();
});

test("tidak ada halaman atau rute untuk mendaftar Admin", async ({ page }) => {
  await page.goto("/admin");
  const ajakanDaftar = /daftar|buat akun|sign up|register/i;
  await expect(page.getByRole("link", { name: ajakanDaftar })).toHaveCount(0);
  await expect(page.getByRole("button", { name: ajakanDaftar })).toHaveCount(0);

  // Handler HTTP Better Auth tidak dipasang, jadi rute pendaftarannya tidak ada.
  const daftarLewatApi = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: "Penyusup",
      email: `penyusup-${randomUUID()}@example.test`,
      password: PASSWORD,
    },
  });
  expect(daftarLewatApi.status()).toBe(404);

  // Bahkan Admin yang sudah login tidak menemukan halaman pendaftaran.
  await masuk(page, buatAdminLewatPerintah());
  await expect(page).toHaveURL("/admin/ringkasan");
  const halamanDaftarAdmin = await page.goto("/admin/daftar");
  expect(halamanDaftarAdmin?.status()).toBe(404);
});

test.describe("kerangka dasbor admin", () => {
  test("di lebar 390 px memakai menu lipat tanpa navigasi bawah toko", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await masuk(page, buatAdminLewatPerintah());
    await expect(page).toHaveURL("/admin/ringkasan");

    const tombolMenu = page.getByRole("button", { name: "Menu" });
    const menu = page.getByRole("navigation", { name: "Menu admin" });
    await expect(tombolMenu).toBeVisible();
    await expect(tombolMenu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();

    await tombolMenu.click();
    await expect(tombolMenu).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Ringkasan" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(menu.getByRole("button", { name: "Keluar" })).toBeVisible();

    await tombolMenu.click();
    await expect(menu).toBeHidden();

    await expect(
      page.getByRole("navigation", { name: "Navigasi utama" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);
  });

  test("di lebar 1440 px memakai menu samping tanpa navigasi bawah toko", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await masuk(page, buatAdminLewatPerintah());
    await expect(page).toHaveURL("/admin/ringkasan");

    const menu = page.getByRole("navigation", { name: "Menu admin" });
    await expect(menu).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    await expect(menu.getByRole("button", { name: "Keluar" })).toBeVisible();

    // Menu samping menempel di kiri, dan judul halaman berada di sebelah kanannya.
    const kotakMenu = await menu.boundingBox();
    const kotakJudul = await page
      .getByRole("heading", { level: 1, name: "Ringkasan" })
      .boundingBox();
    expect(kotakMenu?.x).toBe(0);
    expect(kotakJudul!.x).toBeGreaterThanOrEqual(
      kotakMenu!.x + kotakMenu!.width,
    );

    await expect(
      page.getByRole("navigation", { name: "Navigasi utama" }),
    ).toHaveCount(0);
  });
});
