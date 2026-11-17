import { and, eq } from "drizzle-orm";
import { APIError } from "better-auth";

import { percobaanLogin } from "@/domain/batas-login";
import { emailBaku } from "@/domain/kesamaan-email";

import { db } from "../db";
import { account, batasLogin, user } from "../db/schema";
import { auth } from "./auth";

type HasilMasuk =
  | { hasil: "berhasil" }
  | { hasil: "nonaktif" }
  | { hasil: "ditolak" }
  | { hasil: "terkunci"; terkunciSampai: Date };

type DataMasuk = { email: string; password: string; kepala: Headers };

/**
 * Login Admin di `/admin` (PRD §2.2). Email Member diperlakukan seperti email yang tidak terdaftar,
 * supaya Member tidak mendapat sesi dari halaman login Admin.
 */
export async function masukAdmin(
  data: DataMasuk,
): Promise<Exclude<HasilMasuk, { hasil: "nonaktif" }>> {
  const hasil = await masuk({ ...data, peran: "Admin" });
  if (hasil.hasil === "nonaktif") {
    throw new Error(
      `Admin ${data.email} tercatat nonaktif, padahal hanya Member yang bisa dinonaktifkan (PRD §2.3). Periksa kolom nonaktif baris user Admin itu di database.`,
    );
  }
  return hasil;
}

/**
 * Login Member di halaman Masuk (PRD §7.5 ▶ Keputusan 2026-11-17). Email Admin diperlakukan seperti
 * email yang tidak terdaftar. Hitungan salah password sama dengan login Admin, per email (PRD §7.7).
 * Member nonaktif dengan password benar mendapat hasil "nonaktif" tanpa sesi; password salahnya
 * dihitung seperti biasa.
 */
export function masukMember(data: DataMasuk): Promise<HasilMasuk> {
  return masuk({ ...data, peran: "Member" });
}

/**
 * Login dengan email dan password untuk satu peran, dengan batas salah password PRD §7.7. Bila
 * berhasil, cookie sesi ditulis lewat plugin nextCookies ke respons Server Action yang memanggilnya.
 * Hasilnya "terkunci" sejak kesalahan kelima sampai kunci berakhir.
 */
async function masuk({
  email,
  password,
  kepala,
  peran,
}: DataMasuk & { peran: "Admin" | "Member" }): Promise<HasilMasuk> {
  const emailBakunya = emailBaku(email);
  const { hasil, keadaanBaru } = await nilaiPercobaan(
    emailBakunya,
    password,
    peran,
  );

  if (hasil === "nonaktif") return { hasil: "nonaktif" };
  if (hasil === "berhasil") {
    // Sesi dibuat setelah transaksi batas login selesai, supaya koneksi transaksi tidak ikut
    // tertahan selama Better Auth memakai koneksi lain dari pool yang sama.
    try {
      await auth.api.signInEmail({
        body: { email: emailBakunya, password },
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
async function nilaiPercobaan(
  email: string,
  password: string,
  peran: "Admin" | "Member",
) {
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

    // Sama seperti Better Auth: akun password milik user dengan email itu, hanya untuk peran yang
    // boleh login di halaman ini. Email peran lain dinilai seperti email yang tidak terdaftar.
    const [akun] = await tx
      .select({ hash: account.password, nonaktif: user.nonaktif })
      .from(account)
      .innerJoin(user, eq(account.userId, user.id))
      .where(
        and(
          eq(user.email, email),
          eq(user.peran, peran),
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
      // lama penolakannya tidak membocorkan email yang terdaftar.
      await konteks.password.hash(password);
    }

    const percobaan = percobaanLogin({
      keadaan,
      sekarang: new Date(),
      passwordBenar,
      memberNonaktif: akun?.nonaktif ?? false,
    });
    await tx
      .update(batasLogin)
      .set(percobaan.keadaanBaru)
      .where(eq(batasLogin.email, email));
    return percobaan;
  });
}
