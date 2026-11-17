// Bahan bersama untuk test yang membutuhkan Member. Pendaftaran Member baru dibangun di T42 dan T43,
// jadi Member terverifikasi ditulis langsung ke database. Berkas ini hanya diimpor oleh test.
import { eq } from "drizzle-orm";

import { emailBaku } from "@/domain/kesamaan-email";

import { sisipkanAkun } from "./auth/sisipkan-akun";
import { db } from "./db";
import { user } from "./db/schema";

/**
 * Member terverifikasi dengan email dan password ini, yang langsung bisa login di halaman Masuk. Bila
 * `terdaftarPada` diberikan, waktu Member itu terdaftar diganti dengan instan itu.
 */
export async function sisipkanMember({
  email,
  password,
  terdaftarPada,
}: {
  email: string;
  password: string;
  terdaftarPada?: Date;
}) {
  await sisipkanAkun({ email: emailBaku(email), password, peran: "Member" });
  if (terdaftarPada) {
    await db
      .update(user)
      .set({ createdAt: terdaftarPada })
      .where(eq(user.email, emailBaku(email)));
  }
}
