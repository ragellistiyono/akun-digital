import { APIError } from "better-auth";

import { auth } from "./auth";

type HasilMasukAdmin = { hasil: "berhasil" } | { hasil: "ditolak" };

/**
 * Login Admin dengan email dan password. Bila berhasil, cookie sesi ditulis lewat plugin
 * nextCookies ke respons Server Action yang memanggilnya.
 */
export async function masukAdmin({
  email,
  password,
  kepala,
}: {
  email: string;
  password: string;
  kepala: Headers;
}): Promise<HasilMasukAdmin> {
  try {
    await auth.api.signInEmail({ body: { email, password }, headers: kepala });
    return { hasil: "berhasil" };
  } catch (galat) {
    // Better Auth menolak email yang tidak terdaftar dan password yang salah dengan galat yang sama.
    if (galat instanceof APIError && galat.status === "UNAUTHORIZED") {
      return { hasil: "ditolak" };
    }
    throw galat;
  }
}
