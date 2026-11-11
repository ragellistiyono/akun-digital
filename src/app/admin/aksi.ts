"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth/auth";
import { masukAdmin } from "@/server/auth/masuk-admin";

export type KeadaanFormMasuk = {
  email: string;
  galat?: { email?: string; password?: string; umum?: string };
};

const MasukanMasuk = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email belum diisi. Ketik email Admin Anda.")
    .pipe(
      z.email(
        "Penulisan email tidak sah. Periksa lagi, misalnya nama@domain.com.",
      ),
    ),
  password: z
    .string()
    .min(1, "Password belum diisi. Ketik password Admin Anda."),
});

export async function aksiMasukAdmin(
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

  const { hasil } = await masukAdmin({
    ...masukan.data,
    kepala: await headers(),
  });
  if (hasil === "ditolak") {
    return {
      email,
      galat: {
        umum: "Email atau password salah. Periksa keduanya, lalu coba masuk lagi.",
      },
    };
  }

  redirect("/admin/ringkasan");
}

export async function aksiKeluarAdmin() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin");
}
