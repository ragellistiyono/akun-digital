import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

// DATABASE_URL dan ITEM_STOK_KEY berasal dari .env.ci yang dimuat playwright.config.ts, jadi data ini masuk
// ke database app_test dan Item stok-nya dienkripsi dengan kunci uji. Server e2e memakai Qrispy tiruan dari
// .env.ci (QRISPY_MODE=tiruan), yang pemicu bayarnya ada di POST /api/qrispy-tiruan/bayar.
import type { StatusPesanan } from "../src/domain/status-pesanan";
import { db } from "../src/server/db";
import { pesanan, varian } from "../src/server/db/schema";
import { tambahItemStok } from "../src/server/item-stok";
import { sisipkanProduk } from "../src/server/uji-katalog";
import { sisipkanPesanan } from "../src/server/uji-pesanan";

// Produk bertanda [CONTOH] dengan akhiran unik per run. Namanya bukan Netflix, supaya tidak mengubah
// hasil pencarian "netflix" di cari-kategori-beranda.spec.ts yang berjalan bersamaan.
const akhiran = randomUUID().slice(0, 8);
const emailUnik = () => `budi-${randomUUID()}@example.test`;
let produkId = "";
let varianId = "";

/** id Varian pertama Produk itu. */
async function idVarian(idProduk: string) {
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, idProduk));
  return id;
}

