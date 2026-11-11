import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Menjalankan semua migrasi di drizzle/ ke database e2e (DATABASE_URL dari .env.ci).
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL kosong, jadi migrasi e2e tidak bisa dijalankan. Isi DATABASE_URL di .env.ci dengan database app_test, lalu jalankan ulang `pnpm test:e2e`.",
    );
  }

  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}
