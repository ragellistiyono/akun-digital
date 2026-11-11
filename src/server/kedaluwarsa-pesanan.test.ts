import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { STATUS_PESANAN, type StatusPesanan } from "@/domain/status-pesanan";

import golden from "../../tests/golden/transisi-status-pesanan.json";
import { db, koneksi } from "./db";
import { itemStok, pesanan, riwayatStatusPesanan, varian } from "./db/schema";
import { bacaStokVarian } from "./item-stok";
import { prosesKabarPembayaran } from "./kabar-pembayaran";
import { prosesKedaluwarsaPesanan } from "./kedaluwarsa-pesanan";
import { batalkanPesanan } from "./pembatalan-pesanan";
import { buatPesanan } from "./pesanan";
import type { Qrispy } from "./qrispy";
import { bayarQrisTiruan, qrispyTiruan } from "./qrispy-tiruan";
import { sisipkanProduk } from "./uji-katalog";
import { sisipkanPesanan } from "./uji-pesanan";

// Test integrasi dengan database app_test dan Qrispy tiruan dari .env.ci, yang dipakai bersama test lain.
// Setiap test membuat Produk dan Pesanannya sendiri lewat checkout. Waktu kedaluwarsa dan jamnya diambil
// dari contoh PRD §5.8; data Produknya bertanda [CONTOH].
afterAll(async () => {
  await koneksi.end();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Contoh PRD §5.8: QRIS terbit pukul 10.00.00 dengan waktu kedaluwarsa 10.15.00. */
const KEDALUWARSA_PADA = new Date("2026-11-11T10:15:00+07:00");
const pukul = (jam: string) => new Date(`2026-11-11T${jam}+07:00`);

/** Status dari fixture golden, yang harus salah satu status Pesanan (PRD §5.7). */
function status(teks: string): StatusPesanan {
  const dikenal = STATUS_PESANAN.find((s) => s === teks);
  if (!dikenal) throw new Error(`Status "${teks}" tidak dikenal.`);
  return dikenal;
}

/** Status yang menurut golden tidak boleh berpindah ke Kedaluwarsa, yaitu semua selain Menunggu Pembayaran. */
const STATUS_TIDAK_BISA_KEDALUWARSA = golden.kasus
  .filter(({ input, output }) => input.ke === "Kedaluwarsa" && !output.boleh)
  .map(({ input }) => status(input.dari));

/**
 * Qrispy tiruan yang menerbitkan QRIS dengan waktu kedaluwarsa 10.15.00. Pembayaran dan pembatalannya
 * memakai Qrispy tiruan, jadi bayarQrisTiruan membuat cek statusnya menjawab `paid`. Setiap cek status
 * tercatat.
 */
function qrispyKedaluwarsa1015() {
  return {
    buatQris: async (masukan: Parameters<Qrispy["buatQris"]>[0]) => ({
      ...(await qrispyTiruan.buatQris(masukan)),
      expiredAt: KEDALUWARSA_PADA,
    }),
    batalkanQris: qrispyTiruan.batalkanQris,
    cekStatusQris: vi.fn<Qrispy["cekStatusQris"]>(qrispyTiruan.cekStatusQris),
  } satisfies Qrispy;
}

/** Varian Netflix Premium 1 Bulan Rp 50.000 [CONTOH] dengan 10 Item stok Tersedia. */
async function netflixSatuBulan() {
  const produkId = await sisipkanProduk({
    nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 10 }],
  });
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return id;
}

/** Checkout Varian itu sampai Pesanan Menunggu Pembayaran dibuat. */
async function checkout(varianId: string, qrispy: Qrispy) {
  const hasil = await buatPesanan(
    { varianId, email: `budi-${randomUUID()}@example.test` },
    { qrispy },
  );
  if (hasil.hasil !== "dibuat") {
    throw new Error(`Checkout gagal: ${hasil.hasil}`);
  }
  const [dibuat] = await db
    .select({
      id: pesanan.id,
      qrisId: pesanan.qrisId,
      totalBayar: pesanan.totalBayar,
    })
    .from(pesanan)
    .where(eq(pesanan.tautan, hasil.tautan));
  return { ...dibuat, tautan: hasil.tautan };
}

/** Status Pesanan itu langsung dari database. */
async function statusPesanan(id: string) {
  const [baris] = await db
    .select({ status: pesanan.status })
    .from(pesanan)
    .where(eq(pesanan.id, id));
  return baris.status;
}

/** Item stok yang tercatat milik Pesanan itu. */
function itemStokPesanan(id: string) {
  return db
    .select({ id: itemStok.id, status: itemStok.status })
    .from(itemStok)
    .where(eq(itemStok.pesananId, id));
}

/**
 * Riwayat status Pesanan itu sesudah checkout, urut menurut waktu. Baris dari checkout, satu-satunya
 * yang berstatus Menunggu Pembayaran, dilewati, karena waktunya jam sungguhan sedangkan jam di test ini
 * dikendalikan.
 */
