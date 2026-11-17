"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { emailBaku } from "@/domain/kesamaan-email";
import { masukMember } from "@/server/auth/masuk";

import {
  type KeadaanFormMasuk,
  PESAN_PASSWORD_SALAH,
  pesanLoginTerkunci,
} from "../../../_masuk/pesan-masuk";

const MasukanMasuk = z.object({
  email: z
    .string()
    .overwrite(emailBaku)
    .min(1, "Email belum diisi. Ketik email Anda.")
    .pipe(
      z.email(
        "Penulisan email tidak sah. Periksa lagi, misalnya nama@domain.com.",
      ),
    ),
  password: z.string().min(1, "Password belum diisi. Ketik password Anda."),
});

/**
 * Login Member (PRD §7.5 ▶ Keputusan 2026-11-17). Pesan password salah dan pesan kunci sama dengan
 * login Admin. Setelah berhasil, Member dibawa ke Riwayat Pesanan.
 */
export async function aksiMasukMember(
  _sebelumnya: KeadaanFormMasuk,
  formData: FormData,
): Promise<KeadaanFormMasuk> {
  const email = String(formData.get("email") ?? "");
  const masukan = MasukanMasuk.safeParse({
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

  const masuk = await masukMember({
    ...masukan.data,
    kepala: await headers(),
  });
  if (masuk.hasil === "ditolak") {
    return { email, galat: { umum: PESAN_PASSWORD_SALAH } };
  }
  if (masuk.hasil === "terkunci") {
    return {
      email,
      galat: { umum: pesanLoginTerkunci(masuk.terkunciSampai) },
    };
  }

  redirect("/riwayat");
}
