import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { LAMA_SESI_ADMIN_DETIK } from "@/domain/sesi-admin";

import { db } from "../db";
import * as schema from "../db/schema";

// Login Admin dengan email dan password (PRD §2.2, ADR-0001). Rahasia dan alamat toko dibaca
// Better Auth dari BETTER_AUTH_SECRET dan BETTER_AUTH_URL.
// Handler HTTP Better Auth (/api/auth/*) sengaja tidak dipasang: login dan keluar berjalan lewat
// Server Action, dan Admin hanya dibuat lewat `pnpm admin:buat` (PRD §2.2).
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  session: {
    // Sesi berakhir 12 jam sejak login dan tidak diperpanjang walaupun Admin aktif.
    expiresIn: LAMA_SESI_ADMIN_DETIK,
    disableSessionRefresh: true,
  },
  // nextCookies harus menjadi plugin terakhir: ia menulis cookie sesi dari Server Action.
  plugins: [nextCookies()],
});
