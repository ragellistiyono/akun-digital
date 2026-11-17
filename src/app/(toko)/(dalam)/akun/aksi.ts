"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth/auth";
import { bacaSesiMember } from "@/server/auth/sesi-member";

/** Tombol "Keluar" di tab Akun: mengakhiri sesi Member, lalu tab Akun tampil lagi untuk Tamu. */
export async function aksiKeluarMember() {
  const kepala = await headers();
  // Hanya sesi Member yang diakhiri di sini. Sesi Admin diakhiri dari dasbor admin.
  if (await bacaSesiMember(kepala)) {
    await auth.api.signOut({ headers: kepala });
  }
  redirect("/akun");
}
