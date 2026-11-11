import { eq } from "drizzle-orm";
import { generateId } from "better-auth";

import { db } from "../db";
import { account, user } from "../db/schema";
import { auth } from "./auth";

type HasilBuatAdmin = { hasil: "dibuat" } | { hasil: "email-sudah-dipakai" };

/**
 * Membuat Admin baru dengan email dan password (PRD §2.2). Dipanggil oleh `pnpm admin:buat`;
 * masukannya sudah divalidasi di sana. User dan akun password-nya ditulis dalam satu transaksi,
 * dengan format yang sama seperti pendaftaran email Better Auth, supaya Admin bisa langsung login.
 */
export async function buatAdmin({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<HasilBuatAdmin> {
  const emailKecil = email.toLowerCase();
  const sudahAda = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, emailKecil));
  if (sudahAda.length > 0) return { hasil: "email-sudah-dipakai" };

  const konteks = await auth.$context;
  const hash = await konteks.password.hash(password);

  await db.transaction(async (tx) => {
    const idUser = generateId();
    await tx.insert(user).values({
      id: idUser,
      name: "Admin",
      email: emailKecil,
      emailVerified: true,
    });
    await tx.insert(account).values({
      id: generateId(),
      accountId: idUser,
      providerId: "credential",
      userId: idUser,
      password: hash,
    });
  });

  return { hasil: "dibuat" };
}
