"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  PANJANG_PASSWORD_MINIMUM,
  periksaPanjangPassword,
} from "@/domain/panjang-password";
import { auth } from "@/server/auth/auth";
import { gantiPasswordMember } from "@/server/auth/ganti-password";
import { bacaSesiMember } from "@/server/auth/sesi-member";

import {
  type KeadaanFormGantiPassword,
  PESAN_PASSWORD_LAMA_SALAH,
  PESAN_PASSWORD_SUDAH_DIGANTI,
  pesanGantiPasswordTerkunci,
} from "./pesan-akun";

/** Tombol "Keluar" di tab Akun: mengakhiri sesi Member, lalu tab Akun tampil lagi untuk Tamu. */
export async function aksiKeluarMember() {
  const kepala = await headers();
  // Hanya sesi Member yang diakhiri di sini. Sesi Admin diakhiri dari dasbor admin.
  if (await bacaSesiMember(kepala)) {
    await auth.api.signOut({ headers: kepala });
  }
  redirect("/akun");
}

// Password tidak dipangkas, karena disimpan dan dicocokkan persis seperti diketik (PRD §7.5).
const MasukanGantiPassword = z.object({
  passwordLama: z
    .string()
    .min(
      1,
      "Password lama belum diisi. Ketik password yang Anda pakai sekarang.",
    ),
  passwordBaru: z
    .string()
    .min(
      1,
      `Password baru belum diisi. Buat password baru dengan minimal ${PANJANG_PASSWORD_MINIMUM} karakter.`,
    )
    .refine(
      (password) => periksaPanjangPassword(password).valid,
      `Password baru kurang dari ${PANJANG_PASSWORD_MINIMUM} karakter. Buat password baru dengan minimal ${PANJANG_PASSWORD_MINIMUM} karakter.`,
    ),
});

/**
 * Form ganti password di tab Akun (PRD §7.6 ▶ Keputusan 2026-11-17). Password lama yang salah ditolak
 * tanpa mengganti password. Sejak kesalahan kelima berturut-turut, ganti password ditolak dengan pesan
 * kunci sampai kunci berakhir. Setelah diganti, Member keluar di perangkat lain dan tetap masuk di
 * perangkat ini. Permintaan tanpa sesi Member dibawa kembali ke tab Akun.
 */
export async function aksiGantiPassword(
  _sebelumnya: KeadaanFormGantiPassword,
  formData: FormData,
): Promise<KeadaanFormGantiPassword> {
  const sesiMember = await bacaSesiMember(await headers());
  if (!sesiMember) redirect("/akun");

  const masukan = MasukanGantiPassword.safeParse({
    passwordLama: String(formData.get("passwordLama") ?? ""),
    passwordBaru: String(formData.get("passwordBaru") ?? ""),
  });
  if (!masukan.success) {
    const galat = z.flattenError(masukan.error).fieldErrors;
    return {
      galat: {
        passwordLama: galat.passwordLama?.[0],
        passwordBaru: galat.passwordBaru?.[0],
      },
    };
  }

  const ganti = await gantiPasswordMember({
    idUser: sesiMember.user.id,
    idSesi: sesiMember.session.id,
    ...masukan.data,
  });
  if (ganti.hasil === "password-lama-salah") {
    return { galat: { umum: PESAN_PASSWORD_LAMA_SALAH } };
  }
  if (ganti.hasil === "terkunci") {
    return {
      galat: { umum: pesanGantiPasswordTerkunci(ganti.terkunciSampai) },
    };
  }
  return { berhasil: PESAN_PASSWORD_SUDAH_DIGANTI };
}
