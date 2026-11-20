// Top up oleh Member (PRD §15.3, §15.4) beserta QRIS-nya dari Qrispy (ADR-0004). Isian Nominal top up diperiksa
// periksaIsianTopUp (src/domain/isian-top-up.ts); bentuk Nomor Top up ada di src/domain/nomor-top-up.ts; Total bayar
// dan pemeriksaan nominal QRIS ada di src/domain/total-bayar-top-up.ts; Top up yang boleh dibatalkan ditentukan
// perpindahanStatusTopUp (src/domain/status-top-up.ts) dan akibat jawaban Qrispy hasilPembatalanPesanan
// (src/domain/pembatalan-pesanan.ts), karena pembatalan Top up mengikuti §5.8. Pemeriksaan bahwa yang membuat dan
// membuka Top up adalah Member pemiliknya dilakukan pemanggilnya lewat `idMember` dari sesi.
import { randomBytes } from "node:crypto";

import { and, DrizzleQueryError, eq } from "drizzle-orm";
import postgres from "postgres";

import {
  type AlasanIsianTopUp,
  periksaIsianTopUp,
} from "@/domain/isian-top-up";
import { nomorTopUp } from "@/domain/nomor-top-up";
import { hasilPembatalanPesanan } from "@/domain/pembatalan-pesanan";
import { perpindahanStatusTopUp } from "@/domain/status-top-up";
import { periksaTagihanQrisTopUp } from "@/domain/total-bayar-top-up";

import { db } from "./db";
import { riwayatStatusTopUp, topUp, user } from "./db/schema";
import { jadwalkanKedaluwarsaTopUp } from "./pekerjaan-latar";
import { mintaPembatalanQris } from "./pembatalan-pesanan";
import { qrispyAktif, type QrisBaru, type Qrispy } from "./qrispy";

/** Pelaku perubahan status oleh Member di Riwayat status Top up (PRD §15.4). */
const PELAKU_MEMBER = "Member";

/** Berapa kali Top up dicoba ulang bila Nomor Top up acaknya sudah dipakai Top up lain. */
const BATAS_PERCOBAAN_NOMOR = 5;

const nomorTopUpAcak = () => nomorTopUp(randomBytes(6));

/** Apakah penulisan ditolak indeks unik Nomor Top up, karena nomor acaknya sudah dipakai Top up lain. */
const nomorSudahDipakai = (galat: unknown) =>
  galat instanceof DrizzleQueryError &&
  galat.cause instanceof postgres.PostgresError &&
  galat.cause.code === "23505" &&
  galat.cause.constraint_name === "top_up_nomor_top_up_unik";

/**
 * Membatalkan QRIS yang tidak jadi dipakai. Bila pembatalannya gagal, QRIS itu tidak tertaut ke Top up mana pun dan
 * kedaluwarsa sendiri setelah 15 menit.
 */
async function batalkanQrisTakTerpakai(qrispy: Qrispy, qris: QrisBaru) {
  try {
    await qrispy.batalkanQris(qris.qrisId);
  } catch (galat) {
    console.error(
      `QRIS ${qris.qrisId} tidak jadi dipakai untuk Top up, tetapi pembatalannya di Qrispy gagal. QRIS itu tidak tertaut ke Top up mana pun.`,
      galat,
    );
  }
}

/** Nomor Top up Menunggu Pembayaran milik Member itu, atau null bila tidak ada (PRD §15.3). */
async function topUpMenunggu(
  penulis: Pick<typeof db, "select">,
  idMember: string,
) {
  const [baris] = await penulis
    .select({ nomorTopUp: topUp.nomorTopUp })
    .from(topUp)
    .where(
      and(eq(topUp.userId, idMember), eq(topUp.status, "Menunggu Pembayaran")),
    );
  return baris?.nomorTopUp ?? null;
}

export type HasilBuatTopUp =
  | { hasil: "ditolak"; alasan: AlasanIsianTopUp }
  /** Member masih punya Top up Menunggu Pembayaran; Top up baru tidak dibuat. */
  | { hasil: "menunggu"; nomorTopUp: string }
  | { hasil: "dibuat"; nomorTopUp: string }
  | { hasil: "qris-gagal" };

