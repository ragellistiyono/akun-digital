// Kabar pembayaran dari Qrispy untuk Top up (PRD §15.4, §15.5, ADR-0004). Semua jalur kabar pembayaran Top up, yaitu
// webhook, cek status dari Halaman bayar Top up, cek status saat kedaluwarsa, dan pembatalan yang ditolak karena
// sudah dibayar, memanggil satu pemroses yang sama. Status baru, tambahan saldo, dan Biaya transaksi-nya ditentukan
// hasilKabarPembayaranTopUp di src/domain/kabar-pembayaran-top-up.ts; perpindahan status yang boleh ada di
// src/domain/status-top-up.ts.
import { and, eq } from "drizzle-orm";

import { hasilKabarPembayaranTopUp } from "@/domain/kabar-pembayaran-top-up";
import { perpindahanStatusTopUp } from "@/domain/status-top-up";

import { db } from "./db";
import { riwayatSaldo, riwayatStatusTopUp, topUp, user } from "./db/schema";
import {
  ambilGiliranCek,
  type HasilProsesKabar,
  type KabarPembayaran,
  PELAKU_KABAR_PEMBAYARAN,
} from "./kabar-pembayaran";
import { bacaPengaturanBiayaTransaksi } from "./pengaturan-toko";
import { qrispyAktif, type Qrispy, type StatusQris } from "./qrispy";

/** Jenis baris Riwayat saldo untuk Top up yang Berhasil (PRD §15.2). */
const JENIS_TOP_UP = "Top up";

/**
 * Memproses satu kabar pembayaran Top up dalam satu transaksi database (PRD §15.4, §15.5, ADR-0004).
 *
 * - Top up dikenali dari qris_id. Baris user Member pemiliknya dikunci lebih dulu, lalu baris Top up-nya, sama
 *   seperti urutan kunci saat Top up dibuat. Karena itu kabar yang sama yang datang bersamaan diproses satu per satu,
 *   dan perubahan saldo Member itu yang lain, misalnya oleh Admin, dinilai terhadap saldo terbaru.
 * - Status baru, tambahan saldo, dan Biaya transaksi ditentukan hasilKabarPembayaranTopUp dari Pengaturan toko saat
 *   itu. Kabar berulang untuk Top up yang sudah dibayar tidak mengubah apa pun, jadi saldo bertambah tepat satu kali.
 * - Top up mencatat waktu bayar, nominal diterima, dan Biaya transaksi-nya, juga bila Top up menjadi Bermasalah.
 * - Top up Berhasil menambah saldo Member sebesar Nominal top up dan menulis satu baris Riwayat saldo jenis Top up
 *   dengan Nomor Top up sebagai rujukannya (PRD §15.2).
 * - Riwayat status Top up mendapat satu baris baru dengan pelaku Qrispy.
 *
 * Waktu "sekarang" untuk Riwayat status dan Riwayat saldo bisa diganti untuk test.
 */
