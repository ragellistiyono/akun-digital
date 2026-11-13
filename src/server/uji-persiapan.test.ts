import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { siapkanRunTest } from "./uji-persiapan";

// Test integrasi persiapan run test (T34), yang dipanggil e2e/global-setup.ts di awal setiap run
// `pnpm test` dan `pnpm test:e2e`. app_test dan .unggahan/test dipakai bersama test lain yang berjalan
// paralel, jadi mengosongkannya di sini akan merusak test lain. Karena itu, seperti seed-uat.test.ts, test
// ini membuat database sementaranya sendiri di server PostgreSQL yang sama dengan app_test (.env.ci),
// dengan folder unggahan sementara, lalu menghapus keduanya setelah selesai.
const urlAppTest = process.env.DATABASE_URL ?? "";
const databaseSementara: string[] = [];
const folderSementara: string[] = [];

/** Menjalankan `kerja` dengan satu koneksi ke database di `url`, lalu menutup koneksinya. */
async function denganKlien<T>(
  url: string,
  kerja: (klien: postgres.Sql) => Promise<T>,
) {
  const klien = postgres(url, { max: 1, onnotice: () => {} });
  try {
    return await kerja(klien);
  } finally {
    await klien.end();
  }
}

/**
 * Database sementara yang sudah dimigrasi, di server yang sama dengan app_test. `akhiran` menentukan
 * apakah namanya berakhiran `_test`. Hasilnya URL koneksinya.
 */
async function buatDatabaseTermigrasi(akhiran: "_test" | "") {
  const nama = `persiapan_uji_${randomUUID().replaceAll("-", "")}${akhiran}`;
  await denganKlien(
    urlAppTest,
    (klien) => klien`create database ${klien(nama)}`,
  );
  databaseSementara.push(nama);
  const url = new URL(urlAppTest);
  url.pathname = `/${nama}`;
  await denganKlien(url.toString(), (klien) =>
    migrate(drizzle(klien), { migrationsFolder: "drizzle" }),
  );
  return url.toString();
}

/** Baris sisa "run sebelumnya": satu Kategori dengan satu Produk, dan satu catatan batas login. */
async function sisipkanBaris(url: string) {
  await denganKlien(url, async (klien) => {
    const [kategori] = await klien<{ id: string }[]>`
      insert into kategori (nama, ikon) values ('Kategori uji', 'ikon-uji.png') returning id`;
    await klien`
      insert into produk (nama, kategori_id, deskripsi, ketentuan_garansi, format_item_stok)
      values ('Produk uji', ${kategori.id}, 'Deskripsi uji', 'Garansi uji', ${["Email"]})`;
    await klien`insert into batas_login (email) values ('admin@uji.example')`;
  });
}

/** Jumlah baris setiap tabel aplikasi (skema public), dan jumlah baris riwayat migrasi Drizzle. */
async function jumlahBaris(url: string) {
  return denganKlien(url, async (klien) => {
    const semuaTabel = await klien<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public' order by tablename`;
    const tabelAplikasi: Record<string, number> = {};
    for (const { tablename } of semuaTabel) {
      const [{ n }] = await klien<{ n: number }[]>`
        select count(*)::int as n from ${klien(`public.${tablename}`)}`;
      tabelAplikasi[tablename] = n;
    }
    const [{ n: riwayatMigrasi }] = await klien<{ n: number }[]>`
      select count(*)::int as n from drizzle.__drizzle_migrations`;
    return { tabelAplikasi, riwayatMigrasi };
  });
}

/** Folder sementara baru, yang dihapus setelah semua test selesai. */
async function buatFolder() {
  const folder = await mkdtemp(path.join(tmpdir(), "persiapan-uji-"));
  folderSementara.push(folder);
  return folder;
}

/**
 * Folder unggahan sementara beserta berkas .env.ci tiruan yang UPLOAD_DIR-nya menunjuk folder itu, supaya
 * pengosongan bisa diuji tanpa menyentuh .unggahan/test yang sedang dipakai test lain.
 */
async function buatFolderUnggahan() {
  const akar = await buatFolder();
  const folderUnggahan = path.join(akar, "unggahan");
  await mkdir(folderUnggahan);
  const envCi = path.join(akar, ".env.ci");
  await writeFile(envCi, `UPLOAD_DIR=${folderUnggahan}\n`);
  return { folderUnggahan, envCi };
}

