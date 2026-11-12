import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Test integrasi `pnpm db:seed` (T31). Kriteria penerimaannya meminta seed di database kosong, padahal
// app_test dipakai bersama test lain yang berjalan paralel. Jadi test ini membuat database sementaranya
// sendiri di server PostgreSQL yang sama dengan app_test (.env.ci), memigrasinya seperti
// e2e/global-setup.ts, lalu menghapusnya setelah selesai. Folder unggahannya juga folder sementara.
//
// Modul server membaca DATABASE_URL saat dimuat, jadi modul-modul itu baru diimpor setelah DATABASE_URL
// menunjuk database sementara. Vitest memuat ulang modul untuk setiap berkas test, sehingga test lain
// tetap memakai app_test.
const jalankan = promisify(execFile);

const urlAppTest = process.env.DATABASE_URL ?? "";
const namaDatabase = `seed_uji_${randomUUID().replaceAll("-", "")}`;
const urlSementara = new URL(urlAppTest);
urlSementara.pathname = `/${namaDatabase}`;

const lingkunganAsli = {
  DATABASE_URL: process.env.DATABASE_URL,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
};
let folderUnggahan = "";

let katalog: typeof import("./katalog");
let koneksi: typeof import("./db").koneksi;

/**
 * Menjalankan `pnpm db:seed` terhadap database dan folder unggahan sementara. Proses seed mewarisi
 * variabel lingkungan test ini, yang didahulukan atas .env, jadi database pengembangan tidak tersentuh.
 */
async function jalankanSeed() {
  await jalankan("pnpm", ["run", "--silent", "db:seed"], {
    env: { ...process.env },
  });
}

