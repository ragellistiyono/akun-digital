import { and, eq, ne } from "drizzle-orm";

import { percobaanGantiPassword } from "@/domain/batas-ganti-password";

import { db } from "../db";
import { account, batasGantiPassword, session } from "../db/schema";
import { auth } from "./auth";

type HasilGantiPassword =
  | { hasil: "berhasil" }
  | { hasil: "password-lama-salah" }
  | { hasil: "terkunci"; terkunciSampai: Date };

/**
 * Ganti password Member dari tab Akun (PRD §7.6 ▶ Keputusan 2026-11-17). Bila password lama salah,
 * password tidak berubah, dan kesalahan itu tidak dihitung ke batas salah password login (PRD §7.7)
 * karena Member sudah login. Kesalahan itu dihitung ke batas salah password lama milik Member itu
 * sendiri (PRD §7.6 ▶ Keputusan 2026-11-17): hasilnya "terkunci" sejak kesalahan kelima sampai
 * kunci berakhir, walaupun password lamanya benar. Bila benar dan tidak terkunci, password baru disimpan,
 * hitungan kembali ke 0, dan semua sesi Member itu berakhir kecuali sesi `idSesi`, yaitu sesi di
 * perangkat yang sedang dipakai. Sesi itu tidak diganti, jadi batas 30 harinya tetap dihitung sejak
 * login semula (PRD §7.5). Panjang password baru sudah diperiksa pemanggil.
 */
export async function gantiPasswordMember({
  idUser,
  idSesi,
  passwordLama,
  passwordBaru,
}: {
  idUser: string;
  idSesi: string;
  passwordLama: string;
  passwordBaru: string;
}): Promise<HasilGantiPassword> {
  const konteks = await auth.$context;
  const hashBaru = await konteks.password.hash(passwordBaru);

  return db.transaction(async (tx) => {
    // Baris akun dikunci, supaya dua penggantian yang datang bersamaan dinilai satu per satu.
    const [akun] = await tx
      .select({ id: account.id, hash: account.password })
      .from(account)
      .where(
        and(
          eq(account.userId, idUser),
          eq(account.providerId, "credential"),
          eq(account.accountId, idUser),
        ),
      )
      .for("update");
    const passwordLamaBenar =
      !!akun?.hash &&
      (await konteks.password.verify({
        hash: akun.hash,
        password: passwordLama,
      }));

    await tx
      .insert(batasGantiPassword)
      .values({ userId: idUser })
      .onConflictDoNothing();
    const [keadaan] = await tx
      .select({
        jumlahSalah: batasGantiPassword.jumlahSalah,
        terkunciSampai: batasGantiPassword.terkunciSampai,
      })
      .from(batasGantiPassword)
      .where(eq(batasGantiPassword.userId, idUser))
      .for("update");
    const { hasil, keadaanBaru } = percobaanGantiPassword({
      keadaan,
      sekarang: new Date(),
      passwordLamaBenar,
    });
    await tx
      .update(batasGantiPassword)
      .set(keadaanBaru)
      .where(eq(batasGantiPassword.userId, idUser));

    // Sejak kesalahan kelima, hasilnya langsung kunci, seperti pesan kunci login (PRD §7.7
    // ▶ Keputusan 2026-11-11).
    if (keadaanBaru.terkunciSampai !== null) {
      return { hasil: "terkunci", terkunciSampai: keadaanBaru.terkunciSampai };
    }
    if (hasil !== "berhasil" || !akun) return { hasil: "password-lama-salah" };

    await tx
      .update(account)
      .set({ password: hashBaru })
      .where(eq(account.id, akun.id));
    await tx
      .delete(session)
      .where(and(eq(session.userId, idUser), ne(session.id, idSesi)));
    return { hasil: "berhasil" };
  });
}
