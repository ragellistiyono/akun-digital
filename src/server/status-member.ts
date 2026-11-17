// Menonaktifkan dan mengaktifkan kembali Member (PRD §2.3 ▶ Keputusan 2026-11-17). Pemeriksaan bahwa yang
// mengubah adalah Admin dilakukan Server Action pemanggilnya.
import { and, eq } from "drizzle-orm";

import { db } from "./db";
import { session, user } from "./db/schema";

/**
 * Mengubah status Member itu menjadi nonaktif atau aktif lagi. Begitu dinonaktifkan, semua sesi Member itu
 * dihapus di transaksi yang sama, sehingga ia langsung keluar di semua perangkat. Setelah diaktifkan kembali,
 * Member login lagi seperti biasa. Hasilnya "tidak-ada" bila tidak ada Member dengan id itu; Admin tidak
 * pernah diubah.
 */
export async function ubahStatusMember({
  idMember,
  nonaktif,
}: {
  idMember: string;
  nonaktif: boolean;
}): Promise<{ hasil: "diubah" } | { hasil: "tidak-ada" }> {
  return db.transaction(async (tx) => {
    const diubah = await tx
      .update(user)
      .set({ nonaktif })
      .where(and(eq(user.id, idMember), eq(user.peran, "Member")))
      .returning({ id: user.id });
    if (diubah.length === 0) return { hasil: "tidak-ada" };

    if (nonaktif) await tx.delete(session).where(eq(session.userId, idMember));
    return { hasil: "diubah" };
  });
}
