import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db, koneksi } from "./db";
import { riwayatSaldo, riwayatStatusTopUp, topUp, user } from "./db/schema";
import {
  cekStatusPembayaranTopUp,
  prosesKabarPembayaranTopUp,
} from "./kabar-pembayaran-top-up";
import {
  bacaPengaturanToko,
  simpanPengaturanToko,
  type PengaturanBiayaTransaksi,
} from "./pengaturan-toko";
import type { Qrispy } from "./qrispy";
import { bayarQrisTiruan, qrispyTiruan } from "./qrispy-tiruan";
import { buatTopUp } from "./top-up";
import { kunciPengaturanToko } from "./uji-pengaturan-toko";
import { sisipkanMember } from "./uji-member";

// Test integrasi kabar pembayaran Top up (T78, PRD §15.4, §15.5) dengan database app_test dan Qrispy tiruan dari
// .env.ci, yang dipakai bersama test lain. Setiap test memakai Member dengan email unik. Angka Nominal top up, Kode
// unik, Total bayar, dan Biaya transaksi diambil dari tests/golden/kabar-pembayaran-top-up.json dan contoh PRD §15.5.
// Pengaturan Biaya transaksi dikunci dan diisi nilai awal PRD §14.3 (0,7% dan Rp 100.000) selama berkas ini berjalan,
// supaya berkas test lain tidak mengubahnya di tengah jalan.
let lepasKunci: () => Promise<void>;

/** Menyimpan isian Biaya transaksi lewat Pengaturan toko, tanpa mengubah isian lainnya. */
async function aturBiayaTransaksi(biaya: PengaturanBiayaTransaksi) {
  await simpanPengaturanToko(await bacaPengaturanToko(), biaya);
}

beforeAll(async () => {
  lepasKunci = await kunciPengaturanToko();
  await aturBiayaTransaksi({ persen: 0.7, minimalTotalBayar: 100000 });
});

afterAll(async () => {
  await lepasKunci();
  await koneksi.end();
});

const WAKTU_BAYAR = new Date("2026-11-21T10:05:00+07:00");
const SEKARANG = new Date("2026-11-21T10:05:02+07:00");
// Top up dibuat pada waktu tetap sebelum WAKTU_BAYAR, supaya urutan Riwayat status tidak bergantung pada tanggal
// test dijalankan.
const WAKTU_DIBUAT = new Date("2026-11-21T10:00:00+07:00");

/** Qrispy tiruan yang menerbitkan QRIS dengan Kode unik itu. */
function qrispyKodeUnik(kodeUnik: number) {
  return {
    ...qrispyTiruan,
    buatQris: async (masukan) => ({
      ...(await qrispyTiruan.buatQris(masukan)),
      amount: masukan.amount + kodeUnik,
      uniqueId: kodeUnik,
    }),
    cekStatusQris: vi.fn<Qrispy["cekStatusQris"]>(qrispyTiruan.cekStatusQris),
  } satisfies Qrispy;
}

