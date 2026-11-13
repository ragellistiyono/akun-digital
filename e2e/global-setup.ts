import { siapkanRunTest } from "../src/server/uji-persiapan";

// Memigrasi database test (DATABASE_URL dari .env.ci), lalu mengosongkan database itu dan folder unggahan
// test (UPLOAD_DIR dari .env.ci), supaya setiap run dimulai kosong (T34).
// Dipakai sebagai global setup oleh Playwright (`pnpm test:e2e`) dan Vitest (`pnpm test`).
export default async function globalSetup() {
  await siapkanRunTest({
    databaseUrl: process.env.DATABASE_URL,
    folderUnggahan: process.env.UPLOAD_DIR,
  });
}
