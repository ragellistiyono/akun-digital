// Pembatalan Pesanan oleh Pembeli (PRD §5.3, §5.8, ADR-0004). Pesanan yang boleh dibatalkan ditentukan
// perpindahanStatusPesanan di src/domain/status-pesanan.ts; akibat jawaban Qrispy ditentukan
// hasilPembatalanPesanan di src/domain/pembatalan-pesanan.ts.
import { and, eq } from "drizzle-orm";

import { hasilPembatalanPesanan } from "@/domain/pembatalan-pesanan";
import {
  perpindahanStatusPesanan,
  type StatusPesanan,
} from "@/domain/status-pesanan";

import { db } from "./db";
import { itemStok, pesanan, riwayatStatusPesanan } from "./db/schema";
import { prosesKabarPembayaran } from "./kabar-pembayaran";
import { qrispyAktif, type Qrispy, type StatusQris } from "./qrispy";

/** Pelaku perubahan status karena pembatalan di Riwayat status Pesanan. */
const PELAKU_PEMBATALAN = "Pembeli";

type HasilBatalkanPesanan =
  | { hasil: "tidak-ditemukan" }
  | { hasil: "tidak-bisa-dibatalkan"; status: StatusPesanan }
  | { hasil: "dibatalkan" }
  | { hasil: "diproses-sebagai-dibayar" }
  | { hasil: "gagal" };

/**
 * Meminta pembatalan QRIS ke Qrispy. Bila Qrispy menolak atau tidak menjawab, status QRIS itu ditanyakan
 * (ADR-0004); status yang juga gagal ditanyakan menjadi null. Kegagalannya dicatat di log.
 */
async function mintaPembatalanQris(
  qrispy: Qrispy,
  qrisId: string,
): Promise<
  | { pembatalanQris: "diterima" }
  | { pembatalanQris: "ditolak"; status: StatusQris | null }
> {
  try {
    await qrispy.batalkanQris(qrisId);
    return { pembatalanQris: "diterima" };
  } catch (galat) {
    console.error(
      `Pembatalan QRIS ${qrisId} ditolak Qrispy atau tidak dijawab, jadi status QRIS itu ditanyakan.`,
      galat,
    );
  }
  try {
    return {
      pembatalanQris: "ditolak",
      status: await qrispy.cekStatusQris(qrisId),
    };
  } catch (galat) {
    console.error(
      `Status QRIS ${qrisId} gagal ditanyakan ke Qrispy setelah pembatalannya ditolak, jadi Pesanan tetap Menunggu Pembayaran.`,
      galat,
    );
    return { pembatalanQris: "ditolak", status: null };
  }
}

/**
 * Menjadikan Pesanan itu Dibatalkan dalam satu transaksi, selama perpindahannya masih boleh. Baris
 * Pesanan dikunci lebih dulu, seperti di prosesKabarPembayaran, sehingga pembatalan dan kabar pembayaran
 * yang datang bersamaan diproses satu per satu. Item stok yang ditahannya kembali Tersedia tanpa Pesanan,
 * supaya bisa ditahan Pesanan lain, dan Riwayat status Pesanan mendapat satu baris baru. Bila status
 * Pesanan sudah berubah sehingga tidak bisa dibatalkan lagi, hasilnya membawa status itu.
 */
async function jadikanDibatalkan(
  pesananId: string,
  sekarang: Date,
): Promise<
  { dibatalkan: true } | { dibatalkan: false; status: StatusPesanan }
> {
  return db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({ status: pesanan.status })
      .from(pesanan)
      .where(eq(pesanan.id, pesananId))
      .for("update");
    if (
      !perpindahanStatusPesanan({ dari: terkunci.status, ke: "Dibatalkan" })
        .boleh
    ) {
      return { dibatalkan: false, status: terkunci.status };
    }

    await tx
      .update(itemStok)
      .set({ status: "Tersedia", pesananId: null })
      .where(
        and(eq(itemStok.pesananId, pesananId), eq(itemStok.status, "Ditahan")),
      );
    await tx
      .update(pesanan)
      .set({ status: "Dibatalkan" })
      .where(eq(pesanan.id, pesananId));
    await tx.insert(riwayatStatusPesanan).values({
      pesananId,
      waktu: sekarang,
      status: "Dibatalkan",
      pelaku: PELAKU_PEMBATALAN,
    });
    return { dibatalkan: true };
  });
}

/**
 * Pembeli membatalkan Pesanan di Tautan Pesanan itu (PRD §5.8, ADR-0004).
 *
 * - Hanya Pesanan Menunggu Pembayaran yang bisa dibatalkan (PRD §5.7). Pesanan lain tidak berubah, Qrispy
 *   tidak dimintai pembatalan, dan hasilnya membawa status Pesanan itu saat pembatalannya diproses.
 * - Toko meminta pembatalan QRIS-nya ke Qrispy lewat adaptor. Bila permintaan itu gagal, status QRIS-nya
 *   ditanyakan, lalu hasilPembatalanPesanan menentukan akibatnya.
 * - Pesanan yang diproses sebagai sudah dibayar melewati prosesKabarPembayaran, dengan `amount` dari
 *   status `paid` sebagai nominal diterima.
 * - Pesanan Dibatalkan melepas Item stok yang ditahannya (PRD §5.3) dan mencatat Pembeli sebagai pelaku
 *   di Riwayat status Pesanan.
 *
 * Adaptor Qrispy dan waktu "sekarang" bisa diganti untuk test.
 */
export async function batalkanPesanan(
  tautan: string,
  { qrispy, sekarang = new Date() }: { qrispy?: Qrispy; sekarang?: Date } = {},
): Promise<HasilBatalkanPesanan> {
  const [dipesan] = await db
    .select({ id: pesanan.id, status: pesanan.status, qrisId: pesanan.qrisId })
    .from(pesanan)
    .where(eq(pesanan.tautan, tautan));
  if (!dipesan) return { hasil: "tidak-ditemukan" };
  if (
    !perpindahanStatusPesanan({ dari: dipesan.status, ke: "Dibatalkan" }).boleh
  ) {
    return { hasil: "tidak-bisa-dibatalkan", status: dipesan.status };
  }

  const jawaban = await mintaPembatalanQris(
    qrispy ?? qrispyAktif(),
    dipesan.qrisId,
  );
  const statusQris =
    jawaban.pembatalanQris === "ditolak" ? jawaban.status : null;
  const { akibat } = hasilPembatalanPesanan(
    jawaban.pembatalanQris === "diterima"
      ? jawaban
      : {
          pembatalanQris: "ditolak",
          statusQris: statusQris?.paymentStatus ?? null,
        },
  );

  switch (akibat) {
    case "dibatalkan": {
      const pembatalan = await jadikanDibatalkan(dipesan.id, sekarang);
      return pembatalan.dibatalkan
        ? { hasil: "dibatalkan" }
        : { hasil: "tidak-bisa-dibatalkan", status: pembatalan.status };
    }
    case "diproses-sebagai-dibayar":
      // Akibat ini hanya datang dari status `paid`, yang membawa nominal diterima dan waktu bayarnya.
      if (statusQris?.paymentStatus === "paid") {
        await prosesKabarPembayaran(
          {
            qrisId: dipesan.qrisId,
            nominalDiterima: statusQris.amount,
            waktuBayar: statusQris.paidAt,
          },
          { sekarang },
        );
      }
      return { hasil: "diproses-sebagai-dibayar" };
    case "gagal":
      return { hasil: "gagal" };
  }
}
