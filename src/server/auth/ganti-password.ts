import { and, eq, ne } from "drizzle-orm";

import { db } from "../db";
import { account, session } from "../db/schema";
import { auth } from "./auth";

type HasilGantiPassword =
  { hasil: "berhasil" } | { hasil: "password-lama-salah" };

/**
 * Ganti password Member dari tab Akun (PRD §7.6 ▶ Keputusan 2026-11-17). Bila password lama salah,
 * tidak ada yang berubah, dan kesalahan itu tidak dihitung ke batas salah password login (PRD §7.7)
 * karena Member sudah login. Bila benar, password baru disimpan dan semua sesi Member itu berakhir
 * kecuali sesi `idSesi`, yaitu sesi di perangkat yang sedang dipakai. Sesi itu tidak diganti, jadi
 * batas 30 harinya tetap dihitung sejak login semula (PRD §7.5). Panjang password baru sudah
 * diperiksa pemanggil.
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
    if (!akun || !passwordLamaBenar) return { hasil: "password-lama-salah" };

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
