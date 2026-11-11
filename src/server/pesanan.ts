// Pesanan (PRD §5.1, §5.5, §6.2, §9.6) beserta QRIS-nya dari Qrispy (ADR-0004) dan Item stok yang
// ditahannya (PRD §5.3). Aturan Total bayar dan pemeriksaan nominal QRIS ada di
// src/domain/total-bayar.ts; bentuk Nomor Pesanan ada di src/domain/nomor-pesanan.ts; Stok Varian ada
// di src/domain/stok-varian.ts.
import { randomBytes } from "node:crypto";

import { and, DrizzleQueryError, eq } from "drizzle-orm";
import postgres from "postgres";

import { nomorPesanan } from "@/domain/nomor-pesanan";
import { varianHabis } from "@/domain/stok-varian";
import { nominalTagihanQris, periksaTagihanQris } from "@/domain/total-bayar";

import { db } from "./db";
import {
  itemStok,
  pesanan,
  produk,
  riwayatStatusPesanan,
  varian,
} from "./db/schema";
import { bacaStokVarian } from "./item-stok";
import { qrispyAktif, type QrisBaru, type Qrispy } from "./qrispy";

/** Voucher baru ada di M2 (PRD §13), jadi potongan voucher setiap Pesanan saat ini Rp 0. */
const POTONGAN_VOUCHER_TANPA_VOUCHER = 0;

/** Berapa kali Nomor Pesanan dibuat ulang bila nomornya sudah dipakai Pesanan lain. */
const BATAS_PERCOBAAN_NOMOR = 5;

const nomorPesananAcak = () => nomorPesanan(randomBytes(6));

/** Tautan Pesanan (PRD §6.2): 32 byte acak (256 bit) dalam base64url, sehingga tidak bisa ditebak. */
const tautanPesananAcak = () => randomBytes(32).toString("base64url");

/** Apakah penulisan ditolak indeks unik Nomor Pesanan, karena nomor acaknya sudah dipakai Pesanan lain. */
const nomorSudahDipakai = (galat: unknown) =>
  galat instanceof DrizzleQueryError &&
  galat.cause instanceof postgres.PostgresError &&
  galat.cause.code === "23505" &&
  galat.cause.constraint_name === "pesanan_nomor_pesanan_unik";

/**
 * Membatalkan QRIS yang tidak jadi dipakai. Bila pembatalannya gagal, checkout tetap gagal seperti
 * semula; QRIS itu tidak tertaut ke Pesanan mana pun dan kedaluwarsa sendiri setelah 15 menit.
 */
async function batalkanQrisTakTerpakai(qrispy: Qrispy, qris: QrisBaru) {
  try {
    await qrispy.batalkanQris(qris.qrisId);
  } catch (galat) {
    console.error(
      `QRIS ${qris.qrisId} tidak jadi dipakai, tetapi pembatalannya di Qrispy gagal. QRIS itu tidak tertaut ke Pesanan mana pun.`,
      galat,
    );
  }
}

/** Varian yang bisa dibeli, yaitu Varian aktif dari Produk aktif (PRD §3.7), atau undefined. */
async function varianDijual(varianId: string) {
  const [baris] = await db
    .select({
      namaProduk: produk.nama,
      namaVarian: varian.nama,
      hargaJual: varian.hargaJual,
    })
    .from(varian)
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .where(
      and(
        eq(varian.id, varianId),
        eq(varian.aktif, true),
        eq(produk.aktif, true),
      ),
    );
  return baris;
}

/**
 * Isi form checkout sebuah Varian (PRD §5.2): nama Produk dan Varian, Harga jual, dan Perkiraan bayar,
 * yaitu nominal yang akan dikirim ke Qrispy sebelum Qrispy menambahkan Kode unik (docs/DESIGN.md "Rincian
 * Total bayar"). Hasilnya null bila Varian itu tidak bisa dibeli (PRD §3.7).
 */
export async function bacaCheckout(varianId: string) {
  const dijual = await varianDijual(varianId);
  if (!dijual) return null;
  const { nominal } = nominalTagihanQris({
    hargaJual: dijual.hargaJual,
    potonganVoucher: POTONGAN_VOUCHER_TANPA_VOUCHER,
  });
  return { varianId, ...dijual, perkiraanBayar: nominal };
}

type HasilBuatPesanan =
  | { hasil: "dibuat"; tautan: string }
  | { hasil: "tidak-dijual" }
  | { hasil: "stok-habis" }
  | { hasil: "qris-gagal" };

const QRIS_GAGAL = { hasil: "qris-gagal" } as const;
const STOK_HABIS = { hasil: "stok-habis" } as const;

/**
 * Checkout satu Varian: membuat Pesanan Menunggu Pembayaran beserta QRIS-nya (PRD §5.1, ADR-0004).
 *
 * - Produk dan Varian-nya harus aktif (PRD §3.7). Bila tidak, tidak ada QRIS maupun Pesanan yang dibuat.
 * - Checkout ditolak karena stok habis bila Stok Varian-nya 0 (PRD §5.2), juga tanpa QRIS maupun Pesanan.
 * - Harga jual dan potongan voucher dicatat saat checkout. Kode unik, Total bayar, waktu kedaluwarsa, dan
 *   gambar QR diambil dari QRIS yang diterbitkan Qrispy, dengan Nomor Pesanan sebagai payment_reference.
 * - Bila Qrispy gagal, atau nominal QRIS-nya tidak cocok (periksaTagihanQris), QRIS itu dibatalkan dan
 *   tidak ada Pesanan yang tersisa.
 * - Pesanan, baris pertama Riwayat status Pesanan, dan Penahanan satu Item stok Tersedia dari Varian itu
 *   (PRD §5.3) ditulis dalam satu transaksi. Item stok Ditahan mencatat Pesanan yang menahannya.
 * - Bila Item stok terakhirnya sudah ditahan checkout lain setelah QRIS terbit, QRIS itu dibatalkan dan
 *   checkout ditolak karena stok habis, tanpa Pesanan.
 * - Bila Nomor Pesanan acaknya sudah dipakai Pesanan lain, QRIS-nya dibatalkan, lalu nomor dan QRIS
 *   dibuat ulang.
 *
 * Adaptor Qrispy dan pembuat Nomor Pesanan bisa diganti untuk test.
 */
