import { and, eq } from "drizzle-orm";
import { APIError } from "better-auth";

import { percobaanLogin } from "@/domain/batas-login";
import { emailBaku } from "@/domain/kesamaan-email";

import { db } from "../db";
import { account, batasLogin, user } from "../db/schema";
import { auth } from "./auth";

type HasilMasukAdmin =
  | { hasil: "berhasil" }
  | { hasil: "ditolak" }
  | { hasil: "terkunci"; terkunciSampai: Date };

/**
 * Login Admin dengan email dan password, dengan batas salah password PRD §7.7. Bila berhasil,
 * cookie sesi ditulis lewat plugin nextCookies ke respons Server Action yang memanggilnya.
 * Hasilnya "terkunci" sejak kesalahan kelima sampai kunci berakhir.
 */
export async function masukAdmin({
  email,
  password,
  kepala,
}: {
  email: string;
  password: string;
  kepala: Headers;
}): Promise<HasilMasukAdmin> {
  const emailAdmin = emailBaku(email);
  const { hasil, keadaanBaru } = await nilaiPercobaan(emailAdmin, password);

  if (hasil === "berhasil") {
    // Sesi dibuat setelah transaksi batas login selesai, supaya koneksi transaksi tidak ikut
    // tertahan selama Better Auth memakai koneksi lain dari pool yang sama.
    try {
      await auth.api.signInEmail({
        body: { email: emailAdmin, password },
        headers: kepala,
      });
      return { hasil: "berhasil" };
    } catch (galat) {
      // Password bisa saja berubah di antara pemeriksaan tadi dan pembuatan sesi.
      if (galat instanceof APIError && galat.status === "UNAUTHORIZED") {
        return { hasil: "ditolak" };
      }
      throw galat;
    }
  }

  if (keadaanBaru.terkunciSampai !== null) {
    return { hasil: "terkunci", terkunciSampai: keadaanBaru.terkunciSampai };
  }
  return { hasil: "ditolak" };
}

/**
 * Memeriksa password lalu mencatat percobaan login untuk satu email. Baris email itu dikunci
 * sampai transaksi selesai, supaya percobaan yang datang bersamaan dihitung satu per satu.
 */
async function nilaiPercobaan(email: string, password: string) {
  const konteks = await auth.$context;

  return db.transaction(async (tx) => {
    await tx.insert(batasLogin).values({ email }).onConflictDoNothing();
    const [keadaan] = await tx
      .select({
        jumlahSalah: batasLogin.jumlahSalah,
        terkunciSampai: batasLogin.terkunciSampai,
      })
      .from(batasLogin)
      .where(eq(batasLogin.email, email))
      .for("update");

    // Sama seperti Better Auth: akun password milik user dengan email itu.
    const [akun] = await tx
      .select({ hash: account.password })
      .from(account)
      .innerJoin(user, eq(account.userId, user.id))
      .where(
        and(
          eq(user.email, email),
          eq(account.providerId, "credential"),
          eq(account.accountId, user.id),
        ),
      );
    let passwordBenar = false;
    if (akun?.hash) {
      passwordBenar = await konteks.password.verify({
        hash: akun.hash,
        password,
      });
    } else {
      // Email tidak terdaftar tetap menunggu satu hitungan hash, seperti Better Auth, supaya
      // lama penolakannya tidak membocorkan email Admin.
      await konteks.password.hash(password);
    }

    const percobaan = percobaanLogin({
      keadaan,
      sekarang: new Date(),
      passwordBenar,
    });
    await tx
      .update(batasLogin)
      .set(percobaan.keadaanBaru)
      .where(eq(batasLogin.email, email));
    return percobaan;
  });
}
