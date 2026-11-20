// Menu Top up di dasbor admin (PRD §15.9): daftar dan detail Top up, serta penyelesaian Top up Bermasalah. Akibat
// setiap cara penyelesaian ditentukan hasilPenyelesaianTopUpBermasalah di src/domain/penyelesaian-top-up-bermasalah.ts;
// perpindahan status yang boleh ada di src/domain/status-top-up.ts. Pemeriksaan bahwa yang membuka dan menyelesaikan
// adalah Admin dilakukan pemanggilnya.
import { and, asc, count, desc, eq, min, or, sql, type SQL } from "drizzle-orm";

import {
  type CaraPenyelesaianTopUp,
  hasilPenyelesaianTopUpBermasalah,
} from "@/domain/penyelesaian-top-up-bermasalah";
import type { StatusTopUp } from "@/domain/status-top-up";

import { db } from "./db";
import { riwayatSaldo, riwayatStatusTopUp, topUp, user } from "./db/schema";

/** Jumlah Top up di satu halaman daftar (PRD §15.9). */
const UKURAN_HALAMAN = 50;

/** Pelaku perubahan status oleh Admin di Riwayat status Top up (PRD §15.4). Semua Admin punya hak yang sama. */
const PELAKU_ADMIN = "Admin";

/** Jenis baris Riwayat saldo untuk Top up yang Berhasil (PRD §15.2). */
const JENIS_TOP_UP = "Top up";

/**
 * Waktu dibuat setiap Top up, yaitu waktu baris pertama Riwayat status Top up-nya, yang ditulis saat Top up dibuat
 * (src/server/top-up.ts).
 */
const waktuDibuat = db.$with("waktu_dibuat_top_up").as(
  db
    .select({
      topUpId: riwayatStatusTopUp.topUpId,
      waktu: min(riwayatStatusTopUp.waktu).as("waktu"),
    })
    .from(riwayatStatusTopUp)
    .groupBy(riwayatStatusTopUp.topUpId),
);

/**
 * Syarat pencarian (PRD §15.9, sama seperti daftar Pesanan §9.5 ▶ Keputusan 2026-11-12): email Member atau Nomor Top
 * up-nya memuat kata cari itu, tanpa membedakan huruf besar dan kecil. Spasi di ujung kata cari diabaikan. Kata cari
 * dicari dengan strpos, bukan LIKE, supaya `%` dan `_` dicocokkan sebagai huruf biasa.
 */
function cocokPencarian(cari: string) {
  const kata = cari.trim();
  return or(
    sql`strpos(lower(${user.email}), lower(${kata})) > 0`,
    sql`strpos(lower(${topUp.nomorTopUp}), lower(${kata})) > 0`,
  );
}

/**
 * Satu halaman Top up yang cocok dengan saringan itu (PRD §15.9), yang terbaru dibuat di atas, beserta jumlah semua Top
 * up yang cocok dan jumlah halamannya. Setiap halaman memuat 50 Top up, dan daftar tanpa Top up tetap punya satu
 * halaman.
 *
 * - `status` hanya memuat Top up berstatus itu.
 * - `cari` memuat Top up yang email Member atau Nomor Top up-nya memuat teks itu, tanpa membedakan huruf besar dan
 *   kecil.
 */
export async function daftarTopUp(saringan: {
  status?: StatusTopUp;
  cari?: string;
  halaman?: number;
}) {
  const halaman = saringan.halaman ?? 1;
  const syarat: (SQL | undefined)[] = [
    saringan.status === undefined
      ? undefined
      : eq(topUp.status, saringan.status),
    saringan.cari === undefined ? undefined : cocokPencarian(saringan.cari),
  ];
  const cocok = and(...syarat);

  const [{ jumlah }] = await db
    .select({ jumlah: count() })
    .from(topUp)
    .innerJoin(user, eq(topUp.userId, user.id))
    .where(cocok);

  const baris = await db
    .with(waktuDibuat)
    .select({
      nomorTopUp: topUp.nomorTopUp,
      waktuDibuat: waktuDibuat.waktu,
      email: user.email,
      nominalTopUp: topUp.nominalTopUp,
      totalBayar: topUp.totalBayar,
      status: topUp.status,
    })
    .from(topUp)
    .innerJoin(user, eq(topUp.userId, user.id))
    .leftJoin(waktuDibuat, eq(waktuDibuat.topUpId, topUp.id))
    .where(cocok)
    .orderBy(sql`${waktuDibuat.waktu} desc nulls last`, desc(topUp.nomorTopUp))
    .limit(UKURAN_HALAMAN)
    .offset((halaman - 1) * UKURAN_HALAMAN);

  return {
    topUp: baris,
    jumlah,
    halaman,
    jumlahHalaman: Math.max(1, Math.ceil(jumlah / UKURAN_HALAMAN)),
  };
}

/**
 * Detail Top up dengan Nomor Top up itu untuk dasbor admin (PRD §15.9): id, Nomor Top up, status, Member pemiliknya
 * (id untuk tautan ke halaman Member, dan email), rincian Nominal top up, Kode unik, dan Total bayar, nominal diterima
 * dan Biaya transaksi yang dicatat saat pembayarannya masuk (null selama belum dibayar, PRD §15.5), serta riwayat
 * perubahan status beserta pelakunya dari yang paling lama. Hasilnya null bila tidak ada Top up dengan nomor itu.
 */
