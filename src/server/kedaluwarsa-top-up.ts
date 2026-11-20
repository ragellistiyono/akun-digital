// Kedaluwarsa Top up (PRD §15.3, mengikuti §5.8 dan ADR-0004). Kapan waktu kedaluwarsa tercapai ditentukan
// kedaluwarsaPesanan di src/domain/kedaluwarsa-pesanan.ts, karena aturannya sama dengan Pesanan; Top up yang boleh
// menjadi Kedaluwarsa ditentukan perpindahanStatusTopUp di src/domain/status-top-up.ts. Pekerjaannya dijadwalkan dan
// dijalankan pg-boss lewat pekerjaan-latar.ts.
import { eq } from "drizzle-orm";

import { kedaluwarsaPesanan } from "@/domain/kedaluwarsa-pesanan";
import { perpindahanStatusTopUp } from "@/domain/status-top-up";

import { db } from "./db";
import { riwayatStatusTopUp, topUp } from "./db/schema";
import { teruskanStatusDibayarTopUp } from "./kabar-pembayaran-top-up";
import { qrispyAktif, type Qrispy, type StatusQris } from "./qrispy";

/** Pelaku perubahan status karena kedaluwarsa di Riwayat status Top up (PRD §15.4). */
const PELAKU_KEDALUWARSA = "Sistem";

type HasilKedaluwarsaTopUp =
  | { hasil: "tidak-ditemukan" }
  | { hasil: "tidak-berubah" }
  | { hasil: "belum-kedaluwarsa"; kedaluwarsaPada: Date }
  | { hasil: "diproses-sebagai-dibayar" }
  | { hasil: "kedaluwarsa" };

/**
 * Menanyakan status QRIS ke Qrispy satu kali. Status yang gagal ditanyakan menjadi null, dan kegagalannya dicatat di
 * log.
 */
async function tanyaStatusQris(
  qrispy: Qrispy,
  qrisId: string,
): Promise<StatusQris | null> {
  try {
    return await qrispy.cekStatusQris(qrisId);
  } catch (galat) {
    console.error(
      `Status QRIS ${qrisId} gagal ditanyakan ke Qrispy saat Top up-nya kedaluwarsa, jadi pembayarannya dianggap belum masuk dan Top up dijadikan Kedaluwarsa. Kabar pembayaran yang datang sesudahnya tetap diproses sebagai kabar terlambat (PRD §15.5).`,
      galat,
    );
    return null;
  }
}

/**
 * Menjadikan Top up itu Kedaluwarsa dalam satu transaksi, selama perpindahannya masih boleh. Baris Top up dikunci
 * lebih dulu, seperti pembatalan, jadi kedaluwarsa dan pembatalan yang bersamaan diproses satu per satu. Hasilnya
 * false bila status Top up sudah berubah.
 */
async function jadikanKedaluwarsa(topUpId: string, sekarang: Date) {
  return db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({ status: topUp.status })
      .from(topUp)
      .where(eq(topUp.id, topUpId))
      .for("update");
    if (
      !perpindahanStatusTopUp({ dari: terkunci.status, ke: "Kedaluwarsa" })
        .boleh
    ) {
      return false;
    }
    await tx
      .update(topUp)
      .set({ status: "Kedaluwarsa" })
      .where(eq(topUp.id, topUpId));
    await tx.insert(riwayatStatusTopUp).values({
      topUpId,
      waktu: sekarang,
      status: "Kedaluwarsa",
      pelaku: PELAKU_KEDALUWARSA,
    });
    return true;
  });
}

/**
 * Pekerjaan latar kedaluwarsa satu Top up (PRD §15.3, §5.8), yang dijadwalkan pada waktu kedaluwarsa Top up itu.
 *
 * - Top up yang sudah tidak Menunggu Pembayaran tidak berubah, dan Qrispy tidak ditanya.
 * - Selama waktu kedaluwarsanya belum tercapai, Top up juga tidak berubah. Hasilnya membawa waktu itu, supaya
 *   pekerjaannya bisa dijadwalkan ulang.
 * - Begitu waktunya tercapai, status QRIS-nya ditanyakan ke Qrispy sekali. Status `paid` diteruskan ke
 *   prosesKabarPembayaranTopUp dengan `amount` sebagai nominal diterima, jadi Top up diproses sebagai sudah dibayar
 *   (PRD §15.5).
 * - Selain itu, termasuk bila statusnya gagal ditanyakan, Top up menjadi Kedaluwarsa tepat waktu, dan Riwayat status
 *   Top up mencatat Sistem sebagai pelakunya.
 *
 * Adaptor Qrispy dan waktu "sekarang" bisa diganti untuk test.
 */
export async function prosesKedaluwarsaTopUp(
  topUpId: string,
  { qrispy, sekarang = new Date() }: { qrispy?: Qrispy; sekarang?: Date } = {},
): Promise<HasilKedaluwarsaTopUp> {
  const [dibaca] = await db
    .select({
      status: topUp.status,
      qrisId: topUp.qrisId,
      kedaluwarsaPada: topUp.kedaluwarsaPada,
    })
    .from(topUp)
    .where(eq(topUp.id, topUpId));
  if (!dibaca) return { hasil: "tidak-ditemukan" };
  if (
    !perpindahanStatusTopUp({ dari: dibaca.status, ke: "Kedaluwarsa" }).boleh
  ) {
    return { hasil: "tidak-berubah" };
  }
  const { kedaluwarsaPada } = dibaca;
  if (!kedaluwarsaPesanan({ kedaluwarsaPada, sekarang }).kedaluwarsa) {
    return { hasil: "belum-kedaluwarsa", kedaluwarsaPada };
  }

  const status = await tanyaStatusQris(qrispy ?? qrispyAktif(), dibaca.qrisId);
  if (await teruskanStatusDibayarTopUp(dibaca.qrisId, status, { sekarang })) {
    return { hasil: "diproses-sebagai-dibayar" };
  }

  return (await jadikanKedaluwarsa(topUpId, sekarang))
    ? { hasil: "kedaluwarsa" }
    : { hasil: "tidak-berubah" };
}
