"use server";

import { z } from "zod";

import { emailBaku } from "@/domain/kesamaan-email";
import { kirimTautanAturUlangPassword } from "@/server/auth/atur-ulang-password";

import {
  type KeadaanFormLupaPassword,
  PESAN_TAUTAN_TERKIRIM,
} from "./pesan-lupa-password";

const MasukanLupaPassword = z.object({
  email: z
    .string()
    .overwrite(emailBaku)
    .min(1, "Email belum diisi. Ketik email Anda.")
    .pipe(
      z.email(
        "Penulisan email tidak sah. Periksa lagi, misalnya nama@domain.com.",
      ),
    ),
});

/**
 * Form Lupa password (PRD §7.5 ▶ Keputusan 2026-11-17): meminta Tautan atur ulang password untuk email itu.
 * Setelah email yang sah diisi, halaman selalu menampilkan pesan yang sama, apa pun emailnya dan apakah
 * tautan benar-benar dikirim.
 */
export async function aksiLupaPassword(
  _sebelumnya: KeadaanFormLupaPassword,
  formData: FormData,
): Promise<KeadaanFormLupaPassword> {
  const email = String(formData.get("email") ?? "");
  const masukan = MasukanLupaPassword.safeParse({ email });
  if (!masukan.success) {
    return {
      email,
      galat: z.flattenError(masukan.error).fieldErrors.email?.[0],
    };
  }

  await kirimTautanAturUlangPassword(masukan.data);
  return { email, pesan: PESAN_TAUTAN_TERKIRIM };
}
