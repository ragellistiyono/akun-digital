import { generateId } from "better-auth";

import { db } from "../db";
import { account, user } from "../db/schema";
import { auth } from "./auth";

type Transaksi = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Menulis user beserta akun password-nya di transaksi itu, dengan format yang sama seperti pendaftaran
 * email Better Auth, supaya akun itu bisa langsung login. Email sudah dalam bentuk baku (PRD §7.4),
 * password sudah berupa hash Better Auth, dan pemanggil sudah memastikan email itu belum dipakai.
 * Hasilnya id user baru.
 */
export async function tulisAkun(
  tx: Transaksi,
  {
    email,
    hash,
    peran,
  }: { email: string; hash: string; peran: "Admin" | "Member" },
) {
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
  return idUser;
}

/**
 * Menulis user beserta akun password-nya dalam satu transaksi (lihat tulisAkun). Email sudah dalam
 * bentuk baku (PRD §7.4), dan pemanggil sudah memastikan email itu belum dipakai.
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

  await db.transaction((tx) => tulisAkun(tx, { email, hash, peran }));
}
