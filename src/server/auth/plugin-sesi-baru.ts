import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

/**
 * Plugin Better Auth untuk membuat sesi bagi user yang baru dibuktikan lewat Kode verifikasi, tanpa
 * password (PRD §7.3 ▶ Keputusan 2026-11-17). Endpoint-nya hanya bisa dipanggil dari kode server lewat
 * `auth.api.buatSesiTanpaPassword`, tidak pernah lewat HTTP. Cookie sesinya ditulis sama seperti login
 * biasa, lalu plugin nextCookies meneruskannya ke respons Server Action.
 */
export function pluginSesiBaru() {
  return {
    id: "sesi-baru",
    endpoints: {
      buatSesiTanpaPassword: createAuthEndpoint.serverOnly(
        { method: "POST", body: z.object({ idUser: z.string().min(1) }) },
        async (ctx) => {
          const pemilik = await ctx.context.internalAdapter.findUserById(
            ctx.body.idUser,
          );
          if (!pemilik) {
            throw ctx.error("NOT_FOUND", {
              message: "User untuk sesi baru tidak ditemukan.",
            });
          }
          const sesi = await ctx.context.internalAdapter.createSession(
            pemilik.id,
          );
          await setSessionCookie(ctx, { session: sesi, user: pemilik });
          return ctx.json({ idSesi: sesi.id });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
