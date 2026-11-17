import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// Bahan test bersama. DATABASE_URL berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke
// database app_test. Server e2e memakai Qrispy tiruan dari .env.ci (QRISPY_MODE=tiruan).
import { db } from "../src/server/db";
import { pesanan, varian } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanMember } from "../src/server/uji-member";
import { buatVoucher, type SyaratVoucher } from "../src/server/voucher";

// Tombol "Pakai" dan tautan Masuk di Checkout (T58, PRD §7.5 dan §8.7 ▶ Keputusan 2026-11-17, UAT-H1, UAT-H3,
// UAT-H4 langkah 6). Produk dan Voucher meniru persiapan bersama docs/UAT.md [CONTOH], dengan akhiran unik per
// run. Nama Produk-nya bukan Netflix, supaya tidak mengubah hasil pencarian "netflix" di
// cari-kategori-beranda.spec.ts yang berjalan bersamaan.
const akhiran = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
const KODE = {
  hemat5: `HEMAT5${akhiran}`,
  lama: `LAMA${akhiran}`,
  satukali: `SATUKALI${akhiran}`,
  member20: `MEMBER20${akhiran}`,
};
const PASSWORD_MEMBER = "sandi-uji-member-123";
let varianId = "";

/** Syarat HEMAT5 [CONTOH]: nominal Rp 5.000, Batas per email 1. */
const HEMAT5: SyaratVoucher = {
  jenisPotongan: "nominal",
  nilai: 5000,
  batasMaksimum: null,
  kuotaVoucher: null,
  batasPerEmail: 1,
  minimalHargaJual: null,
  mulai: null,
  berakhir: null,
  cakupan: { jenis: "semua" },
  khususMember: false,
  aktif: true,
};

test.beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: `Pakai Voucher Premium ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 20 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  await buatVoucher({ kode: KODE.hemat5, ...HEMAT5 });
  await buatVoucher({
    kode: KODE.lama,
    ...HEMAT5,
    berakhir: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });
  await buatVoucher({
    kode: KODE.satukali,
    ...HEMAT5,
    nilai: 2000,
    kuotaVoucher: 1,
    batasPerEmail: null,
  });
  await buatVoucher({
    kode: KODE.member20,
    ...HEMAT5,
    jenisPotongan: "persen",
    nilai: 20,
    batasPerEmail: null,
    khususMember: true,
  });
});

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

const emailUnik = () => `budi-${randomUUID()}@example.test`;

const rincian = (page: Page) =>
  page.getByRole("region", { name: "Rincian pembayaran" });

/** Nilai satu baris rincian, misalnya "Rp 50.000" untuk baris Harga jual. */
const nilaiRincian = (page: Page, label: string) =>
  rincian(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) })
    .getByRole("cell");

const isianKode = (page: Page) =>
  page.getByRole("textbox", { name: "Kode voucher (opsional)" });

async function bukaCheckout(page: Page) {
  await page.goto(`/checkout?varianId=${varianId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Checkout" }),
  ).toBeVisible();
}

/** Mengisi kode voucher, lalu menekan "Pakai". */
async function pakai(page: Page, kode: string) {
  await isianKode(page).fill(kode);
  await page.getByRole("button", { name: "Pakai", exact: true }).click();
}

