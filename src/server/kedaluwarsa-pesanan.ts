// Kedaluwarsa Pesanan (PRD §5.3, §5.7, §5.8, ADR-0004). Kapan waktu kedaluwarsa tercapai ditentukan
// kedaluwarsaPesanan di src/domain/kedaluwarsa-pesanan.ts; Pesanan yang boleh menjadi Kedaluwarsa
// ditentukan perpindahanStatusPesanan di src/domain/status-pesanan.ts. Pekerjaannya dijadwalkan dan
// dijalankan pg-boss lewat pekerjaan-latar.ts.
import { and, eq } from "drizzle-orm";

import { kedaluwarsaPesanan } from "@/domain/kedaluwarsa-pesanan";
import { perpindahanStatusPesanan } from "@/domain/status-pesanan";

import { db } from "./db";
import { itemStok, pesanan, riwayatStatusPesanan } from "./db/schema";
import { prosesKabarPembayaran } from "./kabar-pembayaran";
import { qrispyAktif, type Qrispy, type StatusQris } from "./qrispy";

/** Pelaku perubahan status karena kedaluwarsa di Riwayat status Pesanan. */
const PELAKU_KEDALUWARSA = "Sistem";

type HasilKedaluwarsaPesanan =
  | { hasil: "tidak-ditemukan" }
  | { hasil: "tidak-berubah" }
  | { hasil: "belum-kedaluwarsa"; kedaluwarsaPada: Date }
  | { hasil: "diproses-sebagai-dibayar" }
  | { hasil: "kedaluwarsa" };

/**
 * Menanyakan status QRIS ke Qrispy satu kali. Status yang gagal ditanyakan, misalnya karena Qrispy menjawab
 * 429 atau tidak menjawab, menjadi null, dan kegagalannya dicatat di log.
 */
async function tanyaStatusQris(
  qrispy: Qrispy,
  qrisId: string,
): Promise<StatusQris | null> {
  try {
    return await qrispy.cekStatusQris(qrisId);
  } catch (galat) {
    console.error(
      `Status QRIS ${qrisId} gagal ditanyakan ke Qrispy saat Pesanan-nya kedaluwarsa, jadi pembayarannya dianggap belum masuk dan Pesanan dijadikan Kedaluwarsa. Kabar pembayaran yang datang sesudahnya tetap diproses sebagai kabar terlambat (PRD §5.9).`,
      galat,
    );
    return null;
  }
}

/**
 * Menjadikan Pesanan itu Kedaluwarsa dalam satu transaksi, selama perpindahannya masih boleh. Baris
 * Pesanan dikunci lebih dulu, seperti di prosesKabarPembayaran dan pembatalan, sehingga kedaluwarsa,
 * kabar pembayaran, dan pembatalan yang datang bersamaan diproses satu per satu. Item stok yang
 * ditahannya kembali Tersedia tanpa Pesanan, supaya bisa ditahan Pesanan lain, dan Riwayat status
 * Pesanan mendapat satu baris baru. Hasilnya false bila status Pesanan sudah berubah.
 */
async function jadikanKedaluwarsa(pesananId: string, sekarang: Date) {
  return db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({ status: pesanan.status })
      .from(pesanan)
      .where(eq(pesanan.id, pesananId))
      .for("update");
    if (
      !perpindahanStatusPesanan({ dari: terkunci.status, ke: "Kedaluwarsa" })
        .boleh
    ) {
      return false;
    }

    await tx
      .update(itemStok)
      .set({ status: "Tersedia", pesananId: null })
      .where(
        and(eq(itemStok.pesananId, pesananId), eq(itemStok.status, "Ditahan")),
      );
    await tx
      .update(pesanan)
      .set({ status: "Kedaluwarsa" })
      .where(eq(pesanan.id, pesananId));
    await tx.insert(riwayatStatusPesanan).values({
      pesananId,
      waktu: sekarang,
      status: "Kedaluwarsa",
      pelaku: PELAKU_KEDALUWARSA,
    });
    return true;
  });
}

/**
 * Pekerjaan latar kedaluwarsa satu Pesanan (PRD §5.8, ADR-0004), yang dijadwalkan pada waktu kedaluwarsa
 * Pesanan itu.
 *
 * - Pesanan yang sudah tidak Menunggu Pembayaran tidak berubah, dan Qrispy tidak ditanya.
 * - Selama waktu kedaluwarsanya belum tercapai menurut kedaluwarsaPesanan, Pesanan juga tidak berubah.
 *   Hasilnya membawa waktu kedaluwarsa itu, supaya pekerjaannya bisa dijadwalkan ulang.
 * - Begitu waktunya tercapai, status QRIS-nya ditanyakan ke Qrispy sekali. Status `paid` diteruskan ke
 *   prosesKabarPembayaran dengan `amount` sebagai nominal diterima, jadi Pesanan diproses sebagai sudah
 *   dibayar.
 * - Selain itu, termasuk bila statusnya gagal ditanyakan, Pesanan menjadi Kedaluwarsa, Item stok yang
 *   ditahannya kembali Tersedia (PRD §5.3), dan Riwayat status Pesanan mencatat Sistem sebagai pelakunya.
 *
 * Adaptor Qrispy dan waktu "sekarang" bisa diganti untuk test.
 */
export async function prosesKedaluwarsaPesanan(
  pesananId: string,
  { qrispy, sekarang = new Date() }: { qrispy?: Qrispy; sekarang?: Date } = {},
): Promise<HasilKedaluwarsaPesanan> {
  const [dipesan] = await db
    .select({
      status: pesanan.status,
      qrisId: pesanan.qrisId,
      kedaluwarsaPada: pesanan.kedaluwarsaPada,
    })
    .from(pesanan)
    .where(eq(pesanan.id, pesananId));
  if (!dipesan) return { hasil: "tidak-ditemukan" };
  if (
    !perpindahanStatusPesanan({ dari: dipesan.status, ke: "Kedaluwarsa" }).boleh
  ) {
    return { hasil: "tidak-berubah" };
  }
  const { kedaluwarsaPada } = dipesan;
  if (!kedaluwarsaPesanan({ kedaluwarsaPada, sekarang }).kedaluwarsa) {
    return { hasil: "belum-kedaluwarsa", kedaluwarsaPada };
  }

  const status = await tanyaStatusQris(qrispy ?? qrispyAktif(), dipesan.qrisId);
  if (status?.paymentStatus === "paid") {
    await prosesKabarPembayaran(
      {
        qrisId: dipesan.qrisId,
        nominalDiterima: status.amount,
        waktuBayar: status.paidAt,
      },
      { sekarang },
    );
    return { hasil: "diproses-sebagai-dibayar" };
  }

  return (await jadikanKedaluwarsa(pesananId, sekarang))
    ? { hasil: "kedaluwarsa" }
    : { hasil: "tidak-berubah" };
}
