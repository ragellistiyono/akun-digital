import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke database app_test. Database
// itu dipakai bersama test lain yang berjalan bersamaan, jadi setiap test memakai Member dengan email unik.
import { db } from "../src/server/db";
import { user } from "../src/server/db/schema";
import { ubahSaldoOlehAdmin } from "../src/server/saldo";
import { sisipkanMember } from "../src/server/uji-member";

// Saldo, Riwayat saldo, serta "Tambah saldo" dan "Kurangi saldo" oleh Admin (T76, PRD §15.1, §15.2, §15.6,
// §15.10, UAT-O1).

const PASSWORD_ADMIN = "sandi-uji-admin-123";
const PASSWORD_MEMBER = "sandi-uji-member-123";

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

const isi = (page: Page) => page.getByRole("main");
const tabelSaldo = (page: Page) =>
  isi(page).getByRole("table", { name: /^Riwayat saldo/ });
const kotakSaldoAdmin = (page: Page) =>
  isi(page).getByRole("region", { name: "Saldo", exact: true });

/** Mengisi form aksi saldo yang terbuka, lalu menekan Simpan. */
async function isiDanSimpan(
  page: Page,
  form: string,
  nominal: string,
  keterangan: string,
) {
  const wadah = isi(page).getByRole("form", { name: form });
  await wadah.getByLabel("Nominal").fill(nominal);
  await wadah.getByLabel("Keterangan").fill(keterangan);
  await wadah.getByRole("button", { name: "Simpan" }).click();
  return wadah;
}