/**
 * "Bayar dengan QRIS" di Halaman Top up (PRD §15.3).
 *
 * - Selagi Member masih punya Top up Menunggu Pembayaran, hasilnya Top up itu, tanpa memeriksa isian dan tanpa
 *   membuat QRIS. Batas ini hanya menghitung Top up, terpisah dari batas Pesanan menunggu (PRD §5.4).
 * - Isian yang ditolak periksaIsianTopUp tidak membuat apa pun.
 * - Selain itu QRIS diterbitkan untuk Nominal top up, dengan Nomor Top up sebagai `payment_reference` (ADR-0004).
 *   QRIS yang nominalnya tidak cocok dibatalkan, dan tidak ada Top up yang dibuat.
 * - Top up, baris Riwayat status "Menunggu Pembayaran" dengan pelaku Member, dan pekerjaan kedaluwarsanya disimpan
 *   dalam satu transaksi. Baris user Member dikunci lebih dulu, jadi dua "Bayar dengan QRIS" bersamaan menghasilkan
 *   satu Top up; yang kalah membatalkan QRIS-nya dan mendapat Top up yang menang.
 * - Bila Nomor Top up acaknya sudah dipakai, QRIS-nya dibatalkan, lalu nomor dan QRIS dibuat ulang.
 *
 * Adaptor Qrispy, pembuat Nomor Top up, dan waktu "sekarang" bisa diganti untuk test.
 */
export async function buatTopUp(
  { idMember, nominal }: { idMember: string; nominal: string },
  {
    qrispy = qrispyAktif(),
    buatNomorTopUp = nomorTopUpAcak,
    sekarang = new Date(),
  }: { qrispy?: Qrispy; buatNomorTopUp?: () => string; sekarang?: Date } = {},
): Promise<HasilBuatTopUp> {
  for (let percobaan = 1; ; percobaan++) {
    const menunggu = await topUpMenunggu(db, idMember);
    if (menunggu) return { hasil: "menunggu", nomorTopUp: menunggu };

    const isian = periksaIsianTopUp({ nominal });
    if (isian.nominalTersimpan === null) {
      return { hasil: "ditolak", alasan: isian.alasan ?? "kosong" };
    }
    const nominalTopUp = isian.nominalTersimpan;
    const nomor = buatNomorTopUp();

    let qris: QrisBaru;
    try {
      qris = await qrispy.buatQris({
        amount: nominalTopUp,
        paymentReference: nomor,
      });
    } catch (galat) {
      console.error(`QRIS untuk Top up ${nomor} gagal dibuat.`, galat);
      return { hasil: "qris-gagal" };
    }
    const tagihan = periksaTagihanQrisTopUp({
      nominalTopUp,
      requestedAmount: qris.requestedAmount,
      uniqueId: qris.uniqueId,
      amount: qris.amount,
    });
    if (!tagihan.cocok) {
      console.error(
        `QRIS ${qris.qrisId} untuk Top up ${nomor} ditolak: ${tagihan.alasan}.`,
      );
      await batalkanQrisTakTerpakai(qrispy, qris);
      return { hasil: "qris-gagal" };
    }

    let hasil: HasilBuatTopUp;
    try {
      hasil = await db.transaction(async (tx) => {
        await tx
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, idMember))
          .for("update");
        const menungguUlang = await topUpMenunggu(tx, idMember);
        if (menungguUlang) {
          return { hasil: "menunggu", nomorTopUp: menungguUlang } as const;
        }

        const [{ id }] = await tx
          .insert(topUp)
          .values({
            nomorTopUp: nomor,
            userId: idMember,
            nominalTopUp,
            kodeUnik: tagihan.rincian.kodeUnik,
            totalBayar: tagihan.rincian.totalBayar,
            qrisId: qris.qrisId,
            kedaluwarsaPada: qris.expiredAt,
            gambarQr: qris.gambarQr,
            status: "Menunggu Pembayaran",
          })
          .returning({ id: topUp.id });
        await tx.insert(riwayatStatusTopUp).values({
          topUpId: id,
          waktu: sekarang,
          status: "Menunggu Pembayaran",
          pelaku: PELAKU_MEMBER,
        });
        await jadwalkanKedaluwarsaTopUp(
          { topUpId: id, kedaluwarsaPada: qris.expiredAt },
          tx,
        );
        return { hasil: "dibuat", nomorTopUp: nomor } as const;
      });
    } catch (galat) {
      await batalkanQrisTakTerpakai(qrispy, qris);
      if (nomorSudahDipakai(galat) && percobaan < BATAS_PERCOBAAN_NOMOR) {
        continue;
      }
      throw galat;
    }
    if (hasil.hasil !== "dibuat") await batalkanQrisTakTerpakai(qrispy, qris);
    return hasil;
  }
}

/**
 * Top up dengan Nomor Top up itu untuk Halaman bayar Top up (PRD §15.3), hanya bila milik Member itu: status, gambar
 * QR, waktu kedaluwarsa, dan rincian Nominal top up, Kode unik, serta Total bayar. `dibacaPada` adalah jam server
 * saat Top up dibaca, titik awal hitung mundur. Hasilnya null bila tidak ada Top up itu, atau Top up itu milik
 * Member lain.
 */
