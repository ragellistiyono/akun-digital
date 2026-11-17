"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  PANJANG_PASSWORD_MINIMUM,
  periksaPanjangPassword,
} from "@/domain/panjang-password";
import { aturUlangPassword } from "@/server/auth/atur-ulang-password";

import { TANDA_PASSWORD_DIGANTI } from "../../masuk/password-diganti";
import {
  type KeadaanFormAturUlang,
  TautanAturUlang,
} from "./tautan-atur-ulang";

// Password tidak dipangkas, karena disimpan dan dicocokkan persis seperti diketik (PRD §7.5).
const PasswordBaru = z
  .string()
  .min(
    1,
    `Password baru belum diisi. Buat password dengan minimal ${PANJANG_PASSWORD_MINIMUM} karakter.`,
  )
  .refine(
    (password) => periksaPanjangPassword(password).valid,
    `Password baru kurang dari ${PANJANG_PASSWORD_MINIMUM} karakter. Buat password dengan minimal ${PANJANG_PASSWORD_MINIMUM} karakter.`,
  );

/**
 * Menyimpan password baru lewat Tautan atur ulang password (PRD §7.5 ▶ Keputusan 2026-11-17). Setelah
 * berhasil, Member dibawa ke halaman Masuk dengan pesan bahwa password sudah diganti. Bila tautan ternyata
 * tidak berlaku lagi saat form dikirim, misalnya 30 menitnya habis selagi form terbuka, halaman tautan itu
 * dimuat ulang sehingga menampilkan alasannya.
 */
export async function aksiAturUlangPassword(
  tautanDiAlamat: string,
  _sebelumnya: KeadaanFormAturUlang,
  formData: FormData,
): Promise<KeadaanFormAturUlang> {
  const tautan = TautanAturUlang.safeParse(tautanDiAlamat);
  if (!tautan.success) redirect("/lupa-password");

  const passwordBaru = PasswordBaru.safeParse(
    String(formData.get("passwordBaru") ?? ""),
  );
  if (!passwordBaru.success) {
    return { galat: z.flattenError(passwordBaru.error).formErrors[0] };
  }

  const atur = await aturUlangPassword({
    tautan: tautan.data,
    passwordBaru: passwordBaru.data,
  });
  if (atur.hasil !== "berhasil") {
    redirect(`/atur-ulang-password/${tautan.data}`);
  }
  redirect(
    `/masuk?${TANDA_PASSWORD_DIGANTI.nama}=${TANDA_PASSWORD_DIGANTI.nilai}`,
  );
}
