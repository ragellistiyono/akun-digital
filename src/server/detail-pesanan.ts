// Detail Pesanan di dasbor admin (PRD §9.5) beserta aksinya: kirim ulang email "Pesanan selesai" dan koreksi
// email Pesanan (PRD §6.4). Kapan kirim ulang dan koreksi tersedia ditentukan kirimUlangEmailTersedia dan
// koreksiEmailTersedia di src/domain/kirim-ulang-email.ts.
import { asc, eq } from "drizzle-orm";

import {
  kirimUlangEmailTersedia,
  koreksiEmailTersedia,
} from "@/domain/kirim-ulang-email";
import type { StatusPesanan } from "@/domain/status-pesanan";

import { db } from "./db";
import { pesanan, produk, riwayatStatusPesanan, varian } from "./db/schema";
import { jadwalkanEmailPesananSelesai } from "./pekerjaan-latar";
import { bacaItemStokTerkirim } from "./pesanan";

/**
 * Detail Pesanan dengan Nomor Pesanan itu untuk dasbor admin (PRD §9.5): id, Nomor Pesanan, status, tanda
 * "Email gagal" (PRD §6.4), email, nama Produk dan Varian, rincian nominal yang dicatat di Pesanan
 * (PRD §5.5), kolom-kolom Item stok bila sudah Terkirim (null bila belum), dan riwayat perubahan status
 * (waktu, status, dan pelakunya) dari yang paling lama. Hasilnya null bila tidak ada Pesanan dengan Nomor
 * Pesanan itu.
 */
export async function bacaDetailPesanan(nomorPesanan: string) {
  const [baris] = await db
    .select({
      id: pesanan.id,
      nomorPesanan: pesanan.nomorPesanan,
      status: pesanan.status,
      emailGagal: pesanan.emailGagal,
      email: pesanan.email,
      namaProduk: produk.nama,
      namaVarian: varian.nama,
      hargaJual: pesanan.hargaJual,
      potonganVoucher: pesanan.potonganVoucher,
      kodeUnik: pesanan.kodeUnik,
      totalBayar: pesanan.totalBayar,
    })
    .from(pesanan)
    .innerJoin(varian, eq(pesanan.varianId, varian.id))
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .where(eq(pesanan.nomorPesanan, nomorPesanan));
  if (!baris) return null;

  const riwayat = await db
    .select({
      waktu: riwayatStatusPesanan.waktu,
      status: riwayatStatusPesanan.status,
      pelaku: riwayatStatusPesanan.pelaku,
    })
    .from(riwayatStatusPesanan)
    .where(eq(riwayatStatusPesanan.pesananId, baris.id))
    .orderBy(asc(riwayatStatusPesanan.waktu), asc(riwayatStatusPesanan.id));

  const { hargaJual, potonganVoucher, kodeUnik, totalBayar, ...lainnya } =
    baris;
  return {
    ...lainnya,
    rincian: { hargaJual, potonganVoucher, kodeUnik, totalBayar },
    itemStok: await bacaItemStokTerkirim(baris.id),
    riwayat,
  };
}

type HasilKirimUlangEmail =
  | { hasil: "dijadwalkan"; email: string }
  | { hasil: "tidak-ada" }
  | { hasil: "tidak-tersedia"; status: StatusPesanan };

/**
 * Mengirim ulang email "Pesanan selesai" sebuah Pesanan ke email Pesanan-nya (PRD §6.4), lewat pekerjaan
 * latar yang sama dengan email pertamanya (T23): pekerja mengirimnya lewat adaptor email, mencobanya lagi
 * bila gagal, dan memasang tanda "Email gagal" bila semua percobaan gagal. Hasilnya email tujuannya.
 * Pesanan yang kirim ulangnya tidak tersedia menurut kirimUlangEmailTersedia, yaitu selain Selesai, tidak
 * dikirimi email.
 */
export async function kirimUlangEmailPesanan({
  pesananId,
}: {
  pesananId: string;
}): Promise<HasilKirimUlangEmail> {
  return db.transaction(async (tx) => {
    const [baris] = await tx
      .select({ status: pesanan.status, email: pesanan.email })
      .from(pesanan)
      .where(eq(pesanan.id, pesananId));
    if (!baris) return { hasil: "tidak-ada" };
    if (!kirimUlangEmailTersedia(baris.status)) {
      return { hasil: "tidak-tersedia", status: baris.status };
    }
    await jadwalkanEmailPesananSelesai(pesananId, tx);
    return { hasil: "dijadwalkan", email: baris.email };
  });
}

type HasilKoreksiEmail =
  | { hasil: "disimpan"; email: string; kirimUlang: boolean }
  | { hasil: "tidak-ada" }
  | { hasil: "tidak-tersedia"; status: StatusPesanan };

/**
 * Mengganti email sebuah Pesanan menjadi `emailBaru`, yaitu koreksi email (PRD §6.4, ▶ Keputusan
 * 2026-11-12). Pesanan itu ikut pindah ke email baru, karena Pesanan ditautkan ke Member lewat emailnya
 * (ADR-0003). Hasilnya email baru itu, dan apakah email "Pesanan selesai" ikut dikirim ulang.
 *
 * - Pesanan Selesai: email "Pesanan selesai" dijadwalkan ke email baru seperti kirimUlangEmailPesanan, dalam
 *   transaksi yang sama dengan penggantian emailnya.
 * - Pesanan Bermasalah: hanya email baru yang disimpan. Email "Pesanan selesai" dikirim ke email Pesanan saat
 *   itu begitu Pesanan menjadi Selesai lewat "Kirim Item stok" (PRD §5.9).
 * - Pesanan yang koreksinya tidak tersedia menurut koreksiEmailTersedia tidak diubah dan tidak dikirimi email.
 *
 * Baris Pesanan dikunci lebih dulu, seperti di selesaikanPesananBermasalah, sehingga koreksi dan "Kirim Item
 * stok" yang ditekan bersamaan diproses satu per satu. Koreksi yang datang sesudahnya melihat Pesanan yang
 * sudah Selesai dan ikut mengirim ulang, jadi email baru tidak pernah tertinggal tanpa email "Pesanan selesai".
 */
export async function koreksiEmailPesanan({
  pesananId,
  emailBaru,
}: {
  pesananId: string;
  emailBaru: string;
}): Promise<HasilKoreksiEmail> {
  return db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({ status: pesanan.status })
      .from(pesanan)
      .where(eq(pesanan.id, pesananId))
      .for("update");
    if (!terkunci) return { hasil: "tidak-ada" };
    if (!koreksiEmailTersedia(terkunci.status)) {
      return { hasil: "tidak-tersedia", status: terkunci.status };
    }
    await tx
      .update(pesanan)
      .set({ email: emailBaru })
      .where(eq(pesanan.id, pesananId));
    const kirimUlang = kirimUlangEmailTersedia(terkunci.status);
    if (kirimUlang) await jadwalkanEmailPesananSelesai(pesananId, tx);
    return { hasil: "disimpan", email: emailBaru, kirimUlang };
  });
}
