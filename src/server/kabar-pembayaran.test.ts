import { randomBytes, randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { nomorPesanan } from "@/domain/nomor-pesanan";
import type { StatusPesanan } from "@/domain/status-pesanan";

import { db, koneksi } from "./db";
import {
  itemStok,
  pesanan,
  produk,
  riwayatStatusPesanan,
  varian,
} from "./db/schema";
import { bacaStokVarian } from "./item-stok";
import { cekStatusPembayaran, prosesKabarPembayaran } from "./kabar-pembayaran";
import { buatPesanan } from "./pesanan";
import type { Qrispy, StatusQris } from "./qrispy";
import { bayarQrisTiruan, qrispyTiruan } from "./qrispy-tiruan";
import { sisipkanProduk } from "./uji-katalog";

// Test integrasi dengan database app_test dari .env.ci, yang dipakai bersama test lain. Setiap test
// menyiapkan Produk dan Pesanannya sendiri langsung di database. Angka Total bayar, nominal diterima, dan
// Stok Varian diambil dari tests/golden/hasil-kabar-pembayaran.json; data Produknya bertanda [CONTOH].
afterAll(async () => {
  await koneksi.end();
});

const FORMAT = ["Email", "Password", "Profil"];
const WAKTU_BAYAR = new Date("2026-11-11T10:05:00+07:00");
const SEKARANG = new Date("2026-11-11T10:05:02+07:00");

/**
 * Pesanan Netflix Premium 1 Bulan [CONTOH] berstatus itu, disiapkan langsung di database, beserta
 * Varian dengan sejumlah Item stok Tersedia. Pesanan Menunggu Pembayaran menahan satu Item stok.
 */
async function siapkanPesanan({
  status,
  totalBayar,
  stokVarian,
}: {
  status: StatusPesanan;
  totalBayar: number;
  stokVarian: number;
}) {
  const produkId = await sisipkanProduk({
    nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
    varian: [
      { nama: "1 Bulan", hargaJual: totalBayar - 123, Tersedia: stokVarian },
    ],
  });
  await db
    .update(produk)
    .set({ formatItemStok: FORMAT })
    .where(eq(produk.id, produkId));
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const qrisId = randomUUID();
  const [{ id }] = await db
    .insert(pesanan)
    .values({
      nomorPesanan: nomorPesanan(randomBytes(6)),
      tautan: randomBytes(32).toString("base64url"),
      email: `budi-${randomUUID()}@example.test`,
      varianId,
      hargaJual: totalBayar - 123,
      potonganVoucher: 0,
      kodeUnik: 123,
      totalBayar,
      qrisId,
      kedaluwarsaPada: new Date("2026-11-11T10:15:00+07:00"),
      gambarQr: "data:image/png;base64,iVBORw0KGgo=",
      status,
    })
    .returning({ id: pesanan.id });

  let itemStokDitahan: string | undefined;
  if (status === "Menunggu Pembayaran") {
    [{ id: itemStokDitahan }] = await db
      .insert(itemStok)
      .values({
        varianId,
        status: "Ditahan",
        pesananId: id,
        isiTerenkripsi: "isi-uji",
        sidikJari: randomUUID(),
      })
      .returning({ id: itemStok.id });
  }
  return { id, qrisId, varianId, itemStokDitahan };
}

/** Pesanan itu langsung dari database. */
async function bacaPesanan(id: string) {
  const [baris] = await db
    .select({ status: pesanan.status, waktuBayar: pesanan.waktuBayar })
    .from(pesanan)
    .where(eq(pesanan.id, id));
  return baris;
}

/** Item stok yang tercatat milik Pesanan itu. */
function itemStokPesanan(id: string) {
  return db
    .select({
      id: itemStok.id,
      status: itemStok.status,
      formatSaatTerkirim: itemStok.formatSaatTerkirim,
    })
    .from(itemStok)
    .where(eq(itemStok.pesananId, id));
}

/** Riwayat status Pesanan itu, urut menurut waktu. */
function riwayat(id: string) {
  return db
    .select({
      waktu: riwayatStatusPesanan.waktu,
      status: riwayatStatusPesanan.status,
      pelaku: riwayatStatusPesanan.pelaku,
    })
    .from(riwayatStatusPesanan)
    .where(eq(riwayatStatusPesanan.pesananId, id))
    .orderBy(asc(riwayatStatusPesanan.waktu));
}

describe("prosesKabarPembayaran (PRD §5.7, §5.9)", () => {
  it("Normal: nominal sama dengan Total bayar membuat Pesanan Selesai, dan Item stok yang ditahannya Terkirim dengan nama kolom Format Item stok saat itu", async () => {
    const dipesan = await siapkanPesanan({
      status: "Menunggu Pembayaran",
      totalBayar: 45123,
      stokVarian: 7,
    });

    await prosesKabarPembayaran(
      {
        qrisId: dipesan.qrisId,
        nominalDiterima: 45123,
        waktuBayar: WAKTU_BAYAR,
      },
      { sekarang: SEKARANG },
    );

    expect(await bacaPesanan(dipesan.id)).toEqual({
      status: "Selesai",
      waktuBayar: WAKTU_BAYAR,
    });
    expect(await itemStokPesanan(dipesan.id)).toEqual([
      {
        id: dipesan.itemStokDitahan,
        status: "Terkirim",
        formatSaatTerkirim: ["Email", "Password", "Profil"],
      },
    ]);
    expect((await bacaStokVarian(dipesan.varianId)).stokVarian).toBe(7);
    expect(await riwayat(dipesan.id)).toEqual([
      { waktu: SEKARANG, status: "Selesai", pelaku: "Qrispy" },
    ]);
  });

  it("kabar pembayaran yang sama diproses dua kali: Pesanan tetap hanya punya satu Item stok, dan riwayatnya hanya bertambah sekali", async () => {
    const dipesan = await siapkanPesanan({
      status: "Menunggu Pembayaran",
      totalBayar: 45123,
      stokVarian: 7,
    });
    const kabar = {
      qrisId: dipesan.qrisId,
      nominalDiterima: 45123,
      waktuBayar: WAKTU_BAYAR,
    };

    expect(await prosesKabarPembayaran(kabar, { sekarang: SEKARANG })).toEqual({
      hasil: "diproses",
    });
    expect(
      await prosesKabarPembayaran(kabar, {
        sekarang: new Date("2026-11-11T10:05:30+07:00"),
      }),
    ).toEqual({ hasil: "tidak-berubah" });

    expect(await itemStokPesanan(dipesan.id)).toHaveLength(1);
    expect((await bacaStokVarian(dipesan.varianId)).stokVarian).toBe(7);
    expect(await bacaPesanan(dipesan.id)).toEqual({
      status: "Selesai",
      waktuBayar: WAKTU_BAYAR,
    });
    expect(await riwayat(dipesan.id)).toEqual([
      { waktu: SEKARANG, status: "Selesai", pelaku: "Qrispy" },
    ]);
  });

  it("kabar terlambat yang sama datang bersamaan untuk Pesanan Kedaluwarsa: Pesanan hanya mendapat satu Item stok baru", async () => {
    const dipesan = await siapkanPesanan({
      status: "Kedaluwarsa",
      totalBayar: 1250,
      stokVarian: 3,
    });
    const kabar = {
      qrisId: dipesan.qrisId,
      nominalDiterima: 1250,
      waktuBayar: WAKTU_BAYAR,
    };

    const hasil = await Promise.all(
      [1, 2, 3].map(() => prosesKabarPembayaran(kabar, { sekarang: SEKARANG })),
    );

    expect(hasil.map((h) => h.hasil).sort()).toEqual([
      "diproses",
      "tidak-berubah",
      "tidak-berubah",
    ]);
    expect(await itemStokPesanan(dipesan.id)).toHaveLength(1);
    expect((await bacaStokVarian(dipesan.varianId)).stokVarian).toBe(2);
    expect(await riwayat(dipesan.id)).toEqual([
      { waktu: SEKARANG, status: "Selesai", pelaku: "Qrispy" },
    ]);
  });

  // PRD §5.9 butir 2.
  it("Nominal kurang: Pesanan Bermasalah, dan Item stok yang ditahannya kembali Tersedia tanpa Pesanan", async () => {
    const dipesan = await siapkanPesanan({
      status: "Menunggu Pembayaran",
      totalBayar: 45123,
      stokVarian: 7,
    });

    await prosesKabarPembayaran(
      {
        qrisId: dipesan.qrisId,
        nominalDiterima: 45000,
        waktuBayar: WAKTU_BAYAR,
      },
      { sekarang: SEKARANG },
    );

    expect(await bacaPesanan(dipesan.id)).toEqual({
      status: "Bermasalah",
      waktuBayar: WAKTU_BAYAR,
    });
    expect(await itemStokPesanan(dipesan.id)).toEqual([]);
    expect(
      await db
        .select({ status: itemStok.status, pesananId: itemStok.pesananId })
        .from(itemStok)
        .where(eq(itemStok.id, dipesan.itemStokDitahan ?? "")),
    ).toEqual([{ status: "Tersedia", pesananId: null }]);
    expect((await bacaStokVarian(dipesan.varianId)).stokVarian).toBe(8);
    expect(await riwayat(dipesan.id)).toEqual([
      { waktu: SEKARANG, status: "Bermasalah", pelaku: "Qrispy" },
    ]);
  });

  it("Nominal lebih: diproses seperti pembayaran biasa", async () => {
    const dipesan = await siapkanPesanan({
      status: "Menunggu Pembayaran",
      totalBayar: 45123,
      stokVarian: 7,
    });

    await prosesKabarPembayaran(
      {
        qrisId: dipesan.qrisId,
        nominalDiterima: 46000,
        waktuBayar: WAKTU_BAYAR,
      },
      { sekarang: SEKARANG },
    );

    expect((await bacaPesanan(dipesan.id)).status).toBe("Selesai");
    expect(await itemStokPesanan(dipesan.id)).toMatchObject([
      { id: dipesan.itemStokDitahan, status: "Terkirim" },
    ]);
  });

  // PRD §5.9 butir 1. Status awalnya disiapkan langsung di database; Item stok Pesanan itu sudah dilepas.
  for (const status of ["Kedaluwarsa", "Dibatalkan"] as const) {
    it(`kabar terlambat untuk Pesanan ${status} dengan Stok Varian 3: Pesanan Selesai dengan satu Item stok Tersedia yang baru`, async () => {
      const dipesan = await siapkanPesanan({
        status,
        totalBayar: 1250,
        stokVarian: 3,
      });

      await prosesKabarPembayaran(
        {
          qrisId: dipesan.qrisId,
          nominalDiterima: 1250,
          waktuBayar: WAKTU_BAYAR,
        },
        { sekarang: SEKARANG },
      );

      expect(await bacaPesanan(dipesan.id)).toEqual({
        status: "Selesai",
        waktuBayar: WAKTU_BAYAR,
      });
      expect(await itemStokPesanan(dipesan.id)).toEqual([
        {
          id: expect.any(String),
          status: "Terkirim",
          formatSaatTerkirim: ["Email", "Password", "Profil"],
        },
      ]);
      expect(await bacaStokVarian(dipesan.varianId)).toEqual({
        stokVarian: 2,
        jumlahPerStatus: { Tersedia: 2, Ditahan: 0, Terkirim: 1 },
      });
      expect(await riwayat(dipesan.id)).toEqual([
        { waktu: SEKARANG, status: "Selesai", pelaku: "Qrispy" },
      ]);
    });

    it(`kabar terlambat untuk Pesanan ${status} dengan stok habis: Pesanan Bermasalah tanpa Item stok`, async () => {
      const dipesan = await siapkanPesanan({
        status,
        totalBayar: 1250,
        stokVarian: 0,
      });

      await prosesKabarPembayaran(
        {
          qrisId: dipesan.qrisId,
          nominalDiterima: 1250,
          waktuBayar: WAKTU_BAYAR,
        },
        { sekarang: SEKARANG },
      );

      expect(await bacaPesanan(dipesan.id)).toEqual({
        status: "Bermasalah",
        waktuBayar: WAKTU_BAYAR,
      });
      expect(await itemStokPesanan(dipesan.id)).toEqual([]);
      expect(await riwayat(dipesan.id)).toEqual([
        { waktu: SEKARANG, status: "Bermasalah", pelaku: "Qrispy" },
      ]);
    });
  }

  it("kabar terlambat dengan nominal kurang untuk Pesanan Kedaluwarsa: Pesanan Bermasalah tanpa mengambil Item stok", async () => {
    const dipesan = await siapkanPesanan({
      status: "Kedaluwarsa",
      totalBayar: 1250,
      stokVarian: 3,
    });

    await prosesKabarPembayaran(
      {
        qrisId: dipesan.qrisId,
        nominalDiterima: 1000,
        waktuBayar: WAKTU_BAYAR,
      },
      { sekarang: SEKARANG },
    );

    expect((await bacaPesanan(dipesan.id)).status).toBe("Bermasalah");
    expect(await itemStokPesanan(dipesan.id)).toEqual([]);
    expect((await bacaStokVarian(dipesan.varianId)).stokVarian).toBe(3);
  });

  it("kabar untuk Pesanan Dana Dikembalikan tidak mengubah apa pun", async () => {
    const dipesan = await siapkanPesanan({
      status: "Dana Dikembalikan",
      totalBayar: 1250,
      stokVarian: 5,
    });

    expect(
      await prosesKabarPembayaran(
        {
          qrisId: dipesan.qrisId,
          nominalDiterima: 1250,
          waktuBayar: WAKTU_BAYAR,
        },
        { sekarang: SEKARANG },
      ),
    ).toEqual({ hasil: "tidak-berubah" });

    expect(await bacaPesanan(dipesan.id)).toEqual({
      status: "Dana Dikembalikan",
      waktuBayar: null,
    });
    expect(await itemStokPesanan(dipesan.id)).toEqual([]);
    expect((await bacaStokVarian(dipesan.varianId)).stokVarian).toBe(5);
    expect(await riwayat(dipesan.id)).toEqual([]);
  });

  it("kabar untuk QRIS yang tidak dikenal tidak mengubah apa pun", async () => {
    expect(
      await prosesKabarPembayaran({
        qrisId: randomUUID(),
        nominalDiterima: 45123,
        waktuBayar: WAKTU_BAYAR,
      }),
    ).toEqual({ hasil: "qris-tidak-dikenal" });
  });
});

/**
 * Checkout Netflix Premium 1 Bulan Rp 50.000 [CONTOH] lewat Qrispy itu. Hasilnya Tautan Pesanan, qris_id,
 * Total bayar, id Pesanan, dan id Varian-nya.
 */
async function checkout(qrispy: Qrispy) {
  const produkId = await sisipkanProduk({
    nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 10 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const hasil = await buatPesanan(
    { varianId, email: `budi-${randomUUID()}@example.test` },
    { qrispy },
  );
  if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);
  const [dibuat] = await db
    .select({
      id: pesanan.id,
      qrisId: pesanan.qrisId,
      totalBayar: pesanan.totalBayar,
    })
    .from(pesanan)
    .where(eq(pesanan.tautan, hasil.tautan));
  return { tautan: hasil.tautan, varianId, ...dibuat };
}

/** Qrispy tiruan yang cek statusnya selalu menjawab status itu, dengan pencatat panggilan cek status. */
function qrispyMenjawab(status: StatusQris) {
  return {
    ...qrispyTiruan,
    cekStatusQris: vi.fn<Qrispy["cekStatusQris"]>(async () => status),
  };
}

// ADR-0004: server toko menanyakan status QRIS ke Qrispy lewat adaptor saat halaman di Tautan Pesanan
// dimuat, paling sering sekali per 15 detik untuk setiap Pesanan, lalu meneruskan status paid ke pemroses.
describe("cekStatusPembayaran (ADR-0004)", () => {
  it("cek status yang menjawab paid dengan nominal sama dengan Total bayar membuat Pesanan Selesai, dan Item stok yang ditahannya Terkirim", async () => {
    const dipesan = await checkout(qrispyTiruan);
    const [ditahan] = await itemStokPesanan(dipesan.id);
    bayarQrisTiruan(
      { qrisId: dipesan.qrisId, amount: dipesan.totalBayar },
      { sekarang: WAKTU_BAYAR },
    );

    await cekStatusPembayaran(dipesan.tautan, { qrispy: qrispyTiruan });

    expect(await bacaPesanan(dipesan.id)).toEqual({
      status: "Selesai",
      waktuBayar: WAKTU_BAYAR,
    });
    expect(await itemStokPesanan(dipesan.id)).toEqual([
      { id: ditahan.id, status: "Terkirim", formatSaatTerkirim: ["Kode"] },
    ]);
    expect((await riwayat(dipesan.id)).map((r) => r.status)).toEqual([
      "Menunggu Pembayaran",
      "Selesai",
    ]);
  });

  it("cek status yang menjawab pending tidak mengubah Pesanan", async () => {
    const dipesan = await checkout(qrispyTiruan);

    await cekStatusPembayaran(dipesan.tautan, { qrispy: qrispyTiruan });

    expect((await bacaPesanan(dipesan.id)).status).toBe("Menunggu Pembayaran");
    expect(await itemStokPesanan(dipesan.id)).toMatchObject([
      { status: "Ditahan" },
    ]);
  });

  it("cek status ke Qrispy untuk satu Pesanan tidak terjadi lebih dari sekali dalam 15 detik", async () => {
    const dipesan = await checkout(qrispyTiruan);
    const qrispy = qrispyMenjawab({ paymentStatus: "pending" });
    const pukul = (waktu: string) => ({
      qrispy,
      sekarang: new Date(`2026-11-11T${waktu}+07:00`),
    });

    await cekStatusPembayaran(dipesan.tautan, pukul("10:00:00.000"));
    await cekStatusPembayaran(dipesan.tautan, pukul("10:00:00.000"));
    await cekStatusPembayaran(dipesan.tautan, pukul("10:00:14.999"));
    expect(qrispy.cekStatusQris).toHaveBeenCalledTimes(1);

    await cekStatusPembayaran(dipesan.tautan, pukul("10:00:15.000"));
    expect(qrispy.cekStatusQris).toHaveBeenCalledTimes(2);
    await cekStatusPembayaran(dipesan.tautan, pukul("10:00:29.999"));
    expect(qrispy.cekStatusQris).toHaveBeenCalledTimes(2);
    expect(qrispy.cekStatusQris).toHaveBeenCalledWith(dipesan.qrisId);
  });

  it("halaman yang dimuat bersamaan hanya menanyakan status sekali", async () => {
    const dipesan = await checkout(qrispyTiruan);
    const qrispy = qrispyMenjawab({ paymentStatus: "pending" });

    await Promise.all(
      [1, 2, 3].map(() =>
        cekStatusPembayaran(dipesan.tautan, { qrispy, sekarang: SEKARANG }),
      ),
    );

    expect(qrispy.cekStatusQris).toHaveBeenCalledTimes(1);
  });

  it("batas 15 detik berlaku per Pesanan: Pesanan lain tetap ditanyakan", async () => {
    const [a, b] = [await checkout(qrispyTiruan), await checkout(qrispyTiruan)];
    const qrispy = qrispyMenjawab({ paymentStatus: "pending" });

    await cekStatusPembayaran(a.tautan, { qrispy, sekarang: SEKARANG });
    await cekStatusPembayaran(b.tautan, { qrispy, sekarang: SEKARANG });

    expect(qrispy.cekStatusQris.mock.calls).toEqual([[a.qrisId], [b.qrisId]]);
  });

  // ADR-0004: bila Qrispy gagal menjawab, misalnya 429, toko menunggu sampai giliran cek berikutnya.
  it("bila Qrispy gagal menjawab, Pesanan tidak berubah dan cek berikutnya menunggu 15 detik", async () => {
    const dipesan = await checkout(qrispyTiruan);
    const qrispy = {
      ...qrispyTiruan,
      cekStatusQris: vi.fn<Qrispy["cekStatusQris"]>(async () => {
        throw new Error("Qrispy tiruan dibuat gagal: 429 Too Many Requests");
      }),
    };
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});

    await cekStatusPembayaran(dipesan.tautan, { qrispy, sekarang: SEKARANG });
    await cekStatusPembayaran(dipesan.tautan, {
      qrispy,
      sekarang: new Date(SEKARANG.getTime() + 14_999),
    });

    expect(qrispy.cekStatusQris).toHaveBeenCalledTimes(1);
    expect((await bacaPesanan(dipesan.id)).status).toBe("Menunggu Pembayaran");
    galat.mockRestore();
  });

  it("Pesanan yang tidak lagi Menunggu Pembayaran tidak ditanyakan ke Qrispy", async () => {
    const dipesan = await checkout(qrispyTiruan);
    await prosesKabarPembayaran({
      qrisId: dipesan.qrisId,
      nominalDiterima: dipesan.totalBayar,
      waktuBayar: WAKTU_BAYAR,
    });
    const qrispy = qrispyMenjawab({
      paymentStatus: "paid",
      amount: dipesan.totalBayar,
      paidAt: WAKTU_BAYAR,
    });

    await cekStatusPembayaran(dipesan.tautan, { qrispy });

    expect(qrispy.cekStatusQris).not.toHaveBeenCalled();
  });

  it("Tautan Pesanan yang tidak dikenal tidak ditanyakan ke Qrispy", async () => {
    const qrispy = qrispyMenjawab({ paymentStatus: "pending" });

    await cekStatusPembayaran(randomBytes(32).toString("base64url"), {
      qrispy,
    });

    expect(qrispy.cekStatusQris).not.toHaveBeenCalled();
  });
});