export async function buatPesanan(
  { varianId, email }: { varianId: string; email: string },
  {
    qrispy = qrispyAktif(),
    buatNomorPesanan = nomorPesananAcak,
  }: { qrispy?: Qrispy; buatNomorPesanan?: () => string } = {},
): Promise<HasilBuatPesanan> {
  const dijual = await varianDijual(varianId);
  if (!dijual) return { hasil: "tidak-dijual" };
  if (varianHabis((await bacaStokVarian(varianId)).stokVarian)) {
    return STOK_HABIS;
  }

  const { hargaJual } = dijual;
  const potonganVoucher = POTONGAN_VOUCHER_TANPA_VOUCHER;
  const { nominal } = nominalTagihanQris({ hargaJual, potonganVoucher });

  for (let percobaan = 1; ; percobaan++) {
    const nomor = buatNomorPesanan();

    let qris: QrisBaru;
    try {
      qris = await qrispy.buatQris({
        amount: nominal,
        paymentReference: nomor,
      });
    } catch (galat) {
      console.error(`QRIS untuk Pesanan ${nomor} gagal dibuat.`, galat);
      return QRIS_GAGAL;
    }

    const tagihan = periksaTagihanQris({
      hargaJual,
      potonganVoucher,
      requestedAmount: qris.requestedAmount,
      uniqueId: qris.uniqueId,
      amount: qris.amount,
    });
    if (!tagihan.cocok) {
      console.error(
        `QRIS ${qris.qrisId} untuk Pesanan ${nomor} ditolak: ${tagihan.alasan}.`,
      );
      await batalkanQrisTakTerpakai(qrispy, qris);
      return QRIS_GAGAL;
    }

    const tautan = tautanPesananAcak();
    try {
      const ditahan = await db.transaction(async (tx) => {
        // Penahanan Item stok (PRD §5.3). Item stok yang sedang dikunci checkout lain dilewati, supaya
        // dua checkout bersamaan tidak pernah menahan Item stok yang sama.
        const [tersedia] = await tx
          .select({ id: itemStok.id })
          .from(itemStok)
          .where(
            and(
              eq(itemStok.varianId, varianId),
              eq(itemStok.status, "Tersedia"),
            ),
          )
          .limit(1)
          .for("update", { skipLocked: true });
        if (!tersedia) return false;

        const [{ id }] = await tx
          .insert(pesanan)
          .values({
            nomorPesanan: nomor,
            tautan,
            email,
            varianId,
            hargaJual,
            potonganVoucher,
            kodeUnik: tagihan.rincian.kodeUnik,
            totalBayar: tagihan.rincian.totalBayar,
            qrisId: qris.qrisId,
            kedaluwarsaPada: qris.expiredAt,
            gambarQr: qris.gambarQr,
            status: "Menunggu Pembayaran",
          })
          .returning({ id: pesanan.id });
        await tx.insert(riwayatStatusPesanan).values({
          pesananId: id,
          waktu: new Date(),
          status: "Menunggu Pembayaran",
          pelaku: "Pembeli",
        });
        await tx
          .update(itemStok)
          .set({ status: "Ditahan", pesananId: id })
          .where(eq(itemStok.id, tersedia.id));
        return true;
      });
      if (!ditahan) {
        await batalkanQrisTakTerpakai(qrispy, qris);
        return STOK_HABIS;
      }
      return { hasil: "dibuat", tautan };
    } catch (galat) {
      await batalkanQrisTakTerpakai(qrispy, qris);
      if (nomorSudahDipakai(galat) && percobaan < BATAS_PERCOBAAN_NOMOR) {
        continue;
      }
      throw galat;
    }
  }
}

/**
 * Pesanan yang dibuka lewat Tautan Pesanan (PRD §6.2), untuk Halaman bayar: Nomor Pesanan, status, nama
 * Produk dan Varian, gambar QR, dan rincian nominal yang dicatat di Pesanan (PRD §5.5). Hasilnya null
 * bila tidak ada Pesanan dengan Tautan Pesanan itu.
 */
export async function bacaPesananLewatTautan(tautan: string) {
  const [baris] = await db
    .select({
      nomorPesanan: pesanan.nomorPesanan,
      status: pesanan.status,
      namaProduk: produk.nama,
      namaVarian: varian.nama,
      gambarQr: pesanan.gambarQr,
      hargaJual: pesanan.hargaJual,
      potonganVoucher: pesanan.potonganVoucher,
      kodeUnik: pesanan.kodeUnik,
      totalBayar: pesanan.totalBayar,
    })
    .from(pesanan)
    .innerJoin(varian, eq(pesanan.varianId, varian.id))
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .where(eq(pesanan.tautan, tautan));
  if (!baris) return null;

  const { hargaJual, potonganVoucher, kodeUnik, totalBayar, ...lainnya } =
    baris;
  return {
    ...lainnya,
    rincian: { hargaJual, potonganVoucher, kodeUnik, totalBayar },
  };
}