export async function bacaDetailTopUp(nomorTopUp: string) {
  const [baris] = await db
    .select({
      id: topUp.id,
      nomorTopUp: topUp.nomorTopUp,
      status: topUp.status,
      idMember: user.id,
      email: user.email,
      nominalTopUp: topUp.nominalTopUp,
      kodeUnik: topUp.kodeUnik,
      totalBayar: topUp.totalBayar,
      nominalDiterima: topUp.nominalDiterima,
      biayaTransaksi: topUp.biayaTransaksi,
    })
    .from(topUp)
    .innerJoin(user, eq(topUp.userId, user.id))
    .where(eq(topUp.nomorTopUp, nomorTopUp));
  if (!baris) return null;

  const riwayat = await db
    .select({
      waktu: riwayatStatusTopUp.waktu,
      status: riwayatStatusTopUp.status,
      pelaku: riwayatStatusTopUp.pelaku,
    })
    .from(riwayatStatusTopUp)
    .where(eq(riwayatStatusTopUp.topUpId, baris.id))
    .orderBy(asc(riwayatStatusTopUp.waktu));

  return {
    id: baris.id,
    nomorTopUp: baris.nomorTopUp,
    status: baris.status,
    member: { id: baris.idMember, email: baris.email },
    rincian: {
      nominalTopUp: baris.nominalTopUp,
      kodeUnik: baris.kodeUnik,
      totalBayar: baris.totalBayar,
    },
    pembayaran:
      baris.nominalDiterima === null || baris.biayaTransaksi === null
        ? null
        : {
            nominalDiterima: baris.nominalDiterima,
            biayaTransaksi: baris.biayaTransaksi,
          },
    riwayat,
  };
}

type HasilSelesaikanTopUpBermasalah =
  | { hasil: "diselesaikan" }
  | { hasil: "tidak-ada" }
  | { hasil: "tidak-tersedia"; status: StatusTopUp };

/**
 * Admin menyelesaikan Top up itu dengan "Tambahkan ke saldo" atau "Dana Dikembalikan" (PRD §15.9), dalam satu
 * transaksi database.
 *
 * - Baris user Member pemiliknya dikunci lebih dulu, lalu baris Top up-nya, sama seperti urutan kunci saat Top up
 *   dibuat dan saat kabar pembayarannya diproses. Karena itu klik ganda, dua Admin yang menekan bersamaan, dan
 *   perubahan saldo lain Member itu diproses satu per satu terhadap saldo dan status terbaru, jadi saldo bertambah
 *   tepat satu kali untuk setiap Top up (PRD §15.4).
 * - "Tambahkan ke saldo" menambah saldo Member sebesar Nominal top up dan menulis satu baris Riwayat saldo jenis Top up
 *   dengan Nomor Top up sebagai rujukannya (PRD §15.2). "Dana Dikembalikan" tidak mengubah saldo.
 * - Waktu bayar Top up tidak berubah, karena Top up yang diselesaikan dengan "Tambahkan ke saldo" dihitung pada waktu
 *   bayarnya (PRD §15.8).
 * - Riwayat status Top up mendapat satu baris baru dengan Admin sebagai pelakunya.
 *
 * Waktu "sekarang" untuk Riwayat status dan Riwayat saldo bisa diganti untuk test.
 */
export async function selesaikanTopUpBermasalah(
  { topUpId, cara }: { topUpId: string; cara: CaraPenyelesaianTopUp },
  { sekarang = new Date() }: { sekarang?: Date } = {},
): Promise<HasilSelesaikanTopUpBermasalah> {
  return db.transaction(async (tx) => {
    const [pemilik] = await tx
      .select({ userId: topUp.userId })
      .from(topUp)
      .where(eq(topUp.id, topUpId));
    if (!pemilik) return { hasil: "tidak-ada" };
    const [member] = await tx
      .select({ saldo: user.saldo })
      .from(user)
      .where(eq(user.id, pemilik.userId))
      .for("update");
    const [terkunci] = await tx
      .select({
        nomorTopUp: topUp.nomorTopUp,
        status: topUp.status,
        nominalTopUp: topUp.nominalTopUp,
      })
      .from(topUp)
      .where(eq(topUp.id, topUpId))
      .for("update");

    const hasil = hasilPenyelesaianTopUpBermasalah({
      statusTopUp: terkunci.status,
      cara,
      nominalTopUp: terkunci.nominalTopUp,
    });
    if (hasil.hasil === "tidak-tersedia") {
      return { hasil: "tidak-tersedia", status: terkunci.status };
    }

    await tx
      .update(topUp)
      .set({ status: hasil.statusBaru })
      .where(eq(topUp.id, topUpId));
    await tx.insert(riwayatStatusTopUp).values({
      topUpId,
      waktu: sekarang,
      status: hasil.statusBaru,
      pelaku: PELAKU_ADMIN,
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
        rujukan: terkunci.nomorTopUp,
      });
    }
    return { hasil: "diselesaikan" };
  });
}
