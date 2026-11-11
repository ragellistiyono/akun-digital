// Kabar pembayaran dari Qrispy (PRD §5.7, §5.9, ADR-0004). Semua jalur kabar pembayaran memanggil satu
// pemroses yang sama. Status baru Pesanan dan perubahan Item stok-nya ditentukan hasilKabarPembayaran di
// src/domain/kabar-pembayaran.ts; perpindahan status yang boleh ada di src/domain/status-pesanan.ts.
import { and, eq } from "drizzle-orm";

import { hasilKabarPembayaran } from "@/domain/kabar-pembayaran";
import { perpindahanStatusPesanan } from "@/domain/status-pesanan";

import { db } from "./db";
import {
  itemStok,
  pesanan,
  produk,
  riwayatStatusPesanan,
  varian,
} from "./db/schema";
import { bacaStokVarian } from "./item-stok";
import { qrispyAktif, type Qrispy, type StatusQris } from "./qrispy";

/** Pelaku perubahan status karena kabar pembayaran di Riwayat status Pesanan. */
const PELAKU_KABAR_PEMBAYARAN = "Qrispy";

/** Jeda terpendek antara dua cek status ke Qrispy untuk Pesanan yang sama (ADR-0004). */
const JEDA_CEK_STATUS_MS = 15_000;

/** Kabar bahwa QRIS sebuah Pesanan sudah dibayar. */
type KabarPembayaran = {
  qrisId: string;
  /** Nominal yang diterima Qrispy (`amount`), yang dibandingkan dengan Total bayar (PRD §5.9). */
  nominalDiterima: number;
  waktuBayar: Date;
};

type HasilProsesKabar =
  | { hasil: "qris-tidak-dikenal" }
  | { hasil: "tidak-berubah" }
  | { hasil: "diproses" };

/**
 * Memproses satu kabar pembayaran dalam satu transaksi database (PRD §5.7, §5.9, ADR-0004).
 *
 * - Pesanan dikenali dari qris_id, lalu barisnya dikunci, sehingga kabar yang sama yang datang
 *   bersamaan diproses satu per satu.
 * - Status baru dan perubahan Item stok ditentukan hasilKabarPembayaran. Kabar berulang untuk Pesanan
 *   yang sudah diproses tidak mengubah apa pun, jadi satu Pesanan hanya pernah mendapat satu Item stok.
 * - Item stok yang dikirim menjadi Terkirim, mencatat Pesanan penerimanya, dan mencatat nama kolom
 *   Format Item stok yang berlaku saat itu (PRD §4.1).
 * - Item stok yang dilepas kembali Tersedia tanpa Pesanan, supaya bisa ditahan Pesanan lain.
 * - Pesanan mencatat waktu bayar, dan Riwayat status Pesanan mendapat satu baris baru.
 *
 * Waktu "sekarang" untuk Riwayat status bisa diganti untuk test.
 */
