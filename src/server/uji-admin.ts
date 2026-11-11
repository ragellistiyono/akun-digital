// Bahan bersama untuk test integrasi Server Action dasbor admin. Berkas ini hanya diimpor oleh test.
import { randomUUID } from "node:crypto";

import { auth } from "./auth/auth";
import { buatAdmin } from "./auth/buat-admin";

const PASSWORD = "sandi-uji-admin-123";

/** Header permintaan berisi cookie sesi milik Admin baru, seperti yang dikirim browser setelah login. */
export async function cookieAdminBaru() {
  const email = `admin-${randomUUID()}@example.test`;
  await buatAdmin({ email, password: PASSWORD });
  const { headers: kepalaRespons } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  // Ambil pasangan nama=nilai cookie sesi dari Set-Cookie, seperti yang dikirim browser kembali.
  const cookie = kepalaRespons
    .getSetCookie()
    .map((baris) => baris.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

/** Apakah galat yang dilempar Server Action adalah pengalihan Next.js ke alamat ini. */
export function arahKe(alamat: string) {
  return (galat: unknown) =>
    typeof galat === "object" &&
    galat !== null &&
    "digest" in galat &&
    typeof galat.digest === "string" &&
    galat.digest.split(";")[2] === alamat;
}

/** Apakah galat yang dilempar Server Action adalah halaman tidak ditemukan (notFound) Next.js. */
export function tidakDitemukan(galat: unknown) {
  return (
    typeof galat === "object" &&
    galat !== null &&
    "digest" in galat &&
    galat.digest === "NEXT_HTTP_ERROR_FALLBACK;404"
  );
}
