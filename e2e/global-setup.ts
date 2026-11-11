import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Menjalankan semua migrasi di drizzle/ ke database test (DATABASE_URL dari .env.ci).
// Dipakai sebagai global setup oleh Playwright (`pnpm test:e2e`) dan Vitest (`pnpm test`).
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL kosong, jadi migrasi database test tidak bisa dijalankan. Isi DATABASE_URL di .env.ci dengan database app_test, lalu jalankan ulang `pnpm test` atau `pnpm test:e2e`.",
    );
  }

  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}
