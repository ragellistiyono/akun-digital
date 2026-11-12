// Bahan bersama untuk test yang menyiapkan Pesanan langsung di database. Berkas ini hanya diimpor oleh
// test integrasi dan test e2e.
import { randomBytes, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { StatusItemStok } from "@/domain/item-stok";
import { nomorPesanan } from "@/domain/nomor-pesanan";
import type { StatusPesanan } from "@/domain/status-pesanan";

import { db } from "./db";
import { itemStok, pesanan, riwayatStatusPesanan } from "./db/schema";
import { isiItemStokUji } from "./uji-katalog";

/** Item stok uji yang tertaut ke Pesanan itu, beserta nama kolom yang dicatat saat Terkirim. */
type ItemStokPesananUji = {
  status: StatusItemStok;
  nilai: string[];
  formatSaatTerkirim?: string[];
};

/**
 * Menyisipkan Pesanan sebuah Varian dengan status itu, dan bila diminta satu Item stok yang tertaut ke
 * Pesanan itu. Rinciannya contoh PRD §5.5: Harga jual Rp 50.000, potongan voucher Rp 5.000, Kode unik
 * Rp 123, dan Total bayar Rp 45.123. Waktu kedaluwarsanya 15 menit lagi, serta email dan Nomor Pesanan-nya
 * acak, kecuali diatur lain. Bila `dibuatPada` diberikan, baris pertama Riwayat status Pesanan ikut ditulis
 * seperti saat checkout, yaitu Menunggu Pembayaran oleh Pembeli pada waktu itu. Hasilnya id, Tautan Pesanan,
 * dan Nomor Pesanan-nya.
 */
export async function sisipkanPesanan({
  varianId,
  status,
  itemStok: item,
  kedaluwarsaPada = new Date(Date.now() + 15 * 60 * 1000),
  email = `budi-${randomUUID()}@example.test`,
  nomorPesanan: nomor = nomorPesanan(randomBytes(6)),
  dibuatPada,
  emailGagal = false,
}: {
  varianId: string;
  status: StatusPesanan;
  itemStok?: ItemStokPesananUji;
  kedaluwarsaPada?: Date;
  email?: string;
  nomorPesanan?: string;
  dibuatPada?: Date;
  emailGagal?: boolean;
}) {
  const tautan = randomBytes(32).toString("base64url");
  const [{ id }] = await db
    .insert(pesanan)
    .values({
      nomorPesanan: nomor,
      tautan,
      email,
      varianId,
      hargaJual: 50000,
      potonganVoucher: 5000,
      kodeUnik: 123,
      totalBayar: 45123,
      qrisId: randomUUID(),
      kedaluwarsaPada,
      gambarQr: "data:image/png;base64,iVBORw0KGgo=",
      status,
      emailGagal,
    })
    .returning({ id: pesanan.id });
  if (dibuatPada) {
    await db.insert(riwayatStatusPesanan).values({
      pesananId: id,
      waktu: dibuatPada,
      status: "Menunggu Pembayaran",
      pelaku: "Pembeli",
    });
  }
  if (item) {
    await db.insert(itemStok).values({
      varianId,
      status: item.status,
      pesananId: id,
      formatSaatTerkirim: item.formatSaatTerkirim ?? null,
      ...isiItemStokUji(item.nilai),
    });
  }
  return { id, tautan, nomorPesanan: nomor };
}

/** Apakah janji itu selesai dalam `ms` milidetik. */
export async function selesaiDalam(janji: Promise<unknown>, ms: number) {
  return Promise.race([
    janji.then(() => true),
    new Promise<false>((selesai) => setTimeout(() => selesai(false), ms)),
  ]);
}

/**
 * Transaksi yang meniru checkout (buatPesanan di pesanan.ts) dengan urutan kunci yang sama: mengunci satu Item
 * stok Tersedia FOR UPDATE SKIP LOCKED, menyimpan Pesanan Menunggu Pembayaran, lalu menahan Item stok itu.
 * Transaksinya berhenti sebelum selesai sampai `lanjutkan` dipanggil, supaya test bisa menjalankan perubahan
 * lain di tengah checkout, misalnya menghapus Produk atau Varian-nya.
 */
export function checkoutTertahan(varianId: string) {
  let menahan = () => {};
  let lanjutkan = () => {};
  const sudahMenahan = new Promise<void>((r) => (menahan = r));
  const izinLanjut = new Promise<void>((r) => (lanjutkan = r));
  const selesai = db.transaction(async (tx) => {
    const [tersedia] = await tx
      .select({ id: itemStok.id })
      .from(itemStok)
      .where(
        and(eq(itemStok.varianId, varianId), eq(itemStok.status, "Tersedia")),
      )
      .limit(1)
      .for("update", { skipLocked: true });
    const [{ id }] = await tx
      .insert(pesanan)
      .values({
        nomorPesanan: nomorPesanan(randomBytes(6)),
        tautan: randomBytes(32).toString("base64url"),
        email: `budi-${randomUUID()}@example.test`,
        varianId,
        hargaJual: 50000,
        potonganVoucher: 0,
        kodeUnik: 123,
        totalBayar: 50123,
        qrisId: randomUUID(),
        kedaluwarsaPada: new Date(Date.now() + 15 * 60 * 1000),
        gambarQr: "data:image/png;base64,iVBORw0KGgo=",
        status: "Menunggu Pembayaran",
      })
      .returning({ id: pesanan.id });
    await tx
      .update(itemStok)
      .set({ status: "Ditahan", pesananId: id })
      .where(eq(itemStok.id, tersedia.id));
    menahan();
    await izinLanjut;
  });
  return { sudahMenahan, lanjutkan, selesai };
}