test.beforeAll(async () => {
  produkId = await sisipkanProduk({
    nama: `Halaman Pesanan ${akhiran}`,
    formatItemStok: ["Email", "Password", "Profil"],
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  varianId = await idVarian(produkId);
});

// Koneksi database tidak ditutup di afterAll; lihat catatan di checkout.spec.ts.

test.use({ viewport: { width: 390, height: 800 } });

const isi = (page: Page) => page.getByRole("main");
const blokItemStok = (page: Page) =>
  isi(page).getByRole("region", { name: "Item stok Anda" });

/** Pesanan Selesai dengan Item stok Terkirim berformat `Kode`. Hasilnya Tautan dan Nomor Pesanan-nya. */
function pesananSelesaiKode(kode: string) {
  return sisipkanPesanan({
    varianId,
    status: "Selesai",
    itemStok: {
      status: "Terkirim",
      nilai: [kode],
      formatSaatTerkirim: ["Kode"],
    },
  });
}

/** Rincian nominal PRD §5.5 dari Pesanan sisipkanPesanan: contoh Rp 50.000 − Rp 5.000 + Rp 123. */
async function harapkanRincianContoh(page: Page) {
  const rincian = isi(page).getByRole("region", { name: "Rincian pembayaran" });
  for (const [label, nilai] of [
    ["Harga jual", "Rp 50.000"],
    ["Potongan voucher", "− Rp 5.000"],
    ["Kode unik", "Rp 123"],
    ["Total bayar", "Rp 45.123"],
  ]) {
    await expect(rincian.getByRole("row", { name: label })).toContainText(
      nilai,
    );
  }
}

// UAT-F1, PRD §6.1 dan §6.2.
test("setelah pembayaran lewat Qrispy tiruan, Halaman Pesanan menampilkan Item stok, Salin menyalin nilai kolomnya ke clipboard, dan Tautan Pesanan di browser baru tanpa cookie menampilkan Item stok yang sama", async ({
  page,
  context,
  request,
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const idProduk = await sisipkanProduk({
    nama: `Bayar Lalu Salin ${akhiran}`,
    formatItemStok: ["Email", "Password", "Profil"],
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  // Contoh baris Item stok dari PRD §4.2.
  expect(
    await tambahItemStok({
      produkId: idProduk,
      varianId: await idVarian(idProduk),
      nilai: ["budi@mail.com", "rahasia123", "Profil 2"],
    }),
  ).toEqual({ hasil: "disimpan" });
  const email = emailUnik();
  await page.goto(`/produk/${idProduk}`);
  await page.getByRole("button", { name: /^Beli/ }).click();
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Bayar dengan QRIS" }).click();
  await expect(page).toHaveURL(/\/pesanan\/[A-Za-z0-9_-]{43}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pembayaran" }),
  ).toBeVisible();
  const [dipesan] = await db
    .select({ qrisId: pesanan.qrisId, totalBayar: pesanan.totalBayar })
    .from(pesanan)
    .where(eq(pesanan.email, email));
  const respons = await request.post("/api/qrispy-tiruan/bayar", {
    data: { qrisId: dipesan.qrisId, amount: dipesan.totalBayar },
  });
  expect(respons.status()).toBe(200);

  // Halaman bayar berpindah sendiri ke Halaman Pesanan begitu pembayaran terbaca (paling lama 15 detik).
  await expect(blokItemStok(page)).toBeVisible({ timeout: 20_000 });
  const kolom = [
    ["Email", "budi@mail.com"],
    ["Password", "rahasia123"],
    ["Profil", "Profil 2"],
  ];
  for (const [nama, nilai] of kolom) {
    await expect(
      blokItemStok(page).getByText(nama, { exact: true }),
    ).toBeVisible();
    await expect(
      blokItemStok(page).getByText(nilai, { exact: true }),
    ).toBeVisible();
  }
  for (const [nama, nilai] of kolom) {
    const salin = blokItemStok(page).getByRole("button", {
      name: `Salin ${nama}`,
    });
    await salin.click();
    await expect(salin).toHaveText("Tersalin");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      nilai,
    );
  }

  const tautanPesanan = page.url();
  const browserBaru = await browser.newContext({ baseURL });
  try {
    expect(await browserBaru.cookies()).toEqual([]);
    const halamanBaru = await browserBaru.newPage();
    await halamanBaru.goto(tautanPesanan);
    for (const [nama, nilai] of kolom) {
      await expect(
        blokItemStok(halamanBaru).getByText(nama, { exact: true }),
      ).toBeVisible();
      await expect(
        blokItemStok(halamanBaru).getByText(nilai, { exact: true }),
      ).toBeVisible();
    }
  } finally {
    await browserBaru.close();
  }
});

// Issue T19 dan DESIGN.md "Blok Item stok dan tombol Salin".
test("Halaman Pesanan Selesai dikepalai Nomor Pesanan dalam huruf mono 30 px, diikuti pil status, Item stok dengan nama kolom saat Terkirim, dan rincian nominal, tanpa tombol kirim ulang email", async ({
  page,
}) => {
  const { tautan, nomorPesanan } = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    itemStok: {
      status: "Terkirim",
      nilai: ["miwe.akun07@contoh.id", "Senja-7419", "Profil 3"],
      formatSaatTerkirim: ["Email", "Password", "Profil"],
    },
  });
  await page.goto(`/pesanan/${tautan}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Pesanan" }),
  ).toBeVisible();
  await expect(
    isi(page).getByText("Nomor Pesanan", { exact: true }),
  ).toBeVisible();
  const nomor = isi(page).getByText(nomorPesanan, { exact: true });
  await expect(nomor).toHaveCSS("font-size", "30px");
  await expect(nomor).toHaveCSS("font-weight", "700");
  expect(await nomor.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(
    /JetBrains/,
  );
  await expect(isi(page).getByText("Selesai", { exact: true })).toBeVisible();
  await expect(
    blokItemStok(page).getByRole("button", { name: /^Salin / }),
  ).toHaveCount(3);
  await expect(
    blokItemStok(page).getByText("Senja-7419", { exact: true }),
  ).toBeVisible();
  await harapkanRincianContoh(page);
  // PRD §6.4: Pembeli tidak punya tombol kirim ulang email.
  await expect(
    isi(page).getByRole("button", { name: /kirim ulang/i }),
  ).toHaveCount(0);
  await expect(
    isi(page).getByRole("link", { name: /kirim ulang/i }),
  ).toHaveCount(0);
});

// DESIGN.md "Blok Item stok dan tombol Salin": "Tersalin" dengan ikon Check dan warna st-selesai selama
// 1,6 detik.
test('tombol Salin berubah menjadi "Tersalin" dengan ikon Check dan warna st-selesai selama 1,6 detik, lalu kembali menjadi "Salin"', async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { tautan } = await pesananSelesaiKode("GNS-8Q2K-L7PX");
  await page.emulateMedia({ colorScheme: "light" });
  await page.clock.install();
  await page.goto(`/pesanan/${tautan}`);
  await page.clock.pauseAt(Date.now() + 60_000);
  const salin = blokItemStok(page).getByRole("button", { name: "Salin Kode" });
  await expect(salin).toHaveText("Salin");
  await expect(salin.locator("svg.lucide-copy")).toBeVisible();

  await salin.click();
  await expect(salin).toHaveText("Tersalin");
  await expect(salin.locator("svg.lucide-check")).toBeVisible();
  await expect(salin).toHaveCSS(
    "background-color",
    warnaDesain("st-selesai-bg", "terang"),
  );
  await expect(salin).toHaveCSS("color", warnaDesain("st-selesai", "terang"));
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "GNS-8Q2K-L7PX",
  );

  await page.clock.runFor(1_599);
  await expect(salin).toHaveText("Tersalin");
  await page.clock.runFor(1);
  await expect(salin).toHaveText("Salin");
  await expect(salin.locator("svg.lucide-copy")).toBeVisible();
});

// PRD §11.1: lebar 360 px tanpa gulir ke samping, juga untuk nilai Item stok yang panjang.
test("di lebar 360 px, Halaman Pesanan dengan nilai Item stok yang panjang tidak bisa digulir ke samping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const { tautan } = await pesananSelesaiKode(`KODE-${"8Q2KL7PX".repeat(12)}`);
  await page.goto(`/pesanan/${tautan}`);
  await expect(blokItemStok(page)).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});

// Issue T19: token yang salah menampilkan halaman tidak ditemukan, tanpa membocorkan apakah Pesanan itu ada.
test("token acak yang salah menampilkan halaman tidak ditemukan yang sama, tanpa membocorkan apakah Pesanan itu ada", async ({
  page,
}) => {
  const { tautan, nomorPesanan } = await pesananSelesaiKode(
    `KODE-${randomUUID()}`,
  );
  expect((await page.goto(`/pesanan/${tautan}`))?.status()).toBe(200);

  // Satu karakter berbeda dari Tautan Pesanan yang ada, token acak lain, dan alamat yang bukan token.
  const salah = [
    `${tautan.slice(0, -1)}${tautan.endsWith("A") ? "B" : "A"}`,
    randomBytes(32).toString("base64url"),
    `${tautan}A`,
    "bukan-tautan",
  ];
  const isiHalaman = new Set<string>();
  for (const token of salah) {
    const respons = await page.goto(`/pesanan/${token}`);
    expect(respons?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Pesanan tidak ditemukan" }),
    ).toBeVisible();
    isiHalaman.add(await isi(page).innerText());
  }
  expect(isiHalaman.size).toBe(1);
  expect([...isiHalaman][0]).not.toContain(nomorPesanan);
});

// Issue T19 dan PRD §5.9. Tombol WhatsApp diuji di pengaturan-toko.spec.ts, karena nomor WhatsApp
// berlaku untuk seluruh toko dan hanya berkas itu yang mengubahnya.
test("Pesanan Bermasalah menampilkan pil status dan kalimat bahwa pembayaran sudah diterima tetapi Item stok belum bisa dikirim", async ({
  page,
}) => {
  const { tautan } = await sisipkanPesanan({ varianId, status: "Bermasalah" });
  await page.goto(`/pesanan/${tautan}`);

  await expect(
    isi(page).getByText("Bermasalah", { exact: true }),
  ).toBeVisible();
  await expect(
    isi(page).getByText(
      "Pembayaran Anda sudah kami terima, tetapi Item stok belum bisa dikirim. Hubungi kami lewat WhatsApp.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(blokItemStok(page)).toHaveCount(0);
});

// Issue T19 dan PRD §5.8: Pembeli boleh checkout lagi dari awal.
for (const status of ["Kedaluwarsa", "Dibatalkan"] as const) {
  test(`Pesanan ${status} menampilkan pil status, rincian nominal, dan tautan ke Halaman Produk untuk checkout lagi`, async ({
    page,
  }) => {
    const { tautan } = await sisipkanPesanan({ varianId, status });
    await page.goto(`/pesanan/${tautan}`);

    await expect(isi(page).getByText(status, { exact: true })).toBeVisible();
    await harapkanRincianContoh(page);
    await expect(blokItemStok(page)).toHaveCount(0);
    await isi(page).getByRole("link", { name: "Checkout lagi" }).click();
    await expect(page).toHaveURL(`/produk/${produkId}`);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Halaman Pesanan ${akhiran}`,
      }),
    ).toBeVisible();
  });
}

