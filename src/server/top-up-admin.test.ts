import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, koneksi } from "./db";
import { riwayatSaldo, riwayatStatusTopUp, topUp, user } from "./db/schema";
import { prosesKabarPembayaranTopUp } from "./kabar-pembayaran-top-up";
import { bacaPengaturanToko, simpanPengaturanToko } from "./pengaturan-toko";
import type { Qrispy } from "./qrispy";
import { qrispyTiruan } from "./qrispy-tiruan";
import { buatTopUp } from "./top-up";
import {
  bacaDetailTopUp,
  daftarTopUp,
  selesaikanTopUpBermasalah,
} from "./top-up-admin";
import { sisipkanMember } from "./uji-member";
import { kunciPengaturanToko } from "./uji-pengaturan-toko";

// Test integrasi menu Top up di dasbor admin dan penyelesaian Top up Bermasalah (T79, PRD §15.4, §15.9, UAT-O4,
// UAT-O5) dengan database app_test dan Qrispy tiruan dari .env.ci, yang dipakai bersama test lain. Setiap test memakai
// Member dengan email unik. Top up Bermasalah memakai angka Top up Bermasalah seed di issue T79 dan docs/UAT.md
// Persiapan M5 [CONTOH]: Nominal top up Rp 50.000, Kode unik Rp 123, Total bayar Rp 50.123, nominal diterima
// Rp 50.000. Pengaturan Biaya transaksi dikunci dan diisi nilai awal PRD §14.3 (0,7% dan Rp 100.000), jadi Biaya
// transaksi Total bayar Rp 50.123 adalah Rp 0 (contoh PRD §15.5).
let lepasKunci: () => Promise<void>;

beforeAll(async () => {
  lepasKunci = await kunciPengaturanToko();
  await simpanPengaturanToko(await bacaPengaturanToko(), {
    persen: 0.7,
    minimalTotalBayar: 100000,
  });
});

afterAll(async () => {
  await lepasKunci();
  await koneksi.end();
});

const WAKTU_BAYAR = new Date("2026-11-21T10:05:00+07:00");

/** Qrispy tiruan yang menerbitkan QRIS dengan Kode unik itu. */
function qrispyKodeUnik(kodeUnik: number) {
  return {
    ...qrispyTiruan,
    buatQris: async (masukan) => ({
      ...(await qrispyTiruan.buatQris(masukan)),
      amount: masukan.amount + kodeUnik,
      uniqueId: kodeUnik,
    }),
  } satisfies Qrispy;
}

