import { config } from "dotenv";
import { configDefaults, defineConfig } from "vitest/config";

// Test integrasi memakai database app_test dari .env.ci, sama seperti test e2e. Override menimpa
// nilai dari shell atau .env, supaya test tidak pernah menyentuh database pengembangan.
config({ path: ".env.ci", override: true, quiet: true });

export default defineConfig({
  // Alias `@/…` dari tsconfig.json, sama seperti di Next.js.
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
    // Sebelum test pertama, migrasi Drizzle dijalankan ke app_test, lalu app_test dan folder unggahan test
    // dikosongkan.
    globalSetup: ["./e2e/global-setup.ts"],
  },
});