/** Member baru dengan Top up Menunggu Pembayaran sebesar Nominal top up dan Kode unik itu. */
async function topUpMenunggu({
  nominalTopUp,
  kodeUnik,
  qrispy = qrispyKodeUnik(kodeUnik),
}: {
  nominalTopUp: number;
  kodeUnik: number;
  qrispy?: Qrispy;
}) {
  const email = `budi-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  const [{ id: idMember }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  const hasil = await buatTopUp(
    { idMember, nominal: String(nominalTopUp) },
    { qrispy, sekarang: WAKTU_DIBUAT },
  );
  if (hasil.hasil !== "dibuat") throw new Error(`Top up gagal: ${hasil.hasil}`);
  const [dibuat] = await db
    .select({ id: topUp.id, qrisId: topUp.qrisId })
    .from(topUp)
    .where(eq(topUp.nomorTopUp, hasil.nomorTopUp));
  return { ...dibuat, idMember, nomorTopUp: hasil.nomorTopUp };
}

/** Top up itu, saldo Member-nya, Riwayat saldo, dan Riwayat status Top up-nya. */
async function keadaan(topUpId: string, idMember: string) {
  const [dibaca] = await db
    .select({
      status: topUp.status,
      waktuBayar: topUp.waktuBayar,
      nominalDiterima: topUp.nominalDiterima,
      biayaTransaksi: topUp.biayaTransaksi,
    })
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
    .where(eq(riwayatSaldo.userId, idMember))
    .orderBy(asc(riwayatSaldo.id));
  const riwayatStatus = await db
    .select({
      status: riwayatStatusTopUp.status,
      pelaku: riwayatStatusTopUp.pelaku,
    })
    .from(riwayatStatusTopUp)
    .where(eq(riwayatStatusTopUp.topUpId, topUpId))
    .orderBy(asc(riwayatStatusTopUp.waktu));
  return { ...dibaca, saldo, riwayatSaldo: saldoTercatat, riwayatStatus };
}

/** Menjadikan Top up itu berstatus itu langsung di database, misalnya untuk kabar terlambat. */
async function jadikan(topUpId: string, status: "Kedaluwarsa" | "Dibatalkan") {
  await db.update(topUp).set({ status }).where(eq(topUp.id, topUpId));
}

describe("prosesKabarPembayaranTopUp (PRD §15.4, §15.5)", () => {
  // Contoh PRD §15.3: Nominal top up Rp 50.000 dan Kode unik Rp 123.
  it("Total bayar Rp 50.123 yang diterima membuat Top up Berhasil, menambah saldo Rp 50.000, dan mencatat satu baris Riwayat saldo Top up dengan Nomor Top up-nya", async () => {
    const dibuat = await topUpMenunggu({ nominalTopUp: 50000, kodeUnik: 123 });

    expect(
      await prosesKabarPembayaranTopUp(
        {
          qrisId: dibuat.qrisId,
          nominalDiterima: 50123,
          waktuBayar: WAKTU_BAYAR,
        },
        { sekarang: SEKARANG },
      ),
    ).toEqual({ hasil: "diproses" });

    expect(await keadaan(dibuat.id, dibuat.idMember)).toEqual({
      status: "Berhasil",
      waktuBayar: WAKTU_BAYAR,
      nominalDiterima: 50123,
      biayaTransaksi: 0,
      saldo: 50000,
      riwayatSaldo: [
        {
          jenis: "Top up",
          nominal: 50000,
          saldoSesudah: 50000,
          rujukan: dibuat.nomorTopUp,
        },
      ],
      riwayatStatus: [
        { status: "Menunggu Pembayaran", pelaku: "Member" },
        { status: "Berhasil", pelaku: "Qrispy" },
      ],
    });
  });

  it("kabar yang sama yang datang bersamaan menambah saldo satu kali", async () => {
    const dibuat = await topUpMenunggu({ nominalTopUp: 50000, kodeUnik: 123 });
    const kabar = {
      qrisId: dibuat.qrisId,
      nominalDiterima: 50123,
      waktuBayar: WAKTU_BAYAR,
    };

    const hasil = await Promise.all([
      prosesKabarPembayaranTopUp(kabar),
      prosesKabarPembayaranTopUp(kabar),
      prosesKabarPembayaranTopUp(kabar),
    ]);

    expect(hasil.filter((h) => h.hasil === "diproses")).toHaveLength(1);
    const akhir = await keadaan(dibuat.id, dibuat.idMember);
    expect(akhir.saldo).toBe(50000);
    expect(akhir.riwayatSaldo).toHaveLength(1);
  });

  // Contoh PRD §15.5 dengan nominal kurang: Total bayar Rp 150.200, diterima Rp 150.000.
  it("nominal kurang membuat Top up Bermasalah tanpa mengubah saldo, dan Biaya transaksi Rp 1.052-nya tetap tercatat", async () => {
    const dibuat = await topUpMenunggu({
      nominalTopUp: 150000,
      kodeUnik: 200,
    });

    await prosesKabarPembayaranTopUp(
      {
        qrisId: dibuat.qrisId,
        nominalDiterima: 150000,
        waktuBayar: WAKTU_BAYAR,
      },
      { sekarang: SEKARANG },
    );

    expect(await keadaan(dibuat.id, dibuat.idMember)).toEqual({
      status: "Bermasalah",
      waktuBayar: WAKTU_BAYAR,
      nominalDiterima: 150000,
      biayaTransaksi: 1052,
      saldo: 0,
      riwayatSaldo: [],
      riwayatStatus: [
        { status: "Menunggu Pembayaran", pelaku: "Member" },
        { status: "Bermasalah", pelaku: "Qrispy" },
      ],
    });

    // Kabar berulang untuk Top up Bermasalah tidak mengubah apa pun.
    expect(
      await prosesKabarPembayaranTopUp({
        qrisId: dibuat.qrisId,
        nominalDiterima: 150200,
        waktuBayar: WAKTU_BAYAR,
      }),
    ).toEqual({ hasil: "tidak-berubah" });
    expect((await keadaan(dibuat.id, dibuat.idMember)).saldo).toBe(0);
  });

  // Contoh PRD §15.5: Total bayar Rp 150.200 dengan 0,7% dan Rp 100.000.
  it("Total bayar Rp 150.200 dengan pengaturan 0,7% dan Rp 100.000 mencatat Biaya transaksi Rp 1.052, dan saldo bertambah Rp 150.000", async () => {
    const dibuat = await topUpMenunggu({
      nominalTopUp: 150000,
      kodeUnik: 200,
    });

    await prosesKabarPembayaranTopUp({
      qrisId: dibuat.qrisId,
      nominalDiterima: 150200,
      waktuBayar: WAKTU_BAYAR,
    });

    const akhir = await keadaan(dibuat.id, dibuat.idMember);
    expect(akhir.status).toBe("Berhasil");
    expect(akhir.biayaTransaksi).toBe(1052);
    expect(akhir.saldo).toBe(150000);
  });

  // Golden "Telat setelah Kedaluwarsa".
  it("kabar terlambat untuk Top up Kedaluwarsa dengan nominal cukup membuat Top up Berhasil dan menambah saldo", async () => {
    const dibuat = await topUpMenunggu({ nominalTopUp: 100000, kodeUnik: 45 });
    await jadikan(dibuat.id, "Kedaluwarsa");

    await prosesKabarPembayaranTopUp({
      qrisId: dibuat.qrisId,
      nominalDiterima: 100045,
      waktuBayar: WAKTU_BAYAR,
    });

    const akhir = await keadaan(dibuat.id, dibuat.idMember);
    expect(akhir.status).toBe("Berhasil");
    expect(akhir.saldo).toBe(100000);
    expect(akhir.biayaTransaksi).toBe(701);
    expect(akhir.riwayatSaldo).toHaveLength(1);
  });

  // Golden "Telat dan nominal kurang", untuk Top up Dibatalkan.
  it("kabar terlambat untuk Top up Dibatalkan dengan nominal kurang membuat Top up Bermasalah tanpa mengubah saldo", async () => {
    const dibuat = await topUpMenunggu({ nominalTopUp: 100000, kodeUnik: 45 });
    await jadikan(dibuat.id, "Dibatalkan");

    await prosesKabarPembayaranTopUp({
      qrisId: dibuat.qrisId,
      nominalDiterima: 100000,
      waktuBayar: WAKTU_BAYAR,
    });

    const akhir = await keadaan(dibuat.id, dibuat.idMember);
    expect(akhir.status).toBe("Bermasalah");
    expect(akhir.saldo).toBe(0);
    expect(akhir.biayaTransaksi).toBe(701);
  });

  it("QRIS yang tidak tertaut ke Top up mana pun tidak mengubah apa pun", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await prosesKabarPembayaranTopUp({
        qrisId: randomUUID(),
        nominalDiterima: 50123,
        waktuBayar: WAKTU_BAYAR,
      }),
    ).toEqual({ hasil: "qris-tidak-dikenal" });
  });
});

describe("cekStatusPembayaranTopUp (ADR-0004)", () => {
  it("Top up Rp 10.000 yang dibayar lewat Qrispy tiruan menjadi Berhasil dan menambah saldo tepat Rp 10.000, dan Qrispy ditanya paling sering sekali per 15 detik", async () => {
    const qrispy = qrispyKodeUnik(123);
    const dibuat = await topUpMenunggu({
      nominalTopUp: 10000,
      kodeUnik: 123,
      qrispy,
    });

    await cekStatusPembayaranTopUp(dibuat.nomorTopUp, dibuat.idMember, {
      qrispy,
      sekarang: SEKARANG,
    });
    expect((await keadaan(dibuat.id, dibuat.idMember)).status).toBe(
      "Menunggu Pembayaran",
    );

    bayarQrisTiruan(
      { qrisId: dibuat.qrisId, amount: 10123 },
      { sekarang: WAKTU_BAYAR },
    );
    // Masih dalam 15 detik sejak cek pertama: Qrispy tidak ditanya lagi.
    await cekStatusPembayaranTopUp(dibuat.nomorTopUp, dibuat.idMember, {
      qrispy,
      sekarang: new Date(SEKARANG.getTime() + 14_999),
    });
    expect(qrispy.cekStatusQris).toHaveBeenCalledTimes(1);

    await cekStatusPembayaranTopUp(dibuat.nomorTopUp, dibuat.idMember, {
      qrispy,
      sekarang: new Date(SEKARANG.getTime() + 15_000),
    });
    const akhir = await keadaan(dibuat.id, dibuat.idMember);
    expect(akhir.status).toBe("Berhasil");
    expect(akhir.saldo).toBe(10000);
    expect(akhir.nominalDiterima).toBe(10123);
    expect(akhir.waktuBayar).toEqual(WAKTU_BAYAR);
  });

  it("Member lain tidak memicu cek status Top up itu", async () => {
    const qrispy = qrispyKodeUnik(123);
    const dibuat = await topUpMenunggu({
      nominalTopUp: 10000,
      kodeUnik: 123,
      qrispy,
    });
    await cekStatusPembayaranTopUp(dibuat.nomorTopUp, randomUUID(), {
      qrispy,
    });
    expect(qrispy.cekStatusQris).not.toHaveBeenCalled();
  });
});