export async function prosesKabarPembayaranTopUp(
  { qrisId, nominalDiterima, waktuBayar }: KabarPembayaran,
  { sekarang = new Date() }: { sekarang?: Date } = {},
): Promise<HasilProsesKabar> {
  return db.transaction(async (tx) => {
    const [pemilik] = await tx
      .select({ userId: topUp.userId })
      .from(topUp)
      .where(eq(topUp.qrisId, qrisId));
    if (!pemilik) {
      console.error(
        `Kabar pembayaran untuk QRIS ${qrisId} diabaikan, karena tidak ada Top up dengan QRIS itu.`,
      );
      return { hasil: "qris-tidak-dikenal" };
    }
    const [member] = await tx
      .select({ saldo: user.saldo })
      .from(user)
      .where(eq(user.id, pemilik.userId))
      .for("update");
    const [dibayar] = await tx
      .select({
        id: topUp.id,
        nomorTopUp: topUp.nomorTopUp,
        status: topUp.status,
        nominalTopUp: topUp.nominalTopUp,
        totalBayar: topUp.totalBayar,
      })
      .from(topUp)
      .where(eq(topUp.qrisId, qrisId))
      .for("update");

    const pengaturan = await bacaPengaturanBiayaTransaksi(tx);
    const hasil = hasilKabarPembayaranTopUp({
      statusTopUp: dibayar.status,
      nominalTopUp: dibayar.nominalTopUp,
      totalBayar: dibayar.totalBayar,
      nominalDiterima,
      persenBiayaTransaksi: pengaturan.persen,
      minimalTotalBayarBiayaTransaksi: pengaturan.minimalTotalBayar,
    });
    if (hasil.statusBaru === null) return { hasil: "tidak-berubah" };
    if (
      !perpindahanStatusTopUp({ dari: dibayar.status, ke: hasil.statusBaru })
        .boleh
    ) {
      throw new Error(
        `Kabar pembayaran untuk QRIS ${qrisId} akan memindahkan Top up ${dibayar.nomorTopUp} dari ${dibayar.status} ke ${hasil.statusBaru}, padahal perpindahan itu tidak boleh (PRD §15.4). Top up dan saldo tidak diubah. Periksa hasilKabarPembayaranTopUp di src/domain/kabar-pembayaran-top-up.ts terhadap tests/golden/kabar-pembayaran-top-up.json; setelah diperbaiki, kabar berikutnya untuk QRIS ini diproses lagi.`,
      );
    }

    await tx
      .update(topUp)
      .set({
        status: hasil.statusBaru,
        waktuBayar,
        nominalDiterima,
        biayaTransaksi: hasil.biayaTransaksi,
      })
      .where(eq(topUp.id, dibayar.id));
    await tx.insert(riwayatStatusTopUp).values({
      topUpId: dibayar.id,
      waktu: sekarang,
      status: hasil.statusBaru,
      pelaku: PELAKU_KABAR_PEMBAYARAN,
    });
    if (hasil.saldoBertambah > 0) {
      const saldoSesudah = member.saldo + hasil.saldoBertambah;
      await tx
        .update(user)
        .set({ saldo: saldoSesudah })
        .where(eq(user.id, pemilik.userId));
      await tx.insert(riwayatSaldo).values({
        userId: pemilik.userId,
        waktu: sekarang,
        jenis: JENIS_TOP_UP,
        nominal: hasil.saldoBertambah,
        saldoSesudah,
        rujukan: dibayar.nomorTopUp,
      });
    }
    return { hasil: "diproses" };
  });
}

/**
 * Meneruskan status QRIS `paid` dari cek status ke prosesKabarPembayaranTopUp, dengan `amount` sebagai nominal
 * diterima (ADR-0004). Status lain tidak mengubah apa pun. Hasilnya true bila status itu `paid`.
 */
export async function teruskanStatusDibayarTopUp(
  qrisId: string,
  status: StatusQris | null,
  { sekarang }: { sekarang?: Date } = {},
) {
  if (status?.paymentStatus !== "paid") return false;
  await prosesKabarPembayaranTopUp(
    { qrisId, nominalDiterima: status.amount, waktuBayar: status.paidAt },
    { sekarang },
  );
  return true;
}

/**
 * Jalur cek status Top up (ADR-0004): menanyakan status QRIS Top up Menunggu Pembayaran milik Member itu ke Qrispy
 * lewat adaptor, paling sering sekali per 15 detik untuk setiap Top up, lalu meneruskan status `paid` ke
 * prosesKabarPembayaranTopUp. Dipicu saat Halaman bayar Top up dimuat dan saat halaman itu menanyakan statusnya.
 *
 * Kegagalan menanyakan status hanya dicatat di log; Top up tidak berubah, dan cek berikutnya menunggu giliran 15
 * detik berikutnya. Adaptor Qrispy dan waktu "sekarang" bisa diganti untuk test.
 */
export async function cekStatusPembayaranTopUp(
  nomorTopUp: string,
  idMember: string,
  { qrispy, sekarang = new Date() }: { qrispy?: Qrispy; sekarang?: Date } = {},
) {
  const [menunggu] = await db
    .select({ id: topUp.id, qrisId: topUp.qrisId })
    .from(topUp)
    .where(
      and(
        eq(topUp.nomorTopUp, nomorTopUp),
        eq(topUp.userId, idMember),
        eq(topUp.status, "Menunggu Pembayaran"),
      ),
    );
  if (!menunggu || !ambilGiliranCek(menunggu.id, sekarang)) return;

  let status: StatusQris;
  try {
    status = await (qrispy ?? qrispyAktif()).cekStatusQris(menunggu.qrisId);
  } catch (galat) {
    console.error(
      `Status QRIS ${menunggu.qrisId} gagal ditanyakan ke Qrispy. Status ditanyakan lagi paling cepat 15 detik kemudian.`,
      galat,
    );
    return;
  }
  await teruskanStatusDibayarTopUp(menunggu.qrisId, status, { sekarang });
}