/** Jumlah baris setiap tabel yang diisi seed, dan jumlah berkas di folder unggahan. */
async function jumlahData() {
  const { sql } = await import("drizzle-orm");
  const { db } = await import("./db");
  const tabel = [
    "user",
    "kategori",
    "produk",
    "varian",
    "item_stok",
    "pesanan",
    "riwayat_status_pesanan",
    "pengaturan_toko",
  ] as const;
  const jumlah: Record<string, number> = {};
  for (const nama of tabel) {
    const [{ n }] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(nama)}`,
    );
    jumlah[nama] = n;
  }
  jumlah.berkas = (await readdir(folderUnggahan)).length;
  return jumlah;
}

beforeAll(async () => {
  const admin = postgres(urlAppTest, { max: 1, onnotice: () => {} });
  try {
    await admin`create database ${admin(namaDatabase)}`;
  } finally {
    await admin.end();
  }
  const klien = postgres(urlSementara.toString(), {
    max: 1,
    onnotice: () => {},
  });
  try {
    await migrate(drizzle(klien), { migrationsFolder: "drizzle" });
  } finally {
    await klien.end();
  }

  folderUnggahan = await mkdtemp(path.join(tmpdir(), "seed-uji-unggahan-"));
  process.env.DATABASE_URL = urlSementara.toString();
  process.env.UPLOAD_DIR = folderUnggahan;

  katalog = await import("./katalog");
  ({ koneksi } = await import("./db"));

  await jalankanSeed();
}, 120_000);

afterAll(async () => {
  await koneksi?.end();
  process.env.DATABASE_URL = lingkunganAsli.DATABASE_URL;
  process.env.UPLOAD_DIR = lingkunganAsli.UPLOAD_DIR;
  const admin = postgres(urlAppTest, { max: 1, onnotice: () => {} });
  try {
    await admin`drop database if exists ${admin(namaDatabase)} with (force)`;
  } finally {
    await admin.end();
  }
  if (folderUnggahan) {
    await rm(folderUnggahan, { recursive: true, force: true });
  }
}, 60_000);

// Ekspektasi diambil dari kriteria penerimaan issue T31 dan "Persiapan bersama" di docs/UAT.md, yang
// bertanda [CONTOH].
describe("pnpm db:seed di database kosong", () => {
  it("toko menampilkan Netflix Premium 1 Bulan dengan Stok 10 dan Harga normal Rp 75.000", async () => {
    const { semua } = await katalog.daftarProdukBeranda();
    const netflix = semua.find((k) => k.nama === "Netflix Premium");
    expect(netflix).toBeDefined();

    const halaman = await katalog.bacaHalamanProduk(netflix?.id ?? "");
    const satuBulan = halaman?.varian.find((v) => v.nama === "1 Bulan");
    expect(satuBulan).toMatchObject({
      hargaJual: 50000,
      hargaNormal: 75000,
      stokVarian: 10,
    });
  });

  it("toko menampilkan YouTube Premium 1 Bulan dengan Stok 0, Spotify Premium Habis, dan Uji Bayar Rp 1.000 dengan Stok 10", async () => {
    const { semua } = await katalog.daftarProdukBeranda();
    const kartu = (nama: string) => semua.find((k) => k.nama === nama);

    const youtube = await katalog.bacaHalamanProduk(
      kartu("YouTube Premium")?.id ?? "",
    );
    expect(youtube?.varian.find((v) => v.nama === "1 Bulan")).toMatchObject({
      hargaJual: 20000,
      stokVarian: 0,
    });
    expect(kartu("Spotify Premium")).toMatchObject({
      habis: true,
      harga: 25000,
    });
    expect(kartu("Uji Bayar")).toMatchObject({ harga: 1000, mulai: false });
    const ujiBayar = await katalog.bacaHalamanProduk(
      kartu("Uji Bayar")?.id ?? "",
    );
    expect(ujiBayar?.varian).toMatchObject([
      { hargaJual: 1000, stokVarian: 10 },
    ]);
  });

  it("Game Lama nonaktif dan tidak tampil di toko, sehingga Kategori Game juga tidak tampil", async () => {
    const produk = await import("./produk");
    expect(
      (await produk.daftarProduk()).find((p) => p.nama === "Game Lama"),
    ).toMatchObject({ namaKategori: "Game", aktif: false });

    const { semua, kategori } = await katalog.daftarProdukBeranda();
    expect(semua.map((k) => k.nama)).not.toContain("Game Lama");
    expect(kategori.map((k) => k.nama)).toEqual(["Musik", "Streaming"]);
  });

  // Login di /admin memanggil masukAdmin lewat Server Action (src/app/admin/aksi.ts).
  it("Admin admin@miwe.example bisa login di /admin dengan password dari berkas seed", async () => {
    const { ADMIN_SEED } = await import("./seed-uat");
    const { masukAdmin } = await import("./auth/masuk-admin");
    expect(ADMIN_SEED.email).toBe("admin@miwe.example");
    expect(
      await masukAdmin({
        email: ADMIN_SEED.email,
        password: ADMIN_SEED.password,
        kepala: new Headers(),
      }),
    ).toEqual({ hasil: "berhasil" });
  });

  it("daftar Pesanan dasbor admin menampilkan dua Pesanan Bermasalah Netflix Premium 1 Bulan dan satu Pesanan Selesai member@miwe.example tanpa voucher", async () => {
    const { daftarPesanan } = await import("./daftar-pesanan");
    const { bacaDetailPesanan } = await import("./detail-pesanan");

    const { pesanan, jumlah } = await daftarPesanan({});
    expect(jumlah).toBe(3);
    const bermasalah = pesanan.filter((p) => p.status === "Bermasalah");
    expect(bermasalah).toHaveLength(2);
    for (const p of bermasalah) {
      expect(p).toMatchObject({
        namaProduk: "Netflix Premium",
        namaVarian: "1 Bulan",
      });
    }
    const selesai = pesanan.filter((p) => p.status === "Selesai");
    expect(selesai).toHaveLength(1);
    expect(selesai[0].email).toBe("member@miwe.example");

    const detail = await bacaDetailPesanan(selesai[0].nomorPesanan);
    expect(detail?.rincian.potonganVoucher).toBe(0);
    expect(detail?.itemStok).not.toBeNull();
  });

  it("pengaturan toko berisi nomor WhatsApp contoh serta teks Syarat & Ketentuan dan Kebijakan Privasi contoh", async () => {
    const { bacaPengaturanToko } = await import("./pengaturan-toko");
    const pengaturan = await bacaPengaturanToko();
    // Nomor tersimpan dalam bentuk rapi PRD §9.8: angka saja, diawali 62.
    expect(pengaturan.nomorWhatsapp).toMatch(/^62[0-9]+$/);
    expect(pengaturan.syaratKetentuan).not.toBe("");
    expect(pengaturan.kebijakanPrivasi).not.toBe("");
  });

  it("Kategori dan Produk yang tampil di toko punya gambar contoh PNG di folder unggahan", async () => {
    const { bacaBerkasUnggahan } = await import("./berkas-unggahan");
    const { semua, kategori } = await katalog.daftarProdukBeranda();
    const alamat = [
      ...kategori.map((k) => k.alamatIkon),
      ...semua.map((k) => k.fotoSampul),
    ];
    expect(alamat).toHaveLength(6);
    for (const satu of alamat) {
      const nama = (satu ?? "").replace("/unggahan/", "");
      expect((await bacaBerkasUnggahan(nama))?.jenis, nama).toBe("image/png");
    }
  });

  it("isi Item stok seed tidak tersimpan sebagai teks asli di database", async () => {
    const { sql } = await import("drizzle-orm");
    const { db } = await import("./db");
    const { daftarProduk } = await import("./produk");
    const { daftarVarian } = await import("./varian");
    const { daftarItemStokVarian } = await import("./item-stok");

    // Isi asli setiap kolom, dibuka dengan ITEM_STOK_KEY lewat daftar Item stok dasbor admin (PRD §9.7).
    const isiAsli: string[] = [];
    for (const p of await daftarProduk()) {
      for (const v of await daftarVarian(p.id)) {
        for (const item of await daftarItemStokVarian({ varianId: v.id })) {
          isiAsli.push(...item.kolom.map((k) => k.nilai));
        }
      }
    }
    expect(isiAsli).toContain("netflix-a@miwe.example");
    expect(isiAsli).toContain("UJIBAYAR-CONTOH-01");

    // Tidak ada baris item_stok, di kolom mana pun, yang memuat isi asli itu.
    for (const nilai of new Set(isiAsli)) {
      const [{ n }] = await db.execute<{ n: number }>(
        sql`select count(*)::int as n from item_stok where strpos(item_stok::text, ${nilai}) > 0`,
      );
      expect(n, nilai).toBe(0);
    }
  });

  it("menjalankan seed dua kali tidak menggandakan data", async () => {
    const sebelum = await jumlahData();
    // Jumlah dari "Persiapan bersama": 6 Varian (Game Lama tanpa Varian), 28 Item stok (Netflix 1 Bulan
    // 10 Tersedia dan 1 Terkirim ke Pesanan Selesai, Netflix 3 Bulan 4, YouTube 3 Bulan 3, Uji Bayar 10),
    // dan 8 berkas gambar (3 ikon Kategori dan 5 foto Produk).
    expect(sebelum).toEqual({
      user: 1,
      kategori: 3,
      produk: 5,
      varian: 6,
      item_stok: 28,
      pesanan: 3,
      riwayat_status_pesanan: 6,
      pengaturan_toko: 1,
      berkas: 8,
    });

    await jalankanSeed();

    expect(await jumlahData()).toEqual(sebelum);
  }, 120_000);
});
