import { cookies } from "next/headers";
import { z } from "zod";

// Email Pendaftar yang baru mendaftar di browser ini, disimpan di cookie supaya halaman verifikasi tahu
// ke email mana Kode verifikasi dikirim, tanpa menaruh email di alamat halaman.
const COOKIE_EMAIL_PENDAFTAR = "email-pendaftar";
const UMUR_COOKIE_DETIK = 24 * 60 * 60;

/** Menyimpan email Pendaftar di cookie browser ini. */
export async function simpanEmailPendaftar(email: string) {
  (await cookies()).set(COOKIE_EMAIL_PENDAFTAR, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UMUR_COOKIE_DETIK,
  });
}

/** Email Pendaftar yang tersimpan di cookie browser ini, atau null bila tidak ada atau tidak sah. */
export async function bacaEmailPendaftar() {
  const isi = (await cookies()).get(COOKIE_EMAIL_PENDAFTAR)?.value;
  const email = z.email().safeParse(isi);
  return email.success ? email.data : null;
}

/** Menghapus email Pendaftar dari cookie browser ini, setelah ia menjadi Member. */
export async function hapusEmailPendaftar() {
  (await cookies()).delete(COOKIE_EMAIL_PENDAFTAR);
}
