// Persiapan di awal setiap run `pnpm test` dan `pnpm test:e2e`, dipanggil e2e/global-setup.ts sebelum test
// pertama. Database dan folder unggahan test dikosongkan di sini, supaya data dan berkas dari run
// sebelumnya tidak menumpuk (T34). Berkas ini hanya diimpor oleh setup test itu dan test-nya.
import { readFileSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { parse } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Nama database di URL koneksi PostgreSQL, atau teks kosong bila URL itu tidak bisa dibaca. */
function namaDatabase(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    return "";
  }
}

/**
 * Kode galat PostgreSQL saat kunci tabel tidak didapat dalam batas lock_timeout (55P03) dan saat deadlock
 * (40P01). Pengosongan yang gagal karena salah satunya dicoba lagi.
 */
const GALAT_KUNCI = new Set(["55P03", "40P01"]);
const BATAS_TUNGGU_KUNCI = "200ms";
const PERCOBAAN_PENGOSONGAN = 50;
const JEDA_PERCOBAAN_MS = 100;

/**
 * Mengosongkan isi semua tabel aplikasi (skema public). Riwayat migrasi Drizzle ada di skema drizzle.
 *
 * Di Playwright, server test sudah berjalan saat setup ini dijalankan, dan pekerjaan latarnya bisa sedang
 * memakai tabel aplikasi. TRUNCATE mengunci tabel satu per satu, jadi bisa saling tunggu (deadlock)
 * dengan pekerjaan itu. Karena itu, setiap percobaan hanya menunggu kunci sebentar, lalu melepas semua
 * kuncinya dan dicoba lagi setelah jeda.
 */
async function kosongkanTabelAplikasi(klien: postgres.Sql) {
  const semuaTabel = await klien<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'`;
  if (semuaTabel.length === 0) return;
  const daftarTabel = semuaTabel.map(({ tablename }) => `public.${tablename}`);

  for (let percobaan = 1; ; percobaan++) {
    try {
      await klien.begin(async (tx) => {
        await tx`select set_config('lock_timeout', ${BATAS_TUNGGU_KUNCI}, true)`;
        await tx`truncate table ${tx(daftarTabel)}`;
      });
      return;
    } catch (galat) {
      if (
        !(galat instanceof postgres.PostgresError) ||
        !GALAT_KUNCI.has(galat.code)
      ) {
        throw galat;
      }
      if (percobaan >= PERCOBAAN_PENGOSONGAN) {
        throw new Error(
          `Tabel aplikasi di database test tidak bisa dikosongkan setelah ${PERCOBAAN_PENGOSONGAN} percobaan, karena terus dipakai proses lain. Hentikan proses lain yang memakai database test, misalnya \`pnpm test\` atau \`pnpm test:e2e\` yang masih berjalan, lalu jalankan ulang perintahnya.`,
          { cause: galat },
        );
      }
      await new Promise((selesai) => setTimeout(selesai, JEDA_PERCOBAAN_MS));
    }
  }
}

/** Menghapus semua isi folder, termasuk subfolder. Folder yang belum ada dibiarkan. */
async function kosongkanFolder(folder: string) {
  const semuaNama = await readdir(folder).catch((galat: unknown) => {
    if ((galat as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw galat;
  });
  await Promise.all(
    semuaNama.map((nama) =>
      rm(path.join(folder, nama), { recursive: true, force: true }),
    ),
  );
}

/**
 * Menyiapkan database dan folder unggahan test sebelum test pertama: memigrasi database test, lalu
 * mengosongkan semua tabel aplikasinya dan folder unggahan test.
 *
 * Pengamannya diperiksa sebelum apa pun disentuh: nama database harus berakhiran `_test`, dan folder
 * unggahan harus sama dengan UPLOAD_DIR di berkas `envCi` (bawaannya .env.ci). Bila salah satunya tidak
 * terpenuhi, run berhenti dengan galat tanpa menghapus apa pun.
 */
export async function siapkanRunTest({
  databaseUrl,
  folderUnggahan,
  envCi = ".env.ci",
}: {
  databaseUrl?: string;
  folderUnggahan?: string;
  envCi?: string;
}) {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL kosong, jadi migrasi database test tidak bisa dijalankan. Isi DATABASE_URL di .env.ci dengan database app_test, lalu jalankan ulang `pnpm test` atau `pnpm test:e2e`.",
    );
  }
  const database = namaDatabase(databaseUrl);
  if (!database.endsWith("_test")) {
    throw new Error(
      `Run test dihentikan sebelum menghapus apa pun, karena DATABASE_URL menunjuk database "${database}", padahal pengosongan di awal run test hanya boleh menyentuh database yang namanya berakhiran _test. Arahkan DATABASE_URL di .env.ci ke database app_test, pastikan konfigurasi test memuat .env.ci, lalu jalankan ulang \`pnpm test\` atau \`pnpm test:e2e\`.`,
    );
  }
  const folderEnvCi = parse(readFileSync(envCi)).UPLOAD_DIR;
  if (
    !folderUnggahan ||
    !folderEnvCi ||
    path.resolve(folderUnggahan) !== path.resolve(folderEnvCi)
  ) {
    throw new Error(
      `Run test dihentikan sebelum menghapus apa pun, karena folder unggahan "${folderUnggahan ?? ""}" bukan UPLOAD_DIR dari ${envCi} ("${folderEnvCi ?? ""}"), padahal hanya folder itu yang boleh dikosongkan di awal run test. Pastikan konfigurasi test memuat ${envCi} dan UPLOAD_DIR di sana menunjuk folder unggahan test, lalu jalankan ulang \`pnpm test\` atau \`pnpm test:e2e\`.`,
    );
  }

  const klien = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(klien), { migrationsFolder: "drizzle" });
    await kosongkanTabelAplikasi(klien);
  } finally {
    await klien.end();
  }
  await kosongkanFolder(path.resolve(folderUnggahan));
}
