import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dan ITEM_STOK_KEY berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk
// ke database app_test dan Item stok-nya dienkripsi dengan kunci uji. Server e2e memakai Qrispy tiruan dari
// .env.ci (QRISPY_MODE=tiruan), yang menerbitkan dan membatalkan QRIS tanpa uang sungguhan.
import { db } from "../src/server/db";
import { itemStok, pesanan, varian } from "../src/server/db/schema";
import { isiItemStokUji, sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

const PASSWORD = "sandi-uji-admin-123";

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

const FORMAT = ["Email", "Password", "Profil"];

// Contoh isi Item stok untuk format `Email`, `Password`, `Profil` seperti contoh baris PRD §4.2, dengan
// akhiran unik per test supaya mudah dikenali di daftar.
const isiUji = (nama: string, profil: string) => [
  `${nama}-${randomUUID().slice(0, 8)}@mail.com`,
  `rahasia-${nama}`,
  profil,
];

// Membuat Admin persis seperti pemilik di server: `pnpm admin:buat <email>`, password lewat input.
// DATABASE_URL dari .env.ci (app_test) ikut diwariskan ke perintah itu.
function buatAdminLewatPerintah() {
  const email = `admin-${randomUUID()}@example.test`;
  const hasil = spawnSync("pnpm", ["--silent", "admin:buat", email], {
    input: `${PASSWORD}\n${PASSWORD}\n`,
    encoding: "utf8",
  });
  expect(hasil.status, hasil.stderr).toBe(0);
  return email;
}

async function masukSebagaiAdmin(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(buatAdminLewatPerintah());
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL("/admin/ringkasan");
}

/**
 * Produk baru [CONTOH] dengan Format Item stok `Email`, `Password`, `Profil` dan satu Varian "1 Bulan", berisi
 * Item stok Tersedia dengan isi itu. Namanya bukan Netflix, supaya tidak mengubah hasil pencarian "netflix" di
 * cari-kategori-beranda.spec.ts yang berjalan bersamaan. Hasilnya id Produk, id Varian, dan alamat halaman
 * Varian itu di dasbor admin.
 */
async function varianBerisi(tersedia: string[][]) {
  const produkId = await sisipkanProduk({
    nama: `Daftar Item stok ${randomUUID().slice(0, 8)}`,
    formatItemStok: FORMAT,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  for (const nilai of tersedia) {
    await db.insert(itemStok).values({ varianId, ...isiItemStokUji(nilai) });
  }
  return {
    produkId,
    varianId,
    alamat: `/admin/produk/${produkId}/varian/${varianId}`,
  };
}

/** Pesanan Selesai dengan Item stok Terkirim berisi itu. Hasilnya Nomor Pesanan-nya. */
async function pesananSelesai(varianId: string, nilai: string[]) {
  const { nomorPesanan } = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    itemStok: { status: "Terkirim", nilai, formatSaatTerkirim: FORMAT },
  });
  return nomorPesanan;
}

const bagianDaftar = (page: Page) =>
  page.getByRole("region", { name: "Daftar Item stok" });

/** Setiap Item stok di daftar. */
const semuaItemStok = (page: Page) =>
  bagianDaftar(page)
    .getByRole("list", { name: "Daftar Item stok" })
    .getByRole("listitem");

/** Item stok di daftar yang memuat teks itu, misalnya isi kolom Email-nya. */
const itemStokBerisi = (page: Page, teks: string) =>
  semuaItemStok(page).filter({ hasText: teks });

/** Item stok di daftar yang pil statusnya berlabel status itu. */
const itemStokBerstatus = (page: Page, status: string) =>
  semuaItemStok(page).filter({
    has: page.getByText(status, { exact: true }),
  });

/** Form ubah Item stok dengan nomor itu di daftar. */
const formUbah = (page: Page, nomor: number) =>
  bagianDaftar(page).getByRole("form", { name: `Ubah Item stok ${nomor}` });

const chip = (page: Page, nama: string) =>
  bagianDaftar(page)
    .getByRole("navigation", { name: "Saring Item stok menurut status" })
    .getByRole("link", { name: nama });

/** Teks setiap pasangan nama kolom dan isinya di sebuah Item stok, misalnya "Email budi@mail.com". */
const kolomItemStok = (baris: Locator) =>
  baris
    .locator("dl > div")
    .evaluateAll((kolom) =>
      kolom.map((k) => (k.textContent ?? "").replace(/\s+/g, " ").trim()),
    );

const teksKolom = (nilai: string[]) =>
  FORMAT.map((nama, i) => `${nama}${nilai[i]}`);

/** Angka Stok Varian di halaman Varian. */
const angkaStokVarian = (page: Page) =>
  page
    .getByRole("region", { name: "Stok Varian" })
    .getByText(/^\d+$/, { exact: true });

// UAT-I4 dan PRD §9.7, §5.3, §5.8.
test("daftar Item stok menampilkan Item stok Tersedia, Ditahan dengan Nomor Pesanan yang menahannya, dan Terkirim dengan Nomor Pesanan penerimanya, dan saringan per status hanya menampilkan status itu", async ({
  page,
  browser,
}) => {
  const tersedia = [isiUji("alfa", "Profil 1"), isiUji("beta", "Profil 2")];
  const terkirim = isiUji("gamma", "Profil 3");
  const { produkId, varianId, alamat } = await varianBerisi(tersedia);
  const nomorPenerima = await pesananSelesai(varianId, terkirim);

  // Langkah 1: Pembeli memulai checkout dengan Email A tanpa membayar, jadi satu Item stok Ditahan (PRD §5.3).
  const pembeli = await (await browser.newContext()).newPage();
  const emailA = `email-a-${randomUUID()}@example.test`;
  await pembeli.goto(`/produk/${produkId}`);
  await pembeli.getByRole("button", { name: /^Beli/ }).click();
  await pembeli.getByRole("textbox", { name: "Email" }).fill(emailA);
  await pembeli.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(pembeli).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  const [{ nomorPesanan: nomorPenahan }] = await db
    .select({ nomorPesanan: pesanan.nomorPesanan })
    .from(pesanan)
    .where(eq(pesanan.email, emailA));

  // Langkah 2: Admin membuka halaman Varian itu.
  await masukSebagaiAdmin(page);
  await page.goto(alamat);
  await expect(chip(page, "Semua (3)")).toHaveAttribute("aria-current", "true");
  await expect(semuaItemStok(page)).toHaveCount(3);

  // Ada Item stok Tersedia, tanpa Nomor Pesanan.
  const barisTersedia = itemStokBerstatus(page, "Tersedia");
  await expect(barisTersedia).toHaveCount(1);
  await expect(barisTersedia).not.toContainText("Pesanan");

  // Ada satu Item stok Ditahan dengan Nomor Pesanan yang menahannya, beserta isi lengkapnya.
  const barisDitahan = itemStokBerstatus(page, "Ditahan");
  await expect(barisDitahan).toHaveCount(1);
  await expect(barisDitahan).toContainText(`untuk Pesanan ${nomorPenahan}`);
  await expect(
    barisDitahan.getByRole("link", { name: nomorPenahan }),
  ).toHaveAttribute("href", `/admin/pesanan/${nomorPenahan}`);
  expect(tersedia.map((nilai) => teksKolom(nilai).join(" "))).toContainEqual(
    (await kolomItemStok(barisDitahan)).join(" "),
  );

  // Item stok Terkirim tampil dengan Nomor Pesanan penerimanya dan isi lengkapnya.
  const barisTerkirim = itemStokBerisi(page, terkirim[0]);
  await expect(
    barisTerkirim.getByText("Terkirim", { exact: true }),
  ).toBeVisible();
  await expect(barisTerkirim).toContainText(`ke Pesanan ${nomorPenerima}`);
  expect(await kolomItemStok(barisTerkirim)).toEqual(teksKolom(terkirim));

  // Item stok Tersedia bisa diubah atau dihapus; Ditahan dan Terkirim tidak punya tombolnya (PRD §4.4).
  await expect(
    barisTersedia.getByRole("button", { name: /^Ubah/ }),
  ).toBeVisible();
  await expect(
    barisTersedia.getByRole("button", { name: /^Hapus/ }),
  ).toBeVisible();
  for (const baris of [barisDitahan, barisTerkirim]) {
    await expect(baris.getByRole("button")).toHaveCount(0);
  }

  // Saring per status: setiap saringan hanya menampilkan Item stok berstatus itu.
  for (const [nama, status, jumlah] of [
    ["Ditahan (1)", "Ditahan", 1],
    ["Tersedia (1)", "Tersedia", 1],
    ["Terkirim (1)", "Terkirim", 1],
  ] as const) {
    await chip(page, nama).click();
    await expect(page).toHaveURL(`${alamat}?status=${status}`);
    await expect(chip(page, nama)).toHaveAttribute("aria-current", "true");
    await expect(semuaItemStok(page)).toHaveCount(jumlah);
    await expect(itemStokBerstatus(page, status)).toHaveCount(jumlah);
  }
  await expect(itemStokBerisi(page, terkirim[0])).toContainText(nomorPenerima);

  // Setelah itu Pesanan Email A dibatalkan, jadi Item stok-nya kembali Tersedia (PRD §5.8).
  await pembeli
    .getByRole("main")
    .getByRole("button", { name: "Batalkan" })
    .click();
  await expect(
    pembeli.getByRole("main").getByText("Dibatalkan", { exact: true }),
  ).toBeVisible();
  await chip(page, "Semua (3)").click();
  await page.reload();
  await expect(chip(page, "Ditahan (0)")).toBeVisible();
  await expect(chip(page, "Tersedia (2)")).toBeVisible();
  await expect(page.getByText(nomorPenahan)).toHaveCount(0);
  await chip(page, "Ditahan (0)").click();
  await expect(
    bagianDaftar(page).getByText(
      "Tidak ada Item stok berstatus Ditahan. Pilih Semua untuk melihat Item stok lainnya.",
    ),
  ).toBeVisible();
  await pembeli.context().close();
});

// PRD §4.4 dan §11.1, UAT-D3 langkah 1. Di layar ponsel 360 px, isi Item stok yang panjang tidak membuat
// halaman bergulir ke samping.
test("di layar ponsel, Admin mengubah lalu menghapus Item stok Tersedia, dan isian kosong ditolak dengan pesan", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const lama = isiUji("delta", "Profil 1");
  const { varianId, alamat } = await varianBerisi([lama]);
  await sisipkanPesanan({
    varianId,
    status: "Menunggu Pembayaran",
    itemStok: { status: "Ditahan", nilai: isiUji("epsilon", "Profil 2") },
  });
  await masukSebagaiAdmin(page);
  await page.goto(alamat);
  await expect(angkaStokVarian(page)).toHaveText("1");

  // Ubah dengan kolom kosong: ditolak dengan pesan di kolom itu, dan form tetap terbuka.
  const baris = itemStokBerisi(page, lama[0]);
  await baris.getByRole("button", { name: "Ubah Item stok 1" }).click();
  const form = formUbah(page, 1);
  await expect(form.getByLabel("Email")).toHaveValue(lama[0]);
  await form.getByLabel("Password").fill(" ");
  await form.getByRole("button", { name: "Simpan Item stok" }).click();
  await expect(
    form.getByText("Password belum diisi. Ketik Password untuk Item stok ini."),
  ).toBeVisible();

  // Ubah dengan isi yang benar: form tertutup dan daftar menampilkan isi barunya.
  const baru = [
    `email-baru-yang-sangat-panjang-${randomUUID()}@contoh-domain-panjang.id`,
    "sandiBaru99",
    "Profil 5",
  ];
  await form.getByLabel("Email").fill(baru[0]);
  await form.getByLabel("Password").fill(baru[1]);
  await form.getByLabel("Profil").fill(baru[2]);
  await form.getByRole("button", { name: "Simpan Item stok" }).click();
  await expect(form).toHaveCount(0);
  const barisBaru = itemStokBerisi(page, baru[0]);
  expect(await kolomItemStok(barisBaru)).toEqual(teksKolom(baru));
  await expect(barisBaru.getByText("Tersedia", { exact: true })).toBeVisible();
  await expect(itemStokBerisi(page, lama[0])).toHaveCount(0);
  await expect(angkaStokVarian(page)).toHaveText("1");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  // Hapus meminta penegasan dulu; Batal tidak menghapus apa pun.
  await barisBaru.getByRole("button", { name: "Hapus Item stok 1" }).click();
  await expect(
    barisBaru.getByText("Hapus Item stok 1? Isinya tidak bisa dikembalikan."),
  ).toBeVisible();
  await barisBaru.getByRole("button", { name: "Batal" }).click();
  await expect(itemStokBerisi(page, baru[0])).toHaveCount(1);

  await barisBaru.getByRole("button", { name: "Hapus Item stok 1" }).click();
  await barisBaru
    .getByRole("button", { name: "Ya, hapus Item stok 1" })
    .click();
  await expect(itemStokBerisi(page, baru[0])).toHaveCount(0);
  await expect(angkaStokVarian(page)).toHaveText("0");
  await expect(chip(page, "Tersedia (0)")).toBeVisible();
  await expect(semuaItemStok(page)).toHaveCount(1);
});

