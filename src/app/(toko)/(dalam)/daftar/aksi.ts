"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { emailBaku } from "@/domain/kesamaan-email";
import {
  PANJANG_PASSWORD_MINIMUM,
  periksaPanjangPassword,
} from "@/domain/panjang-password";
import {
  daftarPendaftar,
  kirimUlangKodeVerifikasi,
} from "@/server/auth/pendaftaran";

import { bacaEmailPendaftar, simpanEmailPendaftar } from "./email-pendaftar";
import {
  type KeadaanFormDaftar,
  type KeadaanKirimUlang,
  PESAN_EMAIL_TERDAFTAR,
  pesanTungguKode,
} from "./pesan-daftar";

const MasukanDaftar = z.object({
  email: z
    .string()
    .overwrite(emailBaku)
    .min(1, "Email belum diisi. Ketik email Anda.")
    .pipe(
      z.email(
        "Penulisan email tidak sah. Periksa lagi, misalnya nama@domain.com.",
      ),
    ),
  // Password disimpan persis seperti diketik, jadi tidak dipangkas (PRD §7.5).
  password: z
    .string()
    .min(
      1,
      `Password belum diisi. Buat password dengan minimal ${PANJANG_PASSWORD_MINIMUM} karakter.`,
    )
    .refine(
      (password) => periksaPanjangPassword(password).valid,
      `Password kurang dari ${PANJANG_PASSWORD_MINIMUM} karakter. Buat password dengan minimal ${PANJANG_PASSWORD_MINIMUM} karakter.`,
    ),
});

/**
 * Form Daftar (PRD §7.2): email dan password menjadi Pendaftar, lalu Kode verifikasi dikirim ke email
 * itu dan Pendaftar dibawa ke halaman verifikasi. Email yang sudah terdaftar dan pendaftaran ulang
 * sebelum jeda 60 detik habis ditolak tanpa mengubah apa pun.
 */
export async function aksiDaftar(
  _sebelumnya: KeadaanFormDaftar,
  formData: FormData,
): Promise<KeadaanFormDaftar> {
  const email = String(formData.get("email") ?? "");
  const masukan = MasukanDaftar.safeParse({
    email,
    password: String(formData.get("password") ?? ""),
  });
  if (!masukan.success) {
    const galat = z.flattenError(masukan.error).fieldErrors;
    return {
      email,
      galat: { email: galat.email?.[0], password: galat.password?.[0] },
    };
  }

  const daftar = await daftarPendaftar(masukan.data);
  if (daftar.hasil === "email-terdaftar") {
    return { email, galat: { umum: PESAN_EMAIL_TERDAFTAR } };
  }
  if (daftar.hasil === "tunggu") {
    return { email, galat: { umum: pesanTungguKode(daftar.tungguDetik) } };
  }

  await simpanEmailPendaftar(masukan.data.email);
  redirect("/daftar/verifikasi");
}

/**
 * Tombol "Kirim ulang kode" di halaman verifikasi (PRD §7.7): mengirim Kode verifikasi baru ke email
 * Pendaftar di browser ini, paling cepat 60 detik setelah kode terakhir. Browser tanpa Pendaftar dibawa
 * kembali ke halaman Daftar.
 */
export async function aksiKirimUlangKode(): Promise<KeadaanKirimUlang> {
  const email = await bacaEmailPendaftar();
  const kirim = email && (await kirimUlangKodeVerifikasi({ email }));
  if (!kirim || kirim.hasil === "bukan-pendaftar") redirect("/daftar");

  if (kirim.hasil === "tunggu") {
    return {
      pesan: { jenis: "galat", teks: pesanTungguKode(kirim.tungguDetik) },
    };
  }
  return {
    pesan: {
      jenis: "terkirim",
      teks: `Kode verifikasi baru sudah kami kirim ke ${email}.`,
    },
  };
}
