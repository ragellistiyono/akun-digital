// Admin menyelesaikan Pesanan Bermasalah (PRD §5.7, §5.9). Akibat setiap cara penyelesaian ditentukan
// hasilPenyelesaianBermasalah di src/domain/penyelesaian-bermasalah.ts; perpindahan status yang boleh ada di
// src/domain/status-pesanan.ts.
import { and, eq } from "drizzle-orm";

import {
  hasilPenyelesaianBermasalah,
  type CaraPenyelesaian,
} from "@/domain/penyelesaian-bermasalah";
import type { StatusPesanan } from "@/domain/status-pesanan";

import { db } from "./db";
import {
  itemStok,
  pesanan,
  produk,
  riwayatStatusPesanan,
  varian,
} from "./db/schema";
import { bacaStokVarian } from "./item-stok";
import { jadwalkanEmailPesananSelesai } from "./pekerjaan-latar";

/** Pelaku perubahan status oleh Admin di Riwayat status Pesanan. Semua Admin punya hak yang sama (PRD §2.1). */
const PELAKU_ADMIN = "Admin";

type HasilSelesaikanBermasalah =
  | { hasil: "diselesaikan" }
  | { hasil: "tidak-ada" }
  | { hasil: "tidak-tersedia"; status: StatusPesanan }
  | { hasil: "stok-habis" };

/**
 * Admin menyelesaikan Pesanan itu dengan Kirim Item stok atau Tandai Dana Dikembalikan (PRD §5.9), dalam
 * satu transaksi database.
 *
 * - Baris Pesanan dikunci lebih dulu, seperti di prosesKabarPembayaran, sehingga klik ganda, dua Admin yang
 *   menekan bersamaan, dan kabar pembayaran yang datang bersamaan diproses satu per satu. Permintaan yang
 *   datang sesudahnya melihat status barunya, jadi satu Pesanan hanya pernah mendapat satu Item stok.
 * - Kirim Item stok mengambil satu Item stok Tersedia dari Varian Pesanan itu. Item stok yang sedang dikunci
 *   transaksi lain, misalnya checkout yang menahannya, dilewati; bila semuanya sedang dikunci, Stok Varian
 *   yang bisa diambil Pesanan ini 0. Item stok itu menjadi Terkirim, mencatat Pesanan penerimanya, dan
 *   mencatat nama kolom Format Item stok yang berlaku saat itu (PRD §4.1).
 * - Pesanan yang menjadi Selesai mendapat satu pekerjaan email "Pesanan selesai" (PRD §6.3, T23), yang ikut
 *   tersimpan bersama transaksi ini.
 * - Waktu bayar Pesanan tidak berubah, karena Pendapatan-nya dihitung pada tanggal pembayarannya (PRD §9.3).
 * - Riwayat status Pesanan mendapat satu baris baru dengan Admin sebagai pelakunya.
 *
 * Waktu "sekarang" untuk Riwayat status bisa diganti untuk test.
 */
export async function selesaikanPesananBermasalah(
  { pesananId, cara }: { pesananId: string; cara: CaraPenyelesaian },
  { sekarang = new Date() }: { sekarang?: Date } = {},
): Promise<HasilSelesaikanBermasalah> {
  return db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({
        status: pesanan.status,
        varianId: pesanan.varianId,
        formatItemStok: produk.formatItemStok,
      })
      .from(pesanan)
      .innerJoin(varian, eq(pesanan.varianId, varian.id))
      .innerJoin(produk, eq(varian.produkId, produk.id))
      .where(eq(pesanan.id, pesananId))
      .for("update", { of: pesanan });
    if (!terkunci) return { hasil: "tidak-ada" };

    let hasil;
    // Item stok yang dikirim ke Pesanan ini, bila ada.
    let dikirim: string | undefined;
    if (cara === "kirim-item-stok") {
      const bahan = { statusPesanan: terkunci.status, cara };
      hasil = hasilPenyelesaianBermasalah({
        ...bahan,
        stokVarian: (await bacaStokVarian(terkunci.varianId, tx)).stokVarian,
      });
      if (hasil.hasil === "diselesaikan" && hasil.kirimItemStok) {
        const [tersedia] = await tx
          .select({ id: itemStok.id })
          .from(itemStok)
          .where(
            and(
              eq(itemStok.varianId, terkunci.varianId),
              eq(itemStok.status, "Tersedia"),
            ),
          )
          .limit(1)
          .for("update", { skipLocked: true });
        dikirim = tersedia?.id;
        if (!tersedia) {
          hasil = hasilPenyelesaianBermasalah({ ...bahan, stokVarian: 0 });
        }
      }
    } else {
      hasil = hasilPenyelesaianBermasalah({
        statusPesanan: terkunci.status,
        cara,
      });
    }

    switch (hasil.hasil) {
      case "tidak-tersedia":
        return { hasil: "tidak-tersedia", status: terkunci.status };
      case "stok-habis":
        return { hasil: "stok-habis" };
    }

    if (dikirim !== undefined) {
      await tx
        .update(itemStok)
        .set({
          status: "Terkirim",
          pesananId,
          formatSaatTerkirim: terkunci.formatItemStok,
        })
        .where(eq(itemStok.id, dikirim));
    }
    await tx
      .update(pesanan)
      .set({ status: hasil.statusBaru })
      .where(eq(pesanan.id, pesananId));
    await tx.insert(riwayatStatusPesanan).values({
      pesananId,
      waktu: sekarang,
      status: hasil.statusBaru,
      pelaku: PELAKU_ADMIN,
    });
    if (hasil.statusBaru === "Selesai") {
      await jadwalkanEmailPesananSelesai(pesananId, tx);
    }
    return { hasil: "diselesaikan" };
  });
}