// UAT-H1 langkah 1.
test('"Pakai" untuk HEMAT5 menampilkan "HEMAT5 dipakai: potongan Rp 5.000", dan Perkiraan bayar turun Rp 5.000 tanpa memuat ulang halaman', async ({
  page,
}) => {
  await bukaCheckout(page);
  await expect(nilaiRincian(page, "Potongan voucher")).toHaveText("Rp 0");
  await expect(nilaiRincian(page, "Perkiraan bayar")).toHaveText(
    "Rp 50.000 + Kode unik",
  );
  // Penanda di halaman ini hilang bila halaman dimuat ulang.
  await page.evaluate(() => {
    (window as { belumDimuatUlang?: boolean }).belumDimuatUlang = true;
  });

  await page.getByRole("textbox", { name: "Email" }).fill(emailUnik());
  await pakai(page, KODE.hemat5.toLowerCase());

  const pesanDipakai = `${KODE.hemat5} dipakai: potongan Rp 5.000`;
  await expect(page.getByText(pesanDipakai)).toBeVisible();
  await expect(isianKode(page)).toHaveAccessibleDescription(pesanDipakai);
  // Pesan sukses voucher berwarna `st-selesai` (DESIGN.md Inputs / Fields).
  const warna = await page.getByText(pesanDipakai).evaluate((el) => {
    const pembanding = document.createElement("span");
    pembanding.style.color = "var(--st-selesai)";
    el.append(pembanding);
    const stSelesai = getComputedStyle(pembanding).color;
    pembanding.remove();
    return { teks: getComputedStyle(el).color, stSelesai };
  });
  expect(warna.teks).toBe(warna.stSelesai);
  await expect(
    nilaiRincian(page, `Potongan voucher (${KODE.hemat5})`),
  ).toHaveText("− Rp 5.000");
  await expect(nilaiRincian(page, "Perkiraan bayar")).toHaveText(
    "Rp 45.000 + Kode unik",
  );
  expect(
    await page.evaluate(
      () => (window as { belumDimuatUlang?: boolean }).belumDimuatUlang,
    ),
  ).toBe(true);
});

// UAT-H3.
test('"Pakai" untuk LAMA menampilkan "Voucher sudah berakhir", dan Perkiraan bayar tetap', async ({
  page,
}) => {
  await bukaCheckout(page);

  await pakai(page, KODE.lama);

  await expect(isianKode(page)).toHaveAccessibleDescription(
    "Voucher sudah berakhir",
  );
  await expect(isianKode(page)).toHaveAttribute("aria-invalid", "true");
  await expect(nilaiRincian(page, "Perkiraan bayar")).toHaveText(
    "Rp 50.000 + Kode unik",
  );
});

// UAT-H4 langkah 6.
test('SATUKALI yang diterima "Pakai" tetapi kuotanya dipakai Pembeli lain lebih dulu ditolak dengan "Kuota voucher habis", dan Pesanan tidak dibuat', async ({
  page,
  browser,
}) => {
  const emailA = emailUnik();
  await bukaCheckout(page);
  await page.getByRole("textbox", { name: "Email" }).fill(emailA);
  await pakai(page, KODE.satukali);
  await expect(
    page.getByText(`${KODE.satukali} dipakai: potongan Rp 2.000`),
  ).toBeVisible();

  // Pembeli lain di browser lain memakai kuota terakhirnya sampai Halaman bayar.
  const browserLain = await browser.newContext();
  const halamanLain = await browserLain.newPage();
  await bukaCheckout(halamanLain);
  await halamanLain.getByRole("textbox", { name: "Email" }).fill(emailUnik());
  await isianKode(halamanLain).fill(KODE.satukali);
  await halamanLain.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(halamanLain).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  await browserLain.close();

  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();

  await expect(isianKode(page)).toHaveAccessibleDescription(
    "Kuota voucher habis",
  );
  await expect(isianKode(page)).toHaveValue(KODE.satukali);
  await expect(page).toHaveURL(/\/checkout\?varianId=/);
  expect(
    await db.select().from(pesanan).where(eq(pesanan.email, emailA)),
  ).toEqual([]);
});

// UAT-H3: MEMBER20 sebagai Tamu, lalu setelah login Member.
test("Tamu yang memakai MEMBER20 melihat pesan khusus Member dengan tautan Masuk, lalu setelah login kembali ke Checkout Varian yang sama dan MEMBER20 diterima", async ({
  page,
}) => {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  await bukaCheckout(page);

  await pakai(page, KODE.member20);

  const pesan = page.getByRole("alert").filter({
    hasText: "Voucher khusus Member, silakan login",
  });
  await expect(pesan).toBeVisible();
  await pesan.getByRole("link", { name: "Masuk" }).click();

  await expect(page).toHaveURL(/\/masuk\?kembali=/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD_MEMBER);
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(page).toHaveURL(`/checkout?varianId=${varianId}`);
  await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(email);
  await pakai(page, KODE.member20);
  await expect(
    page.getByText(`${KODE.member20} dipakai: potongan Rp 10.000`),
  ).toBeVisible();
  await expect(nilaiRincian(page, "Perkiraan bayar")).toHaveText(
    "Rp 40.000 + Kode unik",
  );
});