// UAT-D3 langkah 2 dan PRD §4.4: Item stok yang tampil Tersedia saat halaman dibuka, lalu ditahan checkout
// sebelum Admin menyimpan, ditolak server.
test("mengubah atau menghapus Item stok yang sudah Ditahan sejak halaman dibuka ditolak server dengan pesan", async ({
  page,
}) => {
  const nilai = isiUji("zeta", "Profil 1");
  const { varianId, alamat } = await varianBerisi([nilai]);
  await masukSebagaiAdmin(page);
  await page.goto(alamat);
  const baris = itemStokBerisi(page, nilai[0]);
  await expect(baris.getByText("Tersedia", { exact: true })).toBeVisible();

  // Checkout menahan Item stok itu setelah halaman dibuka.
  const { id: pesananId } = await sisipkanPesanan({
    varianId,
    status: "Menunggu Pembayaran",
  });
  await db
    .update(itemStok)
    .set({ status: "Ditahan", pesananId })
    .where(eq(itemStok.varianId, varianId));

  const pesanDitahan = (perbuatan: string) =>
    `Item stok ini tidak ${perbuatan}, karena berstatus Ditahan: Item stok ini sedang disisihkan untuk Pesanan yang menunggu pembayaran. Hanya Item stok Tersedia yang bisa diubah atau dihapus. Muat ulang halaman untuk melihat status terbarunya.`;

  await baris.getByRole("button", { name: "Ubah Item stok 1" }).click();
  const form = formUbah(page, 1);
  await form.getByLabel("Profil").fill("Profil 9");
  await form.getByRole("button", { name: "Simpan Item stok" }).click();
  await expect(form.getByRole("alert")).toHaveText(pesanDitahan("diubah"));
  await form.getByRole("button", { name: "Batal" }).click();

  await baris.getByRole("button", { name: "Hapus Item stok 1" }).click();
  await baris.getByRole("button", { name: "Ya, hapus Item stok 1" }).click();
  await expect(baris.getByRole("alert")).toHaveText(pesanDitahan("dihapus"));

  await page.reload();
  const sekarang = itemStokBerisi(page, nilai[0]);
  await expect(sekarang.getByText("Ditahan", { exact: true })).toBeVisible();
  expect(await kolomItemStok(sekarang)).toEqual(teksKolom(nilai));
});

test("Tamu yang membuka halaman Varian diarahkan ke halaman login, tanpa melihat Item stok", async ({
  page,
}) => {
  const nilai = isiUji("eta", "Profil 1");
  const { alamat } = await varianBerisi([nilai]);

  await page.goto(alamat);

  await expect(page).toHaveURL("/admin");
  await expect(page.getByText(nilai[0])).toHaveCount(0);
});