test("Pesanan Dana Dikembalikan menampilkan pil status dan rincian nominal, tanpa tautan checkout lagi", async ({
  page,
}) => {
  const { tautan } = await sisipkanPesanan({
    varianId,
    status: "Dana Dikembalikan",
  });
  await page.goto(`/pesanan/${tautan}`);

  await expect(
    isi(page).getByText("Dana Dikembalikan", { exact: true }),
  ).toBeVisible();
  await harapkanRincianContoh(page);
  await expect(blokItemStok(page)).toHaveCount(0);
  await expect(
    isi(page).getByRole("link", { name: "Checkout lagi" }),
  ).toHaveCount(0);
});

// Issue T19: Item stok tidak pernah tampil untuk status selain Selesai, juga bila sebuah Item stok tertaut
// ke Pesanan itu.
test("Item stok yang tertaut ke Pesanan tidak pernah tampil untuk status selain Selesai", async ({
  page,
}) => {
  for (const [status, statusItemStok] of [
    ["Menunggu Pembayaran", "Ditahan"],
    ["Kedaluwarsa", "Terkirim"],
    ["Dibatalkan", "Terkirim"],
    ["Bermasalah", "Terkirim"],
    ["Dana Dikembalikan", "Terkirim"],
  ] as const) {
    const rahasia = `rahasia-${randomUUID()}`;
    const { tautan } = await sisipkanPesanan({
      varianId,
      status,
      itemStok: {
        status: statusItemStok,
        nilai: ["budi@mail.com", rahasia, "Profil 2"],
        formatSaatTerkirim: ["Email", "Password", "Profil"],
      },
    });
    await page.goto(`/pesanan/${tautan}`);

    await expect(isi(page).getByText(status, { exact: true })).toBeVisible();
    await expect(page.getByText(rahasia)).toHaveCount(0);
    expect(await page.content()).not.toContain(rahasia);
    await expect(page.getByRole("button", { name: /^Salin/ })).toHaveCount(0);
  }
});

