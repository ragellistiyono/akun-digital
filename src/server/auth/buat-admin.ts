import { eq } from "drizzle-orm";

import { emailBaku } from "@/domain/kesamaan-email";

import { db } from "../db";
import { user } from "../db/schema";
import { sisipkanAkun } from "./sisipkan-akun";

type HasilBuatAdmin =
  | { hasil: "dibuat" }
  | { hasil: "email-sudah-dipakai" }
  | { hasil: "email-milik-member" };

/**
 * Membuat Admin baru dengan email dan password (PRD §2.2). Dipanggil oleh `pnpm admin:buat`;
 * masukannya sudah divalidasi di sana. Satu email hanya bisa menjadi Admin atau Member
 * (PRD §7.2 ▶ Keputusan 2026-11-17), jadi email Member ditolak.
 */
export async function buatAdmin({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<HasilBuatAdmin> {
  const emailAdmin = emailBaku(email);
  const [pemilik] = await db
    .select({ peran: user.peran })
    .from(user)
    .where(eq(user.email, emailAdmin));
  if (pemilik?.peran === "Member") return { hasil: "email-milik-member" };
  if (pemilik) return { hasil: "email-sudah-dipakai" };

  await sisipkanAkun({ email: emailAdmin, password, peran: "Admin" });
  return { hasil: "dibuat" };
}
