import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL berasal dari .env.ci yang dimuat playwright.config.ts, jadi data dan pekerjaan latar ini
// masuk ke database app_test. Server e2e menjalankan pekerja pg-boss (src/instrumentation.ts) dengan Qrispy
// tiruan dan email tiruan dari .env.ci (QRISPY_MODE=tiruan, EMAIL_MODE=tiruan). Email tiruan disimpan di
// memori proses server, jadi isi email diuji di src/server/email-pesanan-selesai.test.ts; di sini yang
// diuji adalah pekerja server yang benar-benar mengirimnya.
import { db } from "../src/server/db";
import { pesanan, varian } from "../src/server/db/schema";
import { pekerjaanEmailPesananSelesai } from "../src/server/pekerjaan-latar";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

// Produk bertanda [CONTOH] dengan akhiran unik per run. Namanya bukan Netflix, supaya tidak mengubah hasil
// pencarian "netflix" di cari-kategori-beranda.spec.ts yang berjalan bersamaan.
const akhiran = randomUUID().slice(0, 8);

// Koneksi database dan pg-boss tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

// Issue T23 dan PRD §6.3: begitu Pesanan menjadi Selesai, pekerja latar di server mengirim email "Pesanan
// selesai" tepat satu kali, di luar transaksi pembayaran. Pesanan Menunggu Pembayaran disiapkan langsung
// di database, supaya cek status pertama terjadi saat halamannya dibuka setelah pembayaran dipicu.
test('setelah pembayaran lewat Qrispy tiruan, pekerja latar server mengirim tepat satu email "Pesanan selesai" tanpa tanda "Email gagal"', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const produkId = await sisipkanProduk({
    nama: `Email Selesai ${akhiran}`,
    formatItemStok: ["Kode"],
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const dipesan = await sisipkanPesanan({
    varianId,
    status: "Menunggu Pembayaran",
    itemStok: { status: "Ditahan", nilai: ["GNS-8Q2K-L7PX"] },
  });
  const [{ qrisId }] = await db
    .select({ qrisId: pesanan.qrisId })
    .from(pesanan)
    .where(eq(pesanan.id, dipesan.id));
  const respons = await request.post("/api/qrispy-tiruan/bayar", {
    data: { qrisId, amount: 45123 },
  });
  expect(respons.status()).toBe(200);

  await page.goto(`/pesanan/${dipesan.tautan}`);
  await expect(
    page.getByRole("main").getByText("Selesai", { exact: true }),
  ).toBeVisible();

  await expect(async () => {
    const pekerjaan = await pekerjaanEmailPesananSelesai(dipesan.id);
    expect(pekerjaan.map(({ state }) => state)).toEqual(["completed"]);
  }).toPass({ timeout: 30_000, intervals: [1_000] });
  const [selesai] = await db
    .select({ status: pesanan.status, emailGagal: pesanan.emailGagal })
    .from(pesanan)
    .where(eq(pesanan.id, dipesan.id));
  expect(selesai).toEqual({ status: "Selesai", emailGagal: false });
});

/** Semua berkas di folder itu beserta subfoldernya. */
async function semuaBerkas(folder: string): Promise<string[]> {
  const isi = await readdir(folder, { withFileTypes: true, recursive: true });
  return isi
    .filter((berkas) => berkas.isFile())
    .map((berkas) => path.join(berkas.parentPath, berkas.name));
}

// Issue T23: RESEND_API_KEY hanya dipakai server. Berkas yang dikirim ke browser adalah berkas di
// .next/static hasil `pnpm build` yang dijalankan server e2e ini, ditambah HTML halamannya.
test("RESEND_API_KEY tidak ada di berkas yang dikirim ke browser maupun di HTML halaman", async ({
  page,
}) => {
  const kunci = process.env.RESEND_API_KEY ?? "";
  expect(kunci).not.toBe("");

  const berkas = await semuaBerkas(path.join(".next", "static"));
  expect(berkas.filter((nama) => nama.endsWith(".js")).length).toBeGreaterThan(
    0,
  );
  for (const nama of berkas) {
    const isi = await readFile(nama, "utf8");
    expect(isi, nama).not.toContain(kunci);
    expect(isi, nama).not.toContain("RESEND_API_KEY");
  }

  for (const alamat of ["/", "/riwayat"]) {
    await page.goto(alamat);
    expect(await page.content()).not.toContain(kunci);
  }
});
