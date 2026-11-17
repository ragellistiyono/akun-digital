import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { LAMA_SESI_MEMBER_DETIK } from "@/domain/sesi-member";

import { db } from "../db";
import * as schema from "../db/schema";
import { pluginSesiBaru } from "./plugin-sesi-baru";

// Login Admin dan Member dengan email dan password (PRD §2.2, §7.5, ADR-0001). Rahasia dan alamat
// toko dibaca Better Auth dari BETTER_AUTH_SECRET dan BETTER_AUTH_URL.
// Handler HTTP Better Auth (/api/auth/*) sengaja tidak dipasang: login dan keluar berjalan lewat
// Server Action, dan Admin hanya dibuat lewat `pnpm admin:buat` (PRD §2.2). Pendaftar yang memasukkan
// Kode verifikasi yang benar langsung mendapat sesi lewat pluginSesiBaru (PRD §7.3).
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      // Peran ikut terbaca di sesi, supaya dasbor admin hanya terbuka untuk Admin.
      peran: { type: [...schema.PERAN_AKUN], required: true, input: false },
    },
  },
  session: {
    // Cookie dan baris sesi bertahan selama sesi terpanjang, yaitu sesi Member 30 hari. Lama sesi
    // per peran diperiksa di bacaSesiAdmin (12 jam) dan bacaSesiMember (30 hari). Sesi tidak
    // diperpanjang walaupun pemiliknya aktif.
    expiresIn: LAMA_SESI_MEMBER_DETIK,
    disableSessionRefresh: true,
  },
  // nextCookies harus menjadi plugin terakhir: ia menulis cookie sesi dari Server Action.
  plugins: [pluginSesiBaru(), nextCookies()],
});
