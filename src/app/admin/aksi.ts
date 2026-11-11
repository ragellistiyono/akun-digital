"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  BATAS_SALAH_PASSWORD,
  LAMA_KUNCI_LOGIN_MENIT,
} from "@/domain/batas-login";
import { emailBaku } from "@/domain/kesamaan-email";
import { auth } from "@/server/auth/auth";
import { masukAdmin } from "@/server/auth/masuk-admin";
import { jamWibDibulatkanKeAtas } from "@/server/zona-waktu-toko";

export type KeadaanFormMasuk = {
  email: string;
  galat?: { email?: string; password?: string; umum?: string };
};

const MasukanMasuk = z.object({
  email: z
    .string()
    .overwrite(emailBaku)
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

  const masuk = await masukAdmin({
    ...masukan.data,
    kepala: await headers(),
  });
  if (masuk.hasil === "ditolak") {
    return {
      email,
      galat: {
        umum: "Email atau password salah. Periksa keduanya, lalu coba masuk lagi.",
      },
    };
  }
  if (masuk.hasil === "terkunci") {
    // PRD §7.7: pesan menyebut sebabnya dan jam login boleh dicoba lagi dalam WIB.
    const jam = jamWibDibulatkanKeAtas(masuk.terkunciSampai);
    return {
      email,
      galat: {
        umum: `Password salah ${BATAS_SALAH_PASSWORD} kali berturut-turut, jadi login dengan email ini dikunci ${LAMA_KUNCI_LOGIN_MENIT} menit. Coba masuk lagi mulai pukul ${jam} WIB.`,
      },
    };
  }

  redirect("/admin/ringkasan");
}

export async function aksiKeluarAdmin() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin");
}