export async function bacaTopUpMember({
  nomorTopUp,
  idMember,
}: {
  nomorTopUp: string;
  idMember: string;
}) {
  const [baris] = await db
    .select({
      nomorTopUp: topUp.nomorTopUp,
      status: topUp.status,
      gambarQr: topUp.gambarQr,
      kedaluwarsaPada: topUp.kedaluwarsaPada,
      nominalTopUp: topUp.nominalTopUp,
      kodeUnik: topUp.kodeUnik,
      totalBayar: topUp.totalBayar,
    })
    .from(topUp)
    .where(and(eq(topUp.nomorTopUp, nomorTopUp), eq(topUp.userId, idMember)));
  if (!baris) return null;
  const { nominalTopUp, kodeUnik, totalBayar, ...lainnya } = baris;
  return {
    ...lainnya,
    rincian: { nominalTopUp, kodeUnik, totalBayar },
    dibacaPada: new Date(),
  };
}

type HasilBatalkanTopUp =
  | { hasil: "tidak-ditemukan" }
  | { hasil: "tidak-bisa-dibatalkan" }
  | { hasil: "dibatalkan" }
  | { hasil: "sudah-dibayar" }
  | { hasil: "gagal" };

/**
 * Menjadikan Top up itu Dibatalkan dalam satu transaksi, selama perpindahannya masih boleh. Baris Top up dikunci
 * lebih dulu, jadi pembatalan dan kedaluwarsa yang bersamaan diproses satu per satu. Hasilnya false bila status Top
 * up sudah berubah.
 */
async function jadikanDibatalkan(topUpId: string, sekarang: Date) {
  return db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({ status: topUp.status })
      .from(topUp)
      .where(eq(topUp.id, topUpId))
      .for("update");
    if (
      !perpindahanStatusTopUp({ dari: terkunci.status, ke: "Dibatalkan" }).boleh
    ) {
      return false;
    }
    await tx
      .update(topUp)
      .set({ status: "Dibatalkan" })
      .where(eq(topUp.id, topUpId));
    await tx.insert(riwayatStatusTopUp).values({
      topUpId,
      waktu: sekarang,
      status: "Dibatalkan",
      pelaku: PELAKU_MEMBER,
    });
    return true;
  });
}

/**
 * "Batalkan" di Halaman bayar Top up (PRD §15.3, mengikuti §5.8), hanya untuk Top up milik Member itu.
 *
 * - Hanya Top up Menunggu Pembayaran yang bisa dibatalkan (PRD §15.4); Qrispy tidak dimintai pembatalan untuk yang
 *   lain.
 * - Toko meminta pembatalan QRIS-nya ke Qrispy. Bila permintaan itu gagal, status QRIS-nya ditanyakan, lalu
 *   hasilPembatalanPesanan menentukan akibatnya.
 * - Bila QRIS-nya ternyata sudah dibayar, hasilnya "sudah-dibayar" dan Top up tetap Menunggu Pembayaran, sampai
 *   kabar pembayaran Top up diproses (T78).
 * - Top up Dibatalkan mencatat Member sebagai pelaku di Riwayat status Top up.
 *
 * Adaptor Qrispy dan waktu "sekarang" bisa diganti untuk test.
 */
export async function batalkanTopUp(
  { nomorTopUp, idMember }: { nomorTopUp: string; idMember: string },
  { qrispy, sekarang = new Date() }: { qrispy?: Qrispy; sekarang?: Date } = {},
): Promise<HasilBatalkanTopUp> {
  const [dibaca] = await db
    .select({ id: topUp.id, status: topUp.status, qrisId: topUp.qrisId })
    .from(topUp)
    .where(and(eq(topUp.nomorTopUp, nomorTopUp), eq(topUp.userId, idMember)));
  if (!dibaca) return { hasil: "tidak-ditemukan" };
  if (
    !perpindahanStatusTopUp({ dari: dibaca.status, ke: "Dibatalkan" }).boleh
  ) {
    return { hasil: "tidak-bisa-dibatalkan" };
  }

  const jawaban = await mintaPembatalanQris(
    qrispy ?? qrispyAktif(),
    dibaca.qrisId,
  );
  const { akibat } = hasilPembatalanPesanan(
    jawaban.pembatalanQris === "diterima"
      ? jawaban
      : {
          pembatalanQris: "ditolak",
          statusQris: jawaban.status?.paymentStatus ?? null,
        },
  );
  switch (akibat) {
    case "dibatalkan":
      return (await jadikanDibatalkan(dibaca.id, sekarang))
        ? { hasil: "dibatalkan" }
        : { hasil: "tidak-bisa-dibatalkan" };
    case "diproses-sebagai-dibayar":
      return { hasil: "sudah-dibayar" };
    case "gagal":
      return { hasil: "gagal" };
  }
}
