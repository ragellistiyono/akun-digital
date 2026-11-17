import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// Bahan test bersama. DATABASE_URL berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk ke
// database app_test. Server e2e memakai Qrispy tiruan dari .env.ci (QRISPY_MODE=tiruan), yang memberi Kode unik
// acak Rp 1–499.
import { db } from "../src/server/db";
import { pesanan, varian, voucher } from "../src/server/db/schema";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";
import { buatVoucher, type SyaratVoucher } from "../src/server/voucher";

// Isian kode voucher di Checkout (T57, PRD §5.2, §5.5, §8.7 ▶ Keputusan 2026-11-17, §8.8 ▶ Keputusan 2026-11-17,
// UAT-E3, UAT-H1, UAT-H2). Produk dan Voucher meniru persiapan bersama docs/UAT.md [CONTOH], dengan akhiran unik
// per run. Nama Produk-nya bukan Netflix, supaya tidak mengubah hasil pencarian "netflix" di
// cari-kategori-beranda.spec.ts yang berjalan bersamaan.
const akhiran = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
const KODE = { hemat5: `HEMAT5${akhiran}`, lama: `LAMA${akhiran}` };
const produk = { satuBulan: "", ujiBayar: "" };

const HEMAT5: SyaratVoucher = {
  jenisPotongan: "nominal",
  nilai: 5000,
  batasMaksimum: null,
  kuotaVoucher: null,
  // Tanpa Batas per email, karena beberapa test di berkas ini memakai HEMAT5 dengan email berbeda.
  batasPerEmail: null,
  minimalHargaJual: null,
  mulai: null,
  berakhir: null,
  cakupan: { jenis: "semua" },
  khususMember: false,
  aktif: true,
};

test.beforeAll(async () => {
  produk.satuBulan = await sisipkanProduk({
    nama: `Voucher Premium ${akhiran}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 20 }],
  });
  produk.ujiBayar = await sisipkanProduk({
    nama: `Uji Bayar Voucher ${akhiran}`,
    varian: [{ nama: "Uji", hargaJual: 1000, Tersedia: 20 }],
  });
  await buatVoucher({ kode: KODE.hemat5, ...HEMAT5 });
  await buatVoucher({
    kode: KODE.lama,
    ...HEMAT5,
    berakhir: new Date(Date.now() - 24 * 60 * 60 * 1000),
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

/** Membuka form checkout Varian satu-satunya Produk itu. */
async function bukaCheckout(page: Page, produkId: string) {
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  await page.goto(`/checkout?varianId=${id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Checkout" }),
  ).toBeVisible();
}

test("checkout dengan HEMAT5 menampilkan Potongan voucher (HEMAT5) − Rp 5.000 di Halaman bayar, dan Total bayar Harga jual − Rp 5.000 + Kode unik", async ({
  page,
}) => {
  const email = emailUnik();
  await bukaCheckout(page, produk.satuBulan);
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  // Ditulis huruf kecil, tampil huruf kapital (DESIGN.md Inputs, isian gabung).
  await isianKode(page).fill(KODE.hemat5.toLowerCase());
  expect(
    await isianKode(page).evaluate((el) => getComputedStyle(el).textTransform),
  ).toBe("uppercase");
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();

  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();
  await expect(nilaiRincian(page, "Harga jual")).toHaveText("Rp 50.000");
  await expect(
    nilaiRincian(page, `Potongan voucher (${KODE.hemat5})`),
  ).toHaveText("− Rp 5.000");
  const teksKodeUnik = await nilaiRincian(page, "Kode unik").textContent();
  const kodeUnik = Number(teksKodeUnik?.replace("Rp ", ""));
  expect(kodeUnik).toBeGreaterThanOrEqual(1);
  expect(kodeUnik).toBeLessThanOrEqual(499);
  // Rp 50.000 − Rp 5.000 + Kode unik, ditulis dengan pemisah ribuan.
  await expect(nilaiRincian(page, "Total bayar")).toHaveText(
    `Rp 45.${String(kodeUnik).padStart(3, "0")}`,
  );
  expect(
    await db
      .select({
        potonganVoucher: pesanan.potonganVoucher,
        kodeVoucher: pesanan.kodeVoucher,
      })
      .from(pesanan)
      .where(eq(pesanan.email, email)),
  ).toEqual([{ potonganVoucher: 5000, kodeVoucher: KODE.hemat5 }]);
});

// UAT-H2 langkah 3 dan UAT-H3: Voucher yang ditolak saat Pesanan dibuat.
for (const [kasus, produkUji, kode, pesan] of [
  [
    "HEMAT5 untuk Uji Bayar",
    () => produk.ujiBayar,
    () => KODE.hemat5,
    "Voucher tidak memberi potongan untuk produk ini",
  ],
  [
    "Voucher yang sudah berakhir",
    () => produk.satuBulan,
    () => KODE.lama,
    "Voucher sudah berakhir",
  ],
] as const) {
  test(`${kasus} ditolak dengan "${pesan}", Pesanan tidak dibuat, dan isian kode tetap berisi`, async ({
    page,
  }) => {
    const email = emailUnik();
    await bukaCheckout(page, produkUji());
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await isianKode(page).fill(kode());
    await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();

    await expect(isianKode(page)).toHaveAccessibleDescription(pesan);
    await expect(isianKode(page)).toHaveAttribute("aria-invalid", "true");
    await expect(isianKode(page)).toHaveValue(kode());
    await expect(page).toHaveURL(/\/checkout\?varianId=/);
    expect(
      await db.select().from(pesanan).where(eq(pesanan.email, email)),
    ).toEqual([]);
  });
}

// PRD §8.8 ▶ Keputusan 2026-11-17. Pesanan tanpa Voucher tetap menulis "Potongan voucher" (checkout.spec.ts).
test('Halaman Pesanan menulis "Potongan voucher (HEMAT5)" untuk Pesanan yang memakai Voucher', async ({
  page,
}) => {
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produk.satuBulan));
  const [hemat5] = await db
    .select({ id: voucher.id, kode: voucher.kode })
    .from(voucher)
    .where(eq(voucher.kode, KODE.hemat5));
  // Rincian contoh PRD §5.5: Harga jual Rp 50.000, potongan voucher Rp 5.000, Kode unik Rp 123.
  const { tautan } = await sisipkanPesanan({
    varianId: id,
    status: "Kedaluwarsa",
    voucher: hemat5,
  });

  await page.goto(`/pesanan/${tautan}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Pesanan" }),
  ).toBeVisible();
  await expect(
    nilaiRincian(page, `Potongan voucher (${KODE.hemat5})`),
  ).toHaveText("− Rp 5.000");
});
