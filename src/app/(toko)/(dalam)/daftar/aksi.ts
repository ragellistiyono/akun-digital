"use server";

import { headers } from "next/headers";
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
  masukkanKodeVerifikasi,
} from "@/server/auth/pendaftaran";

import {
  bacaEmailPendaftar,
  hapusEmailPendaftar,
  simpanEmailPendaftar,
} from "./email-pendaftar";
import {
  type KeadaanFormDaftar,
  type KeadaanFormKode,
  type KeadaanKirimUlang,
  PESAN_EMAIL_TERDAFTAR,
  PESAN_KODE_HANGUS,
  PESAN_KODE_KEDALUWARSA,
  PESAN_KODE_SALAH,
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

const MasukanKode = z.object({
  kode: z
    .string()
    .trim()
    .min(
      1,
      "Kode verifikasi belum diisi. Ketik kode 6 angka di email terakhir dari kami.",
    )
    .regex(
      /^\d{6}$/,
      "Kode verifikasi terdiri dari 6 angka. Periksa lagi kode di email terakhir dari kami.",
    ),
});

const PESAN_PENOLAKAN_KODE = {
  salah: PESAN_KODE_SALAH,
  kedaluwarsa: PESAN_KODE_KEDALUWARSA,
  hangus: PESAN_KODE_HANGUS,
  "email-terdaftar": PESAN_EMAIL_TERDAFTAR,
} as const;

/**
 * Isian Kode verifikasi di halaman verifikasi (PRD §7.3, §7.7): kode untuk Pendaftar di browser ini.
 * Kode yang benar mengaktifkan akun Member, lalu Pendaftar langsung masuk dan dibawa ke Riwayat Pesanan
 * (PRD §7.3 ▶ Keputusan 2026-11-17). Kode yang salah, kedaluwarsa, atau hangus ditolak dengan sebabnya.
 * Browser tanpa Pendaftar dibawa kembali ke halaman Daftar.
 */
export async function aksiMasukkanKode(
  _sebelumnya: KeadaanFormKode,
  formData: FormData,
): Promise<KeadaanFormKode> {
  const email = await bacaEmailPendaftar();
  if (!email) redirect("/daftar");

  const masukan = MasukanKode.safeParse({
    kode: String(formData.get("kode") ?? ""),
  });
  if (!masukan.success) {
    return {
      galat: { kode: z.flattenError(masukan.error).fieldErrors.kode?.[0] },
    };
  }

  const masukkan = await masukkanKodeVerifikasi({
    email,
    kode: masukan.data.kode,
    kepala: await headers(),
  });
  if (masukkan.hasil === "bukan-pendaftar") redirect("/daftar");
  if (masukkan.hasil !== "aktif") {
    return { galat: { umum: PESAN_PENOLAKAN_KODE[masukkan.hasil] } };
  }

  await hapusEmailPendaftar();
  redirect("/riwayat");
}
