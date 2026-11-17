import { generateId } from "better-auth";

import { db } from "../db";
import { account, user } from "../db/schema";
import { auth } from "./auth";

/**
 * Menulis user beserta akun password-nya dalam satu transaksi, dengan format yang sama seperti
 * pendaftaran email Better Auth, supaya akun itu bisa langsung login. Email sudah dalam bentuk baku
 * (PRD §7.4), dan pemanggil sudah memastikan email itu belum dipakai.
 */
export async function sisipkanAkun({
  email,
  password,
  peran,
}: {
  email: string;
  password: string;
  peran: "Admin" | "Member";
}) {
  const konteks = await auth.$context;
  const hash = await konteks.password.hash(password);

  await db.transaction(async (tx) => {
    const idUser = generateId();
    await tx.insert(user).values({
      id: idUser,
      name: peran,
      email,
      peran,
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
}
