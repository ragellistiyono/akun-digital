"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { emailBaku } from "@/domain/kesamaan-email";
import {
  PANJANG_PASSWORD_MINIMUM,
  periksaPanjangPassword,
} from "@/domain/panjang-password";
import { bacaAjakanHalamanPesanan } from "@/server/ajakan-halaman-pesanan";
import {
  daftarPendaftar,
  kirimUlangKodeVerifikasi,
  masukkanKodeVerifikasi,
} from "@/server/auth/pendaftaran";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { TautanPesanan } from "@/server/pesanan";

import {
  bacaEmailPendaftar,
  hapusEmailPendaftar,
  simpanEmailPendaftar,
} from "./email-pendaftar";
import {
  type KeadaanFormAjakan,
  type KeadaanFormDaftar,
  type KeadaanFormKode,
  type KeadaanKirimUlang,
  PESAN_EMAIL_TERDAFTAR,
  PESAN_KODE_HANGUS,
  PESAN_KODE_KEDALUWARSA,
  PESAN_KODE_SALAH,
  pesanTungguKode,
} from "./pesan-daftar";
import {
  denganTujuan,
  PARAMETER_TUJUAN,
  TUJUAN_SETELAH_VERIFIKASI,
  tujuanAman,
} from "./tujuan";

// Password disimpan persis seperti diketik, jadi tidak dipangkas (PRD §7.5).
const PasswordBaru = z
  .string()
  .min(
    1,
    `Password belum diisi. Buat password dengan minimal ${PANJANG_PASSWORD_MINIMUM} karakter.`,
  )
  .refine(
    (password) => periksaPanjangPassword(password).valid,
    `Password kurang dari ${PANJANG_PASSWORD_MINIMUM} karakter. Buat password dengan minimal ${PANJANG_PASSWORD_MINIMUM} karakter.`,
  );

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
  password: PasswordBaru,
});

/**
 * Form Daftar (PRD §7.2): email dan password menjadi Pendaftar, lalu Kode verifikasi dikirim ke email
 * itu dan Pendaftar dibawa ke halaman verifikasi, dengan tujuan setelah verifikasi yang dibawa form ini (PRD §7.3
 * ▶ Keputusan 2026-11-22). Email yang sudah terdaftar dan pendaftaran ulang sebelum jeda 60 detik habis ditolak
 * tanpa mengubah apa pun.
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
  redirect(
    denganTujuan(
      "/daftar/verifikasi",
      tujuanAman(formData.get(PARAMETER_TUJUAN)),
    ),
  );
}

/**
 * Ajakan "Buat akun untuk menyimpan riwayat" di Halaman Pesanan Selesai (PRD §7.1, §7.2 ▶ Keputusan
 * 2026-11-17): pemegang Tautan Pesanan membuat password, lalu email Pesanan itu menjadi Pendaftar dan
 * Kode verifikasi dikirim ke email itu. Alur dan penolakannya sama dengan form Daftar. Email diambil dari
 * Pesanan, bukan dari form. Bila Halaman Pesanan itu tidak mendapat ajakan buat akun, misalnya Member sedang
 * login atau email Pesanan sudah milik Member, Pembeli dibawa kembali ke Halaman Pesanan itu.
 */
export async function aksiDaftarLewatPesanan(
  _sebelumnya: KeadaanFormAjakan,
  formData: FormData,
): Promise<KeadaanFormAjakan> {
  const sesiMember = await bacaSesiMember(await headers());
  const tautan = TautanPesanan.safeParse(formData.get("tautan"));
  if (!tautan.success) notFound();
  const password = PasswordBaru.safeParse(
    String(formData.get("password") ?? ""),
  );

  // Kewenangannya adalah memegang Tautan Pesanan yang Halaman Pesanan-nya mendapat ajakan buat akun.
  const ajakan = await bacaAjakanHalamanPesanan({
    tautan: tautan.data,
    emailMemberLogin: sesiMember?.user.email ?? null,
  });
  if (!ajakan) notFound();
  if (ajakan.ajakan !== "buat-akun") redirect(`/pesanan/${tautan.data}`);

  if (!password.success) {
    return { galat: { password: password.error.issues[0].message } };
  }

  const email = emailBaku(ajakan.emailPesanan);
  const daftar = await daftarPendaftar({ email, password: password.data });
  if (daftar.hasil === "email-terdaftar") {
    return { galat: { umum: PESAN_EMAIL_TERDAFTAR } };
  }
  if (daftar.hasil === "tunggu") {
    return { galat: { umum: pesanTungguKode(daftar.tungguDetik) } };
  }

  await simpanEmailPendaftar(email);
  redirect("/daftar/verifikasi");
}

/**
 * Tombol "Kirim ulang kode" di halaman verifikasi (PRD §7.7): mengirim Kode verifikasi baru ke email
 * Pendaftar di browser ini, paling cepat 60 detik setelah kode terakhir. Browser tanpa Pendaftar dibawa
 * kembali ke halaman Daftar, dengan tujuan setelah verifikasi yang dibawa form ini (PRD §7.3 ▶ Keputusan
 * 2026-11-22).
 */
export async function aksiKirimUlangKode(
  formData: FormData,
): Promise<KeadaanKirimUlang> {
  const email = await bacaEmailPendaftar();
  const kirim = email && (await kirimUlangKodeVerifikasi({ email }));
  if (!kirim || kirim.hasil === "bukan-pendaftar") {
    redirect(
      denganTujuan("/daftar", tujuanAman(formData.get(PARAMETER_TUJUAN))),
    );
  }

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
 * Kode yang benar mengaktifkan akun Member, lalu Pendaftar langsung masuk dan dibawa ke tujuan yang dibawa form ini,
 * misalnya halaman Top up (PRD §7.3 ▶ Keputusan 2026-11-22). Tanpa tujuan, atau bila tujuannya menunjuk ke luar
 * toko, Member baru dibawa ke Riwayat Pesanan (PRD §7.3 ▶ Keputusan 2026-11-17). Kode yang salah, kedaluwarsa, atau
 * hangus ditolak dengan sebabnya. Browser tanpa Pendaftar dibawa kembali ke halaman Daftar dengan tujuan yang sama.
 */
export async function aksiMasukkanKode(
  _sebelumnya: KeadaanFormKode,
  formData: FormData,
): Promise<KeadaanFormKode> {
  const tujuan = tujuanAman(formData.get(PARAMETER_TUJUAN));
  const email = await bacaEmailPendaftar();
  if (!email) redirect(denganTujuan("/daftar", tujuan));

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
  if (masukkan.hasil === "bukan-pendaftar") {
    redirect(denganTujuan("/daftar", tujuan));
  }
  if (masukkan.hasil !== "aktif") {
    return { galat: { umum: PESAN_PENOLAKAN_KODE[masukkan.hasil] } };
  }

  await hapusEmailPendaftar();
  redirect(tujuan ?? TUJUAN_SETELAH_VERIFIKASI);
}
