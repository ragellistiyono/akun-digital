// Bahan bersama untuk test yang menyiapkan Top up langsung di database. Berkas ini hanya diimpor oleh test integrasi
// dan test e2e.
import { randomBytes, randomUUID } from "node:crypto";

import { nomorTopUp } from "@/domain/nomor-top-up";
import type { StatusTopUp } from "@/domain/status-top-up";

import { db } from "./db";
import { riwayatStatusTopUp, topUp } from "./db/schema";

/**
 * Menyisipkan Top up milik Member itu dengan status, Nominal top up, Kode unik, Biaya transaksi, dan waktu bayar
 * itu. Total bayar = Nominal top up + Kode unik, dan nominal diterima sama dengan Total bayar bila sudah dibayar.
 * Baris pertama Riwayat status Top up ditulis seperti saat Top up dibuat, pada `dibuatPada` (awalnya sekarang), jadi
 * Top up ini tampil di atas daftar Top up. Hasilnya id dan Nomor Top up-nya.
 */
export async function sisipkanTopUp({
  userId,
  status,
  nominalTopUp = 50000,
  kodeUnik = 123,
  biayaTransaksi = null,
  waktuBayar = null,
  dibuatPada = new Date(),
}: {
  userId: string;
  status: StatusTopUp;
  nominalTopUp?: number;
  kodeUnik?: number;
  biayaTransaksi?: number | null;
  waktuBayar?: Date | null;
  dibuatPada?: Date;
}) {
  const nomor = nomorTopUp(randomBytes(6));
  const totalBayar = nominalTopUp + kodeUnik;
  const [{ id }] = await db
    .insert(topUp)
    .values({
      nomorTopUp: nomor,
      userId,
      nominalTopUp,
      kodeUnik,
      totalBayar,
      qrisId: randomUUID(),
      kedaluwarsaPada: new Date(dibuatPada.getTime() + 15 * 60 * 1000),
      gambarQr: "data:image/png;base64,iVBORw0KGgo=",
      status,
      waktuBayar,
      nominalDiterima: waktuBayar === null ? null : totalBayar,
      biayaTransaksi,
    })
    .returning({ id: topUp.id });
  await db.insert(riwayatStatusTopUp).values({
    topUpId: id,
    waktu: dibuatPada,
    status: "Menunggu Pembayaran",
    pelaku: "Member",
  });
  return { id, nomorTopUp: nomor };
}