/** Member baru dengan email unik berawalan itu, beserta id-nya. */
async function memberBaru(awalan = "budi") {
  const email = `${awalan}-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return { email, id };
}

/** Top up Menunggu Pembayaran baru milik Member itu, dibuat pada waktu `dibuat`. */
async function topUpMenunggu(
  idMember: string,
  {
    nominalTopUp = 50000,
    kodeUnik = 123,
    dibuat,
  }: { nominalTopUp?: number; kodeUnik?: number; dibuat?: Date } = {},
) {
  const hasil = await buatTopUp(
    { idMember, nominal: String(nominalTopUp) },
    { qrispy: qrispyKodeUnik(kodeUnik), sekarang: dibuat },
  );
  if (hasil.hasil !== "dibuat") throw new Error(`Top up gagal: ${hasil.hasil}`);
  const [baris] = await db
    .select({ id: topUp.id, qrisId: topUp.qrisId })
    .from(topUp)
    .where(eq(topUp.nomorTopUp, hasil.nomorTopUp));
  return { ...baris, nomorTopUp: hasil.nomorTopUp };
}

/** Top up Bermasalah seperti seed: Rp 50.000 dengan Kode unik Rp 123, dibayar Rp 50.000. */
async function topUpBermasalah(idMember: string) {
  const menunggu = await topUpMenunggu(idMember);
  await prosesKabarPembayaranTopUp({
    qrisId: menunggu.qrisId,
    nominalDiterima: 50000,
    waktuBayar: WAKTU_BAYAR,
  });
  return menunggu;
}

/** Status dan waktu bayar Top up itu, saldo Member-nya, Riwayat saldo, dan Riwayat status Top up-nya. */
async function keadaan(topUpId: string, idMember: string) {
  const [{ status, waktuBayar }] = await db
    .select({ status: topUp.status, waktuBayar: topUp.waktuBayar })
    .from(topUp)
    .where(eq(topUp.id, topUpId));
  const [{ saldo }] = await db
    .select({ saldo: user.saldo })
    .from(user)
    .where(eq(user.id, idMember));
  const saldoTercatat = await db
    .select({
      jenis: riwayatSaldo.jenis,
      nominal: riwayatSaldo.nominal,
      saldoSesudah: riwayatSaldo.saldoSesudah,
      rujukan: riwayatSaldo.rujukan,
    })
    .from(riwayatSaldo)
    .where(eq(riwayatSaldo.userId, idMember));
  const riwayatStatus = await db
    .select({
      status: riwayatStatusTopUp.status,
      pelaku: riwayatStatusTopUp.pelaku,
    })
    .from(riwayatStatusTopUp)
    .where(eq(riwayatStatusTopUp.topUpId, topUpId))
    .orderBy(asc(riwayatStatusTopUp.waktu));
  return { status, waktuBayar, saldo, saldoTercatat, riwayatStatus };
}

describe("selesaikanTopUpBermasalah", () => {
  it('"Tambahkan ke saldo" menjadikan Top up Bermasalah Berhasil, menambah saldo Rp 50.000, dan mencatat satu baris Riwayat saldo jenis Top up dengan pelaku Admin', async () => {
    const { id: idMember } = await memberBaru();
    const bermasalah = await topUpBermasalah(idMember);

    expect(
      await selesaikanTopUpBermasalah({
        topUpId: bermasalah.id,
        cara: "tambahkan-ke-saldo",
      }),
    ).toEqual({ hasil: "diselesaikan" });

    expect(await keadaan(bermasalah.id, idMember)).toEqual({
      status: "Berhasil",
      // Waktu bayar tidak berubah, karena Top up ini dihitung pada waktu bayarnya (PRD §15.8).
      waktuBayar: WAKTU_BAYAR,
      saldo: 50000,
      saldoTercatat: [
        {
          jenis: "Top up",
          nominal: 50000,
          saldoSesudah: 50000,
          rujukan: bermasalah.nomorTopUp,
        },
      ],
      riwayatStatus: [
        { status: "Menunggu Pembayaran", pelaku: "Member" },
        { status: "Bermasalah", pelaku: "Qrispy" },
        { status: "Berhasil", pelaku: "Admin" },
      ],
    });
  });

  it('"Dana Dikembalikan" menjadikan Top up Bermasalah Dana Dikembalikan tanpa mengubah saldo', async () => {
    const { id: idMember } = await memberBaru();
    const bermasalah = await topUpBermasalah(idMember);

    expect(
      await selesaikanTopUpBermasalah({
        topUpId: bermasalah.id,
        cara: "dana-dikembalikan",
      }),
    ).toEqual({ hasil: "diselesaikan" });

    expect(await keadaan(bermasalah.id, idMember)).toMatchObject({
      status: "Dana Dikembalikan",
      saldo: 0,
      saldoTercatat: [],
      riwayatStatus: [
        { status: "Menunggu Pembayaran", pelaku: "Member" },
        { status: "Bermasalah", pelaku: "Qrispy" },
        { status: "Dana Dikembalikan", pelaku: "Admin" },
      ],
    });
  });

  it("kedua aksi hanya berlaku untuk Top up Bermasalah: Top up Menunggu Pembayaran tidak diubah", async () => {
    const { id: idMember } = await memberBaru();
    const menunggu = await topUpMenunggu(idMember);
    const sebelum = await keadaan(menunggu.id, idMember);

    for (const cara of ["tambahkan-ke-saldo", "dana-dikembalikan"] as const) {
      expect(
        await selesaikanTopUpBermasalah({ topUpId: menunggu.id, cara }),
      ).toEqual({ hasil: "tidak-tersedia", status: "Menunggu Pembayaran" });
    }
    expect(await keadaan(menunggu.id, idMember)).toEqual(sebelum);
  });

  it('"Tambahkan ke saldo" yang ditekan dua kali, juga bersamaan, menambah saldo tepat satu kali', async () => {
    const { id: idMember } = await memberBaru();
    const bermasalah = await topUpBermasalah(idMember);

    const hasil = await Promise.all([
      selesaikanTopUpBermasalah({
        topUpId: bermasalah.id,
        cara: "tambahkan-ke-saldo",
      }),
      selesaikanTopUpBermasalah({
        topUpId: bermasalah.id,
        cara: "tambahkan-ke-saldo",
      }),
    ]);
    expect(hasil).toContainEqual({ hasil: "diselesaikan" });
    expect(hasil).toContainEqual({
      hasil: "tidak-tersedia",
      status: "Berhasil",
    });

    const sesudah = await keadaan(bermasalah.id, idMember);
    expect(sesudah.saldo).toBe(50000);
    expect(sesudah.saldoTercatat).toHaveLength(1);
  });

  it("Top up yang tidak ada menghasilkan tidak-ada", async () => {
    expect(
      await selesaikanTopUpBermasalah({
        topUpId: randomUUID(),
        cara: "dana-dikembalikan",
      }),
    ).toEqual({ hasil: "tidak-ada" });
  });
});

describe("daftarTopUp", () => {
  it("memuat Top up semua status, yang terbaru dibuat di atas, dan saringan status serta pencarian sebagian email berhuruf besar hanya menampilkan Top up yang cocok", async () => {
    const penanda = `siti${randomUUID().slice(0, 8)}`;
    const { id: idMember, email } = await memberBaru(penanda);
    const lama = await topUpBermasalah(idMember);
    await selesaikanTopUpBermasalah({
      topUpId: lama.id,
      cara: "tambahkan-ke-saldo",
    });
    const baru = await topUpMenunggu(idMember, {
      nominalTopUp: 10000,
      kodeUnik: 77,
      dibuat: new Date(Date.now() + 60_000),
    });
    const lain = await memberBaru();
    await topUpMenunggu(lain.id);

    const semua = await daftarTopUp({ cari: penanda.toUpperCase() });
    expect(semua.jumlah).toBe(2);
    expect(semua.topUp).toEqual([
      {
        nomorTopUp: baru.nomorTopUp,
        waktuDibuat: expect.any(Date),
        email,
        nominalTopUp: 10000,
        totalBayar: 10077,
        status: "Menunggu Pembayaran",
      },
      {
        nomorTopUp: lama.nomorTopUp,
        waktuDibuat: expect.any(Date),
        email,
        nominalTopUp: 50000,
        totalBayar: 50123,
        status: "Berhasil",
      },
    ]);

    const berhasil = await daftarTopUp({
      status: "Berhasil",
      cari: penanda.toUpperCase(),
    });
    expect(berhasil.topUp.map((t) => t.nomorTopUp)).toEqual([lama.nomorTopUp]);

    // Sebagian Nomor Top up dengan huruf kecil juga menemukan Top up itu.
    const lewatNomor = await daftarTopUp({
      cari: baru.nomorTopUp.slice(2).toLowerCase(),
    });
    expect(lewatNomor.topUp.map((t) => t.nomorTopUp)).toContain(
      baru.nomorTopUp,
    );
    expect(lewatNomor.topUp.every((t) => t.email !== lain.email)).toBe(true);
  });
});

describe("bacaDetailTopUp", () => {
  it("Top up yang sudah dibayar membawa Nominal top up, Kode unik, Total bayar, nominal diterima, Biaya transaksi, riwayat status dengan pelakunya, dan Member pemiliknya", async () => {
    const { id: idMember, email } = await memberBaru();
    const bermasalah = await topUpBermasalah(idMember);

    expect(await bacaDetailTopUp(bermasalah.nomorTopUp)).toEqual({
      id: bermasalah.id,
      nomorTopUp: bermasalah.nomorTopUp,
      status: "Bermasalah",
      member: { id: idMember, email },
      rincian: {
        nominalTopUp: 50000,
        kodeUnik: 123,
        totalBayar: 50123,
      },
      pembayaran: { nominalDiterima: 50000, biayaTransaksi: 0 },
      riwayat: [
        {
          waktu: expect.any(Date),
          status: "Menunggu Pembayaran",
          pelaku: "Member",
        },
        { waktu: expect.any(Date), status: "Bermasalah", pelaku: "Qrispy" },
      ],
    });
  });

  it("Top up yang belum dibayar tidak punya nominal diterima dan Biaya transaksi", async () => {
    const { id: idMember } = await memberBaru();
    const menunggu = await topUpMenunggu(idMember);
    expect((await bacaDetailTopUp(menunggu.nomorTopUp))?.pembayaran).toBeNull();
  });

  it("Nomor Top up yang tidak dikenal menghasilkan null", async () => {
    expect(await bacaDetailTopUp("TOPUP-ZZZZZZ")).toBeNull();
  });
});