/** Isi folder unggahan yang ditaruh taruhBerkas, urut abjad. */
const BERKAS_LAMA = [".tersembunyi", "foto-lama.png", "subfolder"];

/** Menaruh berkas sisa "run sebelumnya" di folder unggahan, termasuk di dalam subfolder. */
async function taruhBerkas(folder: string) {
  await writeFile(path.join(folder, "foto-lama.png"), "foto lama");
  await writeFile(path.join(folder, ".tersembunyi"), "berkas lama");
  await mkdir(path.join(folder, "subfolder"));
  await writeFile(path.join(folder, "subfolder", "ikon.png"), "ikon lama");
}

afterAll(async () => {
  for (const nama of databaseSementara) {
    await denganKlien(
      urlAppTest,
      (klien) => klien`drop database if exists ${klien(nama)} with (force)`,
    );
  }
  for (const folder of folderSementara) {
    await rm(folder, { recursive: true, force: true });
  }
});

describe("persiapan di awal run test", () => {
  it("mengosongkan semua tabel aplikasi di database test, termasuk baris yang disisipkan sebelumnya, dan riwayat migrasi tetap utuh", async () => {
    const url = await buatDatabaseTermigrasi("_test");
    await sisipkanBaris(url);
    const sebelum = await jumlahBaris(url);
    expect(sebelum.tabelAplikasi).toMatchObject({
      kategori: 1,
      produk: 1,
      batas_login: 1,
    });
    expect(sebelum.riwayatMigrasi).toBeGreaterThan(0);

    await siapkanRunTest({
      databaseUrl: url,
      ...(await buatFolderUnggahan()),
    });

    const sesudah = await jumlahBaris(url);
    expect(sesudah.tabelAplikasi).toEqual(
      Object.fromEntries(
        Object.keys(sebelum.tabelAplikasi).map((tabel) => [tabel, 0]),
      ),
    );
    expect(sesudah.riwayatMigrasi).toBe(sebelum.riwayatMigrasi);
  }, 60_000);

  it("mengosongkan folder unggahan test, termasuk berkas yang ditaruh sebelumnya", async () => {
    const url = await buatDatabaseTermigrasi("_test");
    const { folderUnggahan, envCi } = await buatFolderUnggahan();
    await taruhBerkas(folderUnggahan);

    await siapkanRunTest({ databaseUrl: url, folderUnggahan, envCi });

    expect(await readdir(folderUnggahan)).toEqual([]);
  }, 60_000);

  it("berhenti dengan pesan galat tanpa mengosongkan tabel atau menghapus berkas bila nama database tidak berakhiran _test", async () => {
    const url = await buatDatabaseTermigrasi("");
    await sisipkanBaris(url);
    const { folderUnggahan, envCi } = await buatFolderUnggahan();
    await taruhBerkas(folderUnggahan);

    await expect(
      siapkanRunTest({ databaseUrl: url, folderUnggahan, envCi }),
    ).rejects.toThrow(/berakhiran _test/);

    expect((await jumlahBaris(url)).tabelAplikasi).toMatchObject({
      kategori: 1,
      produk: 1,
      batas_login: 1,
    });
    expect((await readdir(folderUnggahan)).sort()).toEqual(BERKAS_LAMA);
  }, 60_000);

  it("berhenti dengan pesan galat tanpa menghapus berkas atau mengosongkan tabel bila folder unggahan bukan UPLOAD_DIR dari .env.ci", async () => {
    const url = await buatDatabaseTermigrasi("_test");
    await sisipkanBaris(url);
    const folderLain = await buatFolder();
    await taruhBerkas(folderLain);

    // Tanpa envCi, folder dibandingkan dengan UPLOAD_DIR dari .env.ci proyek ini (.unggahan/test).
    await expect(
      siapkanRunTest({ databaseUrl: url, folderUnggahan: folderLain }),
    ).rejects.toThrow(/UPLOAD_DIR dari \.env\.ci/);

    expect((await readdir(folderLain)).sort()).toEqual(BERKAS_LAMA);
    expect((await jumlahBaris(url)).tabelAplikasi).toMatchObject({
      kategori: 1,
      produk: 1,
      batas_login: 1,
    });
  }, 60_000);
});