// UAT-O1, PRD §15.6, §15.2, §15.10.
test("Admin menambah dan mengurangi saldo Member lewat Modal penegasan, lalu Member melihat saldo dan Riwayat saldo-nya", async ({
  page,
}) => {
  const { email, id } = await memberBaru();
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/member?cari=${encodeURIComponent(email)}`);
  await isi(page).getByRole("link", { name: email }).click();
  await expect(page).toHaveURL(`/admin/member/${id}`);
  await expect(kotakSaldoAdmin(page)).toContainText("Rp 0");

  // Langkah 2: tanpa keterangan ditolak.
  await kotakSaldoAdmin(page)
    .getByRole("button", { name: "Tambah saldo" })
    .click();
  let form = await isiDanSimpan(page, "Tambah saldo", "5000", "");
  await expect(form).toContainText("Keterangan belum diisi.");

  // Langkah 3: penegasan dibatalkan, saldo tetap. Isian diperiksa dulu sebelum Modal penegasan terbuka (PRD §9.10).
  form = await isiDanSimpan(page, "Tambah saldo", "5000", "Uji tambah saldo");
  const modalTambah = page.getByRole("alertdialog", { name: "Tambah saldo?" });
  await expect(modalTambah).toContainText(`Tambah Rp 5.000 ke saldo ${email}?`);
  await modalTambah.getByRole("button", { name: "Batal" }).click();
  await expect(modalTambah).toHaveCount(0);
  await expect(kotakSaldoAdmin(page)).toContainText("Rp 0");
  await expect(isi(page)).toContainText("Belum ada perubahan saldo.");

  // Langkah 4: isian tetap terisi setelah Batal; penegasan disetujui, saldo bertambah.
  await expect(form.getByLabel("Keterangan")).toHaveValue("Uji tambah saldo");
  await form.getByRole("button", { name: "Simpan" }).click();
  await modalTambah.getByRole("button", { name: "Ya, tambah saldo" }).click();
  await expect(form).toHaveCount(0);
  await expect(kotakSaldoAdmin(page)).toContainText("Rp 5.000");

  // Langkah 5: Rp 1 lebih besar dari saldo ditolak dengan pesan PRD, saldo tetap.
  await kotakSaldoAdmin(page)
    .getByRole("button", { name: "Kurangi saldo" })
    .click();
  form = await isiDanSimpan(page, "Kurangi saldo", "5001", "Uji kurangi");
  await expect(form).toContainText(
    `Saldo tidak cukup untuk dikurangi Rp 5.001. Saldo ${email} sekarang Rp 5.000.`,
  );
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(kotakSaldoAdmin(page)).toContainText("Rp 5.000");

  // Langkah 6: kurangi Rp 2.000.
  form = await isiDanSimpan(page, "Kurangi saldo", "2000", "Uji kurangi");
  const modalKurangi = page.getByRole("alertdialog", {
    name: "Kurangi saldo?",
  });
  await expect(modalKurangi).toContainText(
    `Kurangi Rp 2.000 dari saldo ${email}?`,
  );
  await expect(kotakSaldoAdmin(page)).toContainText("Rp 5.000");
  await modalKurangi.getByRole("button", { name: "Ya, kurangi saldo" }).click();
  await expect(form).toHaveCount(0);
  await expect(kotakSaldoAdmin(page)).toContainText("Rp 3.000");

  // Riwayat saldo di halaman Member admin, di atas Riwayat Pesanan, terbaru di atas.
  const barisAdmin = tabelSaldo(page).locator("tbody tr");
  await expect(barisAdmin).toHaveCount(2);
  await expect(barisAdmin.nth(0)).toContainText("Dikurangi Admin");
  await expect(barisAdmin.nth(0)).toContainText("−Rp 2.000");
  await expect(barisAdmin.nth(1)).toContainText("Ditambah Admin");

  // Daftar Member menampilkan kolom Saldo dengan angka yang sama.
  await page.goto(`/admin/member?cari=${encodeURIComponent(email)}`);
  const tabelMember = isi(page).getByRole("table");
  const barisMember = tabelMember.locator("tbody tr");
  await expect(barisMember).toHaveCount(1);
  await expect(barisMember).toContainText(email);
  const kolom = await tabelMember.getByRole("columnheader").allTextContents();
  const sel = await barisMember.locator("th, td").allTextContents();
  expect(sel[kolom.indexOf("Saldo")]).toBe("Rp 3.000");

  // Langkah 7: Member melihat "Saldo Rp 3.000" di tab Akun dan Riwayat saldo-nya.
  await page.context().clearCookies();
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");
  await page.goto("/akun");
  const kotak = isi(page).getByRole("region", { name: "Saldo", exact: true });
  await expect(kotak).toContainText("Saldo Rp 3.000");
  await expect(kotak.getByRole("link", { name: "Top up" })).toHaveAttribute(
    "href",
    "/akun/top-up",
  );
  await kotak.getByRole("link", { name: "Riwayat saldo" }).click();

  await expect(page).toHaveURL("/akun/riwayat-saldo");
  await expect(
    page.getByRole("heading", { level: 1, name: "Riwayat saldo" }),
  ).toBeVisible();
  await expect(tabelSaldo(page).getByRole("columnheader")).toHaveText([
    "Waktu (WIB)",
    "Jenis",
    "Nominal",
    "Saldo",
    "Rujukan",
  ]);
  const baris = tabelSaldo(page).locator("tbody tr");
  await expect(baris).toHaveCount(2);
  await expect(baris.nth(0).locator("td")).toContainText([
    /\d/,
    "Dikurangi Admin",
    "−Rp 2.000",
    "Rp 3.000",
    "Uji kurangi",
  ]);
  await expect(baris.nth(1).locator("td")).toContainText([
    /\d/,
    "Ditambah Admin",
    "+Rp 5.000",
    "Rp 5.000",
    "Uji tambah saldo",
  ]);
});

// PRD §15.6: kedua aksi berlaku juga untuk Member nonaktif.
test("Admin menambah saldo Member nonaktif", async ({ page }) => {
  const { id } = await memberBaru();
  await db.update(user).set({ nonaktif: true }).where(eq(user.id, id));
  await masukSebagaiAdmin(page);
  await page.goto(`/admin/member/${id}`);

  await kotakSaldoAdmin(page)
    .getByRole("button", { name: "Tambah saldo" })
    .click();
  await isiDanSimpan(page, "Tambah saldo", "20.000", "Bonus");
  await page
    .getByRole("alertdialog", { name: "Tambah saldo?" })
    .getByRole("button", { name: "Ya, tambah saldo" })
    .click();

  await expect(kotakSaldoAdmin(page)).toContainText("Rp 20.000");
});

// PRD §15.2: 50 baris per halaman, baik untuk Member maupun di halaman Member admin.
test("Riwayat saldo dibagi per 50 baris di halaman Member admin dan di Riwayat saldo Member", async ({
  page,
}) => {
  const { email, id } = await memberBaru();
  for (let nomor = 1; nomor <= 51; nomor++) {
    await ubahSaldoOlehAdmin({
      idMember: id,
      aksi: "tambah",
      nominal: "1000",
      keterangan: `Tambah ke-${nomor}`,
    });
  }

  async function periksaHalaman() {
    const baris = tabelSaldo(page).locator("tbody tr");
    await expect(baris).toHaveCount(50);
    await expect(baris.first()).toContainText("Tambah ke-51");
    await expect(isi(page)).toContainText("Halaman 1 dari 2");
    await isi(page).getByRole("link", { name: "Berikutnya" }).click();
    await expect(baris).toHaveCount(1);
    await expect(baris.first()).toContainText("Tambah ke-1");
    await expect(isi(page)).toContainText("Halaman 2 dari 2");
  }

  await masukSebagaiAdmin(page);
  await page.goto(`/admin/member/${id}`);
  await periksaHalaman();
  await expect(page).toHaveURL(`/admin/member/${id}?halaman=2`);

  await page.context().clearCookies();
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/riwayat");
  await page.goto("/akun/riwayat-saldo");
  await periksaHalaman();
  await expect(page).toHaveURL("/akun/riwayat-saldo?halaman=2");
});

// PRD §15.2, §15.10: Riwayat saldo hanya untuk Member yang login.
test("Tamu yang membuka Riwayat saldo diarahkan ke halaman Masuk, lalu kembali ke Riwayat saldo setelah login", async ({
  page,
}) => {
  const { email } = await memberBaru();

  await page.goto("/akun/riwayat-saldo");

  await expect(page).toHaveURL(
    `/masuk?kembali=${encodeURIComponent("/akun/riwayat-saldo")}`,
  );
  await expect(tabelSaldo(page)).toHaveCount(0);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/akun/riwayat-saldo");
  await expect(isi(page)).toContainText("Belum ada perubahan saldo.");
});