// Warna, ikon, dan label pil setiap status menurut tabel DESIGN.md "Status Pesanan", dengan nilai warna dari
// frontmatter DESIGN.md (sumber nilai yang mengikat).
const DESAIN = readFileSync(
  path.resolve(__dirname, "../docs/DESIGN.md"),
  "utf8",
);

function warnaDesain(token: string, mode: "terang" | "gelap") {
  const cari = (nama: string) =>
    DESAIN.match(new RegExp(`^ {2}${nama}: "#([0-9A-Fa-f]{6})"$`, "m"))?.[1];
  const hex = (mode === "gelap" && cari(`${token}-gelap`)) || cari(token);
  if (!hex) {
    throw new Error(
      `Token warna ${token} tidak ada di frontmatter docs/DESIGN.md. Periksa nama token di tabel "Status Pesanan" dan blok \`colors:\`, lalu jalankan ulang \`pnpm test:e2e\`.`,
    );
  }
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Baris tabel "Status Pesanan": status, ikon lucide, dan token latar/teks mode terang. */
const PIL_DESAIN = [
  ...DESAIN.matchAll(
    /^\| (Menunggu Pembayaran|Selesai|Kedaluwarsa|Dibatalkan|Bermasalah|Dana Dikembalikan) \| `(\w+)` \| `([\w-]+)` \/ `([\w-]+)` \|/gm,
  ),
].map(([, status, ikon, latar, teks]) => ({
  status: status as StatusPesanan,
  // Kelas lucide-react: nama ikon dalam kebab-case, misalnya TriangleAlert menjadi lucide-triangle-alert.
  kelasIkon: `lucide-${ikon.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`,
  latar,
  teks,
}));

async function harapkanPil(
  pil: Locator,
  latar: string,
  teks: string,
  mode: "terang" | "gelap",
) {
  await expect(pil).toHaveCSS("background-color", warnaDesain(latar, mode));
  await expect(pil).toHaveCSS("color", warnaDesain(teks, mode));
}

test("setiap pil status menampilkan warna, ikon, dan label sesuai DESIGN.md bagian Status Pesanan, di mode terang dan gelap", async ({
  page,
}) => {
  expect(PIL_DESAIN.map((baris) => baris.status).sort()).toEqual([
    "Bermasalah",
    "Dana Dikembalikan",
    "Dibatalkan",
    "Kedaluwarsa",
    "Menunggu Pembayaran",
    "Selesai",
  ]);
  for (const { status, kelasIkon, latar, teks } of PIL_DESAIN) {
    const { tautan } = await sisipkanPesanan({
      varianId,
      status,
      itemStok:
        status === "Selesai"
          ? {
              status: "Terkirim",
              nilai: ["budi@mail.com", "rahasia123", "Profil 2"],
              formatSaatTerkirim: ["Email", "Password", "Profil"],
            }
          : undefined,
    });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`/pesanan/${tautan}`);

    const pil = isi(page).getByText(status, { exact: true });
    await expect(pil).toBeVisible();
    await expect(pil.locator(`svg.${kelasIkon}`)).toBeVisible();
    await expect(pil).toHaveCSS("height", "28px");
    await expect(pil).toHaveCSS("font-size", "13px");
    await expect(pil).toHaveCSS("font-weight", "700");
    await harapkanPil(pil, latar, teks, "terang");
    await page.emulateMedia({ colorScheme: "dark" });
    await harapkanPil(pil, latar, teks, "gelap");
  }
});
