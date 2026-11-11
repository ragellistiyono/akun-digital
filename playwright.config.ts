import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Test e2e selalu memakai .env.ci (database app_test). Override menimpa nilai dari
// shell atau .env, supaya e2e tidak pernah menyentuh database pengembangan.
config({ path: ".env.ci", override: true, quiet: true });

const port = Number(process.env.E2E_PORT || 3100);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(
    `E2E_PORT bernilai "${process.env.E2E_PORT}", padahal harus berupa nomor port. Perbaiki atau kosongkan E2E_PORT (bawaannya 3100), lalu jalankan ulang \`pnpm test:e2e\`.`,
  );
}
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  use: {
    baseURL,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${port}`,
    // Playwright menunggu server siap sebelum globalSetup memigrasi database. Beranda membaca katalog
    // dari database, jadi kesiapan diperiksa di tab Riwayat, yang tidak membaca database.
    url: `${baseURL}/riwayat`,
    // Server yang sudah berjalan bisa saja memuat .env pengembangan, jadi tidak dipakai ulang.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
