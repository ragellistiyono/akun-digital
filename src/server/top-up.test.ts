import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { db, koneksi } from "./db";
import { pesanan, riwayatStatusTopUp, topUp, user, varian } from "./db/schema";
import { prosesKedaluwarsaTopUp } from "./kedaluwarsa-top-up";
import { jadwalKedaluwarsaTopUp } from "./pekerjaan-latar";
import { buatPesanan } from "./pesanan";
import type { Qrispy } from "./qrispy";
import { bayarQrisTiruan, qrispyTiruan } from "./qrispy-tiruan";
import { bacaTopUpMember, batalkanTopUp, buatTopUp } from "./top-up";
import { sisipkanProduk } from "./uji-katalog";
import { sisipkanMember } from "./uji-member";

// Test integrasi Top up (T77, PRD §15.3, §15.4) dengan database app_test dan Qrispy tiruan dari .env.ci, yang dipakai
// bersama test lain. Setiap test memakai Member dengan email unik.
afterAll(async () => {
  await koneksi.end();
});

/** Member baru dengan email unik, beserta id-nya. */
async function memberBaru() {
  const email = `budi-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return { email, id };
}

/** Waktu kedaluwarsa QRIS contoh PRD §5.8: terbit 10.00.00, kedaluwarsa 10.15.00. */
const KEDALUWARSA_PADA = new Date("2026-11-11T10:15:00+07:00");

/**
 * Qrispy tiruan yang menerbitkan QRIS dengan Kode unik Rp 123 (contoh PRD §15.3) dan waktu kedaluwarsa 10.15.00.
 * Setiap pembuatan, pembatalan, dan cek status QRIS tercatat.
 */
function qrispyKodeUnik123() {
  return {
    buatQris: vi.fn<Qrispy["buatQris"]>(async (masukan) => ({
      ...(await qrispyTiruan.buatQris(masukan)),
      amount: masukan.amount + 123,
      uniqueId: 123,
      expiredAt: KEDALUWARSA_PADA,
    })),
    batalkanQris: vi.fn<Qrispy["batalkanQris"]>(qrispyTiruan.batalkanQris),
    cekStatusQris: vi.fn<Qrispy["cekStatusQris"]>(qrispyTiruan.cekStatusQris),
  } satisfies Qrispy;
}

describe("buatTopUp", () => {
  it("Top up Rp 10.000 menerbitkan QRIS dengan Nomor Top up sebagai payment_reference, lalu Total bayar = Nominal top up + Kode unik", async () => {
    const { id } = await memberBaru();
    const qrispy = qrispyKodeUnik123();

    const hasil = await buatTopUp(
      { idMember: id, nominal: "10000" },
      { qrispy },
    );

    expect(hasil.hasil).toBe("dibuat");
    if (hasil.hasil !== "dibuat") return;
    expect(hasil.nomorTopUp).toMatch(/^TOPUP-[A-Z2-9]{6}$/);
    expect(qrispy.buatQris).toHaveBeenCalledExactlyOnceWith({
      amount: 10000,
      paymentReference: hasil.nomorTopUp,
    });

    const dibaca = await bacaTopUpMember({
      nomorTopUp: hasil.nomorTopUp,
      idMember: id,
    });
    expect(dibaca).toMatchObject({
      nomorTopUp: hasil.nomorTopUp,
      status: "Menunggu Pembayaran",
      kedaluwarsaPada: KEDALUWARSA_PADA,
      rincian: { nominalTopUp: 10000, kodeUnik: 123, totalBayar: 10123 },
    });

    const [{ id: topUpId }] = await db
      .select({ id: topUp.id })
      .from(topUp)
      .where(eq(topUp.nomorTopUp, hasil.nomorTopUp));
    const riwayat = await db
      .select({
        status: riwayatStatusTopUp.status,
        pelaku: riwayatStatusTopUp.pelaku,
      })
      .from(riwayatStatusTopUp)
      .where(eq(riwayatStatusTopUp.topUpId, topUpId))
      .orderBy(asc(riwayatStatusTopUp.waktu));
    expect(riwayat).toEqual([
      { status: "Menunggu Pembayaran", pelaku: "Member" },
    ]);
    expect(await jadwalKedaluwarsaTopUp(topUpId)).toEqual([KEDALUWARSA_PADA]);
  });

  it("Qrispy tiruan bawaan menerbitkan QRIS Top up dengan Kode unik Rp 1–499", async () => {
    const { id } = await memberBaru();
    const hasil = await buatTopUp(
      { idMember: id, nominal: "50.000" },
      { qrispy: qrispyTiruan },
    );
    if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);
    const dibaca = await bacaTopUpMember({
      nomorTopUp: hasil.nomorTopUp,
      idMember: id,
    });
    expect(dibaca?.rincian.nominalTopUp).toBe(50000);
    expect(dibaca?.rincian.kodeUnik).toBeGreaterThanOrEqual(1);
    expect(dibaca?.rincian.kodeUnik).toBeLessThanOrEqual(499);
  });
});

/** Top up Menunggu Pembayaran baru milik Member itu, beserta id dan qris_id-nya. */
async function topUpBaru(
  idMember: string,
  qrispy: Qrispy,
  { sekarang }: { sekarang?: Date } = {},
) {
  const hasil = await buatTopUp(
    { idMember, nominal: "10000" },
    { qrispy, sekarang },
  );
  if (hasil.hasil !== "dibuat") throw new Error(`Top up gagal: ${hasil.hasil}`);
  const [baris] = await db
    .select({ id: topUp.id, qrisId: topUp.qrisId })
    .from(topUp)
    .where(eq(topUp.nomorTopUp, hasil.nomorTopUp));
  return { ...baris, nomorTopUp: hasil.nomorTopUp };
}

/** Status Top up itu dan Riwayat status-nya, urut menurut waktu. */
async function statusDanRiwayat(topUpId: string) {
  const [{ status }] = await db
    .select({ status: topUp.status })
    .from(topUp)
    .where(eq(topUp.id, topUpId));
  const riwayat = await db
    .select({
      status: riwayatStatusTopUp.status,
      pelaku: riwayatStatusTopUp.pelaku,
    })
    .from(riwayatStatusTopUp)
    .where(eq(riwayatStatusTopUp.topUpId, topUpId))
    .orderBy(asc(riwayatStatusTopUp.waktu));
  return { status, riwayat };
}

/** Jumlah Top up milik Member itu. */
async function jumlahTopUp(idMember: string) {
  return (
    await db
      .select({ id: topUp.id })
      .from(topUp)
      .where(eq(topUp.userId, idMember))
  ).length;
}

describe("satu Top up menunggu per Member (PRD §15.3)", () => {
  // UAT-O3 langkah 2.
  it("Top up kedua selagi Top up Rp 10.000 masih menunggu mengarah ke Top up pertama, tanpa QRIS dan Top up baru", async () => {
    const { id } = await memberBaru();
    const qrispy = qrispyKodeUnik123();
    const pertama = await topUpBaru(id, qrispy);

    const kedua = await buatTopUp(
      { idMember: id, nominal: "20000" },
      { qrispy },
    );

    expect(kedua).toEqual({
      hasil: "menunggu",
      nomorTopUp: pertama.nomorTopUp,
    });
    expect(qrispy.buatQris).toHaveBeenCalledTimes(1);
    expect(await jumlahTopUp(id)).toBe(1);
  });

  it("dua Bayar dengan QRIS bersamaan menghasilkan satu Top up", async () => {
    const { id } = await memberBaru();
    const qrispy = qrispyKodeUnik123();
    const [a, b] = await Promise.all([
      buatTopUp({ idMember: id, nominal: "10000" }, { qrispy }),
      buatTopUp({ idMember: id, nominal: "20000" }, { qrispy }),
    ]);
    expect(await jumlahTopUp(id)).toBe(1);
    const nomor = [a, b].map((h) => ("nomorTopUp" in h ? h.nomorTopUp : null));
    expect(nomor[0]).toBe(nomor[1]);
  });

  it("Member boleh punya satu Pesanan menunggu dan satu Top up menunggu sekaligus", async () => {
    const { id, email } = await memberBaru();
    const produkId = await sisipkanProduk({
      nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
      varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 10 }],
    });
    const [{ id: varianId }] = await db
      .select({ id: varian.id })
      .from(varian)
      .where(eq(varian.produkId, produkId));

    const dipesan = await buatPesanan(
      { varianId, email, member: true },
      { qrispy: qrispyTiruan },
    );
    expect(dipesan.hasil).toBe("dibuat");
    const diTopUp = await buatTopUp(
      { idMember: id, nominal: "10000" },
      { qrispy: qrispyTiruan },
    );
    expect(diTopUp.hasil).toBe("dibuat");

    // Top up tidak mengubah Pesanan menunggu itu.
    const [{ status }] = await db
      .select({ status: pesanan.status })
      .from(pesanan)
      .where(eq(pesanan.email, email));
    expect(status).toBe("Menunggu Pembayaran");
  });
});

describe("isian Top up yang ditolak", () => {
  it.each([
    ["9999", "di-bawah-minimal"],
    ["499001", "di-atas-maksimal"],
    ["", "kosong"],
  ])(
    "nominal %j ditolak dengan alasan %s tanpa QRIS",
    async (nominal, alasan) => {
      const { id } = await memberBaru();
      const qrispy = qrispyKodeUnik123();
      expect(await buatTopUp({ idMember: id, nominal }, { qrispy })).toEqual({
        hasil: "ditolak",
        alasan,
      });
      expect(qrispy.buatQris).not.toHaveBeenCalled();
      expect(await jumlahTopUp(id)).toBe(0);
    },
  );
});

describe("bacaTopUpMember", () => {
  it("Member lain tidak bisa membaca Top up itu", async () => {
    const pemilik = await memberBaru();
    const lain = await memberBaru();
    const dibuat = await topUpBaru(pemilik.id, qrispyKodeUnik123());
    expect(
      await bacaTopUpMember({
        nomorTopUp: dibuat.nomorTopUp,
        idMember: lain.id,
      }),
    ).toBeNull();
  });
});

describe("batalkanTopUp (PRD §15.3, §5.8)", () => {
  it("membatalkan QRIS di Qrispy, lalu Top up menjadi Dibatalkan dengan pelaku Member", async () => {
    const { id } = await memberBaru();
    const qrispy = qrispyKodeUnik123();
    const dibuat = await topUpBaru(id, qrispy);

    expect(
      await batalkanTopUp(
        { nomorTopUp: dibuat.nomorTopUp, idMember: id },
        { qrispy },
      ),
    ).toEqual({ hasil: "dibatalkan" });
    expect(qrispy.batalkanQris).toHaveBeenCalledExactlyOnceWith(dibuat.qrisId);
    expect(await statusDanRiwayat(dibuat.id)).toEqual({
      status: "Dibatalkan",
      riwayat: [
        { status: "Menunggu Pembayaran", pelaku: "Member" },
        { status: "Dibatalkan", pelaku: "Member" },
      ],
    });

    // Setelah dibatalkan, Member boleh top up lagi.
    expect(
      (await buatTopUp({ idMember: id, nominal: "10000" }, { qrispy })).hasil,
    ).toBe("dibuat");
  });

  it("Member lain tidak bisa membatalkan Top up itu, dan Qrispy tidak dimintai pembatalan", async () => {
    const pemilik = await memberBaru();
    const lain = await memberBaru();
    const qrispy = qrispyKodeUnik123();
    const dibuat = await topUpBaru(pemilik.id, qrispy);
    expect(
      await batalkanTopUp(
        { nomorTopUp: dibuat.nomorTopUp, idMember: lain.id },
        { qrispy },
      ),
    ).toEqual({ hasil: "tidak-ditemukan" });
    expect(qrispy.batalkanQris).not.toHaveBeenCalled();
    expect((await statusDanRiwayat(dibuat.id)).status).toBe(
      "Menunggu Pembayaran",
    );
  });

  it("bila Qrispy menolak karena tagihan sudah dibayar, Top up tetap Menunggu Pembayaran", async () => {
    const { id } = await memberBaru();
    const qrispy = qrispyKodeUnik123();
    const dibuat = await topUpBaru(id, qrispy);
    bayarQrisTiruan({ qrisId: dibuat.qrisId, amount: 10123 });

    expect(
      await batalkanTopUp(
        { nomorTopUp: dibuat.nomorTopUp, idMember: id },
        { qrispy },
      ),
    ).toEqual({ hasil: "sudah-dibayar" });
    expect((await statusDanRiwayat(dibuat.id)).status).toBe(
      "Menunggu Pembayaran",
    );
  });

  it("bila Qrispy tidak membatalkan dan status QRIS-nya masih pending, pembatalan gagal", async () => {
    const { id } = await memberBaru();
    const qrispy = qrispyKodeUnik123();
    const dibuat = await topUpBaru(id, qrispy);
    qrispy.batalkanQris.mockRejectedValueOnce(
      new Error("Qrispy tidak menjawab"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      await batalkanTopUp(
        { nomorTopUp: dibuat.nomorTopUp, idMember: id },
        { qrispy },
      ),
    ).toEqual({ hasil: "gagal" });
    expect((await statusDanRiwayat(dibuat.id)).status).toBe(
      "Menunggu Pembayaran",
    );
  });
});

describe("prosesKedaluwarsaTopUp (PRD §15.3, §5.8)", () => {
  const pukul = (jam: string) => new Date(`2026-11-11T${jam}+07:00`);

  it("Top up dengan waktu kedaluwarsa 10.15.00 masih menunggu pukul 10.14.59, dan Kedaluwarsa pukul 10.15.00 dengan pelaku Sistem", async () => {
    const { id } = await memberBaru();
    const qrispy = qrispyKodeUnik123();
    const dibuat = await topUpBaru(id, qrispy, { sekarang: pukul("10:00:00") });

    expect(
      await prosesKedaluwarsaTopUp(dibuat.id, {
        qrispy,
        sekarang: pukul("10:14:59"),
      }),
    ).toEqual({
      hasil: "belum-kedaluwarsa",
      kedaluwarsaPada: KEDALUWARSA_PADA,
    });
    expect(qrispy.cekStatusQris).not.toHaveBeenCalled();

    expect(
      await prosesKedaluwarsaTopUp(dibuat.id, {
        qrispy,
        sekarang: pukul("10:15:00"),
      }),
    ).toEqual({ hasil: "kedaluwarsa" });
    expect(qrispy.cekStatusQris).toHaveBeenCalledExactlyOnceWith(dibuat.qrisId);
    expect(await statusDanRiwayat(dibuat.id)).toEqual({
      status: "Kedaluwarsa",
      riwayat: [
        { status: "Menunggu Pembayaran", pelaku: "Member" },
        { status: "Kedaluwarsa", pelaku: "Sistem" },
      ],
    });

    // Pekerjaan yang terulang tidak mengubah apa pun lagi.
    expect(
      await prosesKedaluwarsaTopUp(dibuat.id, {
        qrispy,
        sekarang: pukul("10:20:00"),
      }),
    ).toEqual({ hasil: "tidak-berubah" });
  });

  it("tetap Kedaluwarsa tepat waktu bila cek status Qrispy gagal", async () => {
    const { id } = await memberBaru();
    const qrispy = qrispyKodeUnik123();
    const dibuat = await topUpBaru(id, qrispy);
    qrispy.cekStatusQris.mockRejectedValueOnce(
      new Error("Qrispy tidak menjawab"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      await prosesKedaluwarsaTopUp(dibuat.id, {
        qrispy,
        sekarang: pukul("10:15:00"),
      }),
    ).toEqual({ hasil: "kedaluwarsa" });
    expect((await statusDanRiwayat(dibuat.id)).status).toBe("Kedaluwarsa");
  });
});