async function riwayatSesudahCheckout(id: string) {
  const semua = await db
    .select({
      waktu: riwayatStatusPesanan.waktu,
      status: riwayatStatusPesanan.status,
      pelaku: riwayatStatusPesanan.pelaku,
    })
    .from(riwayatStatusPesanan)
    .where(eq(riwayatStatusPesanan.pesananId, id))
    .orderBy(asc(riwayatStatusPesanan.waktu));
  return semua.filter(({ status }) => status !== "Menunggu Pembayaran");
}

describe("prosesKedaluwarsaPesanan (PRD §5.3, §5.7, §5.8, ADR-0004)", () => {
  it("Pesanan dengan waktu kedaluwarsa 10.15.00 masih Menunggu Pembayaran pukul 10.14.59, dan sudah Kedaluwarsa pukul 10.15.00", async () => {
    const qrispy = qrispyKedaluwarsa1015();
    const dipesan = await checkout(await netflixSatuBulan(), qrispy);

    expect(
      await prosesKedaluwarsaPesanan(dipesan.id, {
        qrispy,
        sekarang: pukul("10:14:59"),
      }),
    ).toEqual({
      hasil: "belum-kedaluwarsa",
      kedaluwarsaPada: KEDALUWARSA_PADA,
    });
    expect(await statusPesanan(dipesan.id)).toBe("Menunggu Pembayaran");
    expect(await itemStokPesanan(dipesan.id)).toMatchObject([
      { status: "Ditahan" },
    ]);
    expect(qrispy.cekStatusQris).not.toHaveBeenCalled();

    await prosesKedaluwarsaPesanan(dipesan.id, {
      qrispy,
      sekarang: pukul("10:15:00"),
    });
    expect(await statusPesanan(dipesan.id)).toBe("Kedaluwarsa");
    expect(await riwayatSesudahCheckout(dipesan.id)).toEqual([
      { waktu: pukul("10:15:00"), status: "Kedaluwarsa", pelaku: "Sistem" },
    ]);
  });

  // PRD §5.3: Item stok dilepas lagi bila Pesanannya Kedaluwarsa.
  it("setelah Kedaluwarsa, Stok Varian kembali seperti sebelum checkout, dan Item stok yang ditahan kembali Tersedia tanpa Pesanan", async () => {
    const qrispy = qrispyKedaluwarsa1015();
    const varianId = await netflixSatuBulan();
    const sebelumCheckout = await bacaStokVarian(varianId);
    const dipesan = await checkout(varianId, qrispy);
    const [ditahan] = await itemStokPesanan(dipesan.id);
    expect((await bacaStokVarian(varianId)).stokVarian).toBe(9);

    await prosesKedaluwarsaPesanan(dipesan.id, {
      qrispy,
      sekarang: pukul("10:15:00"),
    });

    expect(await bacaStokVarian(varianId)).toEqual(sebelumCheckout);
    expect(sebelumCheckout.stokVarian).toBe(10);
    expect(await itemStokPesanan(dipesan.id)).toEqual([]);
    expect(
      await db
        .select({ status: itemStok.status, pesananId: itemStok.pesananId })
        .from(itemStok)
        .where(eq(itemStok.id, ditahan.id)),
    ).toEqual([{ status: "Tersedia", pesananId: null }]);
  });

  // ADR-0004: server toko menanyakan status QRIS ke Qrispy sekali lagi tepat sebelum Pesanan dijadikan
  // Kedaluwarsa, lalu meneruskan status `paid` ke pemroses kabar pembayaran.
  it("bila cek status saat kedaluwarsa menjawab paid, Pesanan diproses sebagai sudah dibayar, bukan menjadi Kedaluwarsa", async () => {
    const qrispy = qrispyKedaluwarsa1015();
    const dipesan = await checkout(await netflixSatuBulan(), qrispy);
    const [ditahan] = await itemStokPesanan(dipesan.id);
    bayarQrisTiruan(
      { qrisId: dipesan.qrisId, amount: dipesan.totalBayar },
      { sekarang: pukul("10:14:30") },
    );

    await prosesKedaluwarsaPesanan(dipesan.id, {
      qrispy,
      sekarang: pukul("10:15:00"),
    });

    expect(qrispy.cekStatusQris).toHaveBeenCalledExactlyOnceWith(
      dipesan.qrisId,
    );
    expect(await statusPesanan(dipesan.id)).toBe("Selesai");
    expect(await itemStokPesanan(dipesan.id)).toEqual([
      { id: ditahan.id, status: "Terkirim" },
    ]);
    expect(await riwayatSesudahCheckout(dipesan.id)).toEqual([
      { waktu: pukul("10:15:00"), status: "Selesai", pelaku: "Qrispy" },
    ]);
  });

  // Issue T21: status QRIS ditanyakan sekali. Bila Qrispy tidak menjawab, pembayarannya tidak terbukti,
  // jadi Pesanan tetap menjadi Kedaluwarsa tepat waktu. Kabar pembayaran yang datang sesudahnya diproses
  // sebagai kabar terlambat (PRD §5.9).
  it("bila status QRIS gagal ditanyakan saat kedaluwarsa, Pesanan tetap menjadi Kedaluwarsa", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const qrispy = qrispyKedaluwarsa1015();
    const varianId = await netflixSatuBulan();
    const dipesan = await checkout(varianId, qrispy);
    qrispy.cekStatusQris.mockRejectedValueOnce(
      new Error("Qrispy menjawab 429"),
    );

    await prosesKedaluwarsaPesanan(dipesan.id, {
      qrispy,
      sekarang: pukul("10:15:00"),
    });

    expect(await statusPesanan(dipesan.id)).toBe("Kedaluwarsa");
    expect((await bacaStokVarian(varianId)).stokVarian).toBe(10);
  });

  // Webhook dan pembatalan bisa datang kapan saja, termasuk selagi Qrispy sedang ditanya.
  it("kabar pembayaran yang diproses selagi status QRIS ditanyakan tidak ditimpa Kedaluwarsa", async () => {
    const qrispy = qrispyKedaluwarsa1015();
    const dipesan = await checkout(await netflixSatuBulan(), qrispy);
    qrispy.cekStatusQris.mockImplementationOnce(async () => {
      await prosesKabarPembayaran(
        {
          qrisId: dipesan.qrisId,
          nominalDiterima: dipesan.totalBayar,
          waktuBayar: pukul("10:14:58"),
        },
        { sekarang: pukul("10:14:59") },
      );
      return { paymentStatus: "pending" };
    });

    await prosesKedaluwarsaPesanan(dipesan.id, {
      qrispy,
      sekarang: pukul("10:15:00"),
    });

    expect(await statusPesanan(dipesan.id)).toBe("Selesai");
    expect(await itemStokPesanan(dipesan.id)).toMatchObject([
      { status: "Terkirim" },
    ]);
    expect(await riwayatSesudahCheckout(dipesan.id)).toEqual([
      { waktu: pukul("10:14:59"), status: "Selesai", pelaku: "Qrispy" },
    ]);
  });

  it("pekerjaan untuk Pesanan yang sudah Dibatalkan tidak mengubah status atau Item stoknya", async () => {
    const qrispy = qrispyKedaluwarsa1015();
    const varianId = await netflixSatuBulan();
    const dipesan = await checkout(varianId, qrispy);
    const [ditahan] = await itemStokPesanan(dipesan.id);
    expect(
      await batalkanPesanan(dipesan.tautan, {
        qrispy,
        sekarang: pukul("10:05:00"),
      }),
    ).toEqual({ hasil: "dibatalkan" });
    const itemStokSesudahBatal = await db
      .select()
      .from(itemStok)
      .where(eq(itemStok.id, ditahan.id));
    const riwayatSesudahBatal = await riwayatSesudahCheckout(dipesan.id);

    await prosesKedaluwarsaPesanan(dipesan.id, {
      qrispy,
      sekarang: pukul("10:15:00"),
    });

    expect(await statusPesanan(dipesan.id)).toBe("Dibatalkan");
    expect(
      await db.select().from(itemStok).where(eq(itemStok.id, ditahan.id)),
    ).toEqual(itemStokSesudahBatal);
    expect(itemStokSesudahBatal).toMatchObject([
      { status: "Tersedia", pesananId: null },
    ]);
    expect((await bacaStokVarian(varianId)).stokVarian).toBe(10);
    expect(await riwayatSesudahCheckout(dipesan.id)).toEqual(
      riwayatSesudahBatal,
    );
    expect(qrispy.cekStatusQris).not.toHaveBeenCalled();
  });

  // Issue T21: pekerjaan untuk Pesanan yang sudah tidak Menunggu Pembayaran tidak mengubah apa pun. Status
  // yang tidak boleh berpindah ke Kedaluwarsa diambil dari tests/golden/transisi-status-pesanan.json.
  for (const status of STATUS_TIDAK_BISA_KEDALUWARSA) {
    it(`pekerjaan untuk Pesanan ${status} tidak mengubah apa pun`, async () => {
      const qrispy = qrispyKedaluwarsa1015();
      const { id } = await sisipkanPesanan({
        varianId: await netflixSatuBulan(),
        status,
      });

      await prosesKedaluwarsaPesanan(id, {
        qrispy,
        sekarang: new Date(Date.now() + 20 * 60 * 1000),
      });

      expect(await statusPesanan(id)).toBe(status);
      expect(await riwayatSesudahCheckout(id)).toEqual([]);
      expect(qrispy.cekStatusQris).not.toHaveBeenCalled();
    });
  }
});