export async function prosesKabarPembayaran(
  { qrisId, nominalDiterima, waktuBayar }: KabarPembayaran,
  { sekarang = new Date() }: { sekarang?: Date } = {},
): Promise<HasilProsesKabar> {
  return db.transaction(async (tx) => {
    const [dibayar] = await tx
      .select({
        id: pesanan.id,
        status: pesanan.status,
        totalBayar: pesanan.totalBayar,
        varianId: pesanan.varianId,
        formatItemStok: produk.formatItemStok,
      })
      .from(pesanan)
      .innerJoin(varian, eq(pesanan.varianId, varian.id))
      .innerJoin(produk, eq(varian.produkId, produk.id))
      .where(eq(pesanan.qrisId, qrisId))
      .for("update", { of: pesanan });
    if (!dibayar) {
      console.error(
        `Kabar pembayaran untuk QRIS ${qrisId} diabaikan, karena tidak ada Pesanan dengan QRIS itu.`,
      );
      return { hasil: "qris-tidak-dikenal" };
    }

    const [ditahan] = await tx
      .select({ id: itemStok.id })
      .from(itemStok)
      .where(
        and(eq(itemStok.pesananId, dibayar.id), eq(itemStok.status, "Ditahan")),
      );
    const bahan = {
      statusPesanan: dibayar.status,
      totalBayar: dibayar.totalBayar,
      nominalDiterima,
      punyaItemStokDitahan: ditahan !== undefined,
    };
    let hasil = hasilKabarPembayaran({
      ...bahan,
      stokVarian: (await bacaStokVarian(dibayar.varianId, tx)).stokVarian,
    });

    // Item stok yang dikirim ke Pesanan ini, bila ada.
    let dikirim: string | undefined;
    if (hasil.itemStok === "ditahan") dikirim = ditahan?.id;
    if (hasil.itemStok === "baru") {
      // Item stok yang sedang dikunci checkout lain dilewati. Bila semuanya sedang dikunci, Stok
      // Varian yang bisa diambil Pesanan ini 0.
      const [tersedia] = await tx
        .select({ id: itemStok.id })
        .from(itemStok)
        .where(
          and(
            eq(itemStok.varianId, dibayar.varianId),
            eq(itemStok.status, "Tersedia"),
          ),
        )
        .limit(1)
        .for("update", { skipLocked: true });
      dikirim = tersedia?.id;
      if (!tersedia) hasil = hasilKabarPembayaran({ ...bahan, stokVarian: 0 });
    }

    if (hasil.statusBaru === dibayar.status) return { hasil: "tidak-berubah" };
    if (
      !perpindahanStatusPesanan({ dari: dibayar.status, ke: hasil.statusBaru })
        .boleh
    ) {
      throw new Error(
        `Kabar pembayaran untuk QRIS ${qrisId} akan memindahkan Pesanan dari ${dibayar.status} ke ${hasil.statusBaru}, padahal perpindahan itu tidak boleh (PRD §5.7). Pesanan tidak diubah.`,
      );
    }

    if (dikirim !== undefined) {
      await tx
        .update(itemStok)
        .set({
          status: "Terkirim",
          pesananId: dibayar.id,
          formatSaatTerkirim: dibayar.formatItemStok,
        })
        .where(eq(itemStok.id, dikirim));
    }
    if (hasil.itemStok === "lepas" && ditahan) {
      await tx
        .update(itemStok)
        .set({ status: "Tersedia", pesananId: null })
        .where(eq(itemStok.id, ditahan.id));
    }
    await tx
      .update(pesanan)
      .set({ status: hasil.statusBaru, waktuBayar })
      .where(eq(pesanan.id, dibayar.id));
    await tx.insert(riwayatStatusPesanan).values({
      pesananId: dibayar.id,
      waktu: sekarang,
      status: hasil.statusBaru,
      pelaku: PELAKU_KABAR_PEMBAYARAN,
    });
    return { hasil: "diproses" };
  });
}

// Waktu cek status terakhir ke Qrispy, menurut id Pesanan. Disimpan di globalThis, karena Next.js bisa
// memuat modul ini lebih dari sekali dalam satu proses server, padahal semua yang memicu cek status harus
// melihat batas yang sama. Toko berjalan sebagai satu proses di satu VPS (PRD §12).
const wadah = globalThis as typeof globalThis & {
  __cekStatusQrispyTerakhir?: Map<string, number>;
};
const cekTerakhir = (wadah.__cekStatusQrispyTerakhir ??= new Map());

/**
 * Apakah Pesanan itu sudah boleh ditanyakan lagi ke Qrispy pada waktu itu. Bila boleh, waktu itu langsung
 * dicatat sebagai cek terakhir, sebelum Qrispy ditanya, sehingga permintaan yang datang bersamaan
 * menunggu giliran berikutnya. Catatan yang sudah lewat 15 detik dibuang.
 */
function ambilGiliranCek(pesananId: string, sekarang: Date) {
  const kini = sekarang.getTime();
  for (const [id, waktu] of cekTerakhir) {
    if (kini - waktu >= JEDA_CEK_STATUS_MS) cekTerakhir.delete(id);
  }
  if (cekTerakhir.has(pesananId)) return false;
  cekTerakhir.set(pesananId, kini);
  return true;
}

/**
 * Jalur cek status (ADR-0004): menanyakan status QRIS sebuah Pesanan Menunggu Pembayaran ke Qrispy lewat
 * adaptor, paling sering sekali per 15 detik untuk setiap Pesanan, lalu meneruskan status `paid` ke
 * prosesKabarPembayaran dengan `amount` sebagai nominal diterima. Dipicu saat halaman di Tautan Pesanan
 * dimuat.
 *
 * Kegagalan menanyakan status, misalnya Qrispy menjawab 429, hanya dicatat di log; Pesanan tidak berubah,
 * dan cek berikutnya menunggu giliran 15 detik berikutnya. Adaptor Qrispy dan waktu "sekarang" bisa
 * diganti untuk test.
 */
export async function cekStatusPembayaran(
  tautan: string,
  { qrispy, sekarang = new Date() }: { qrispy?: Qrispy; sekarang?: Date } = {},
) {
  const [menunggu] = await db
    .select({ id: pesanan.id, qrisId: pesanan.qrisId })
    .from(pesanan)
    .where(
      and(
        eq(pesanan.tautan, tautan),
        eq(pesanan.status, "Menunggu Pembayaran"),
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
  if (status.paymentStatus !== "paid") return;

  await prosesKabarPembayaran(
    {
      qrisId: menunggu.qrisId,
      nominalDiterima: status.amount,
      waktuBayar: status.paidAt,
    },
    { sekarang },
  );
}
