import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { nomorPesanan } from "@/domain/nomor-pesanan";
import type { StatusPesanan } from "@/domain/status-pesanan";

import { db, koneksi } from "./db";
import { pesanan, varian } from "./db/schema";
import { sisipkanProduk } from "./uji-katalog";

// Test migrasi drizzle/0025_biaya_transaksi.sql (issue T68, PRD §14.3): Pesanan yang sudah dibayar sebelum
// fitur ini tayang dihitung sekali dengan nilai awal, yaitu persen 0,7 dan minimal Rp 100.000. Global setup
// sudah menjalankan migrasi itu ke app_test yang masih kosong, jadi perintah UPDATE-nya dijalankan lagi di sini
// terhadap Pesanan tanpa Biaya transaksi, seperti data lama saat migrasi berjalan. Semuanya terjadi dalam satu
// transaksi yang dibatalkan di akhir, supaya Pesanan milik test lain yang berjalan bersamaan tidak berubah.
afterAll(async () => {
  await koneksi.end();
});

const BERKAS_MIGRASI = path.join(
  process.cwd(),
  "drizzle",
  "0025_biaya_transaksi.sql",
);

/** Perintah UPDATE di berkas migrasi, yaitu pengisian Biaya transaksi Pesanan lama. */
async function perintahIsiPesananLama() {
  const isi = await readFile(BERKAS_MIGRASI, "utf8");
  return (
    isi
      .split("--> statement-breakpoint")
      // Baris komentar SQL dibuang, supaya yang tersisa perintahnya saja.
      .map((perintah) => perintah.replace(/^--.*$/gm, "").trim())
      .filter((perintah) => /^update\b/i.test(perintah))
  );
}

class Batalkan extends Error {}

describe("migrasi Biaya transaksi Pesanan lama (PRD §14.3)", () => {
  it("Pesanan yang sudah dibayar diisi dengan nilai awal: Total bayar Rp 135.499 menjadi Rp 949 dan Rp 50.010 menjadi Rp 0, sedangkan Pesanan yang belum dibayar tetap tanpa Biaya transaksi", async () => {
    // Uji Bayar [CONTOH].
    const produkId = await sisipkanProduk({
      nama: `Uji Bayar ${randomUUID().slice(0, 8)}`,
      varian: [{ nama: "Standar", hargaJual: 1000 }],
    });
    const [{ id: varianId }] = await db
      .select({ id: varian.id })
      .from(varian)
      .where(sql`${varian.produkId} = ${produkId}`);
    const perintah = await perintahIsiPesananLama();
    expect(perintah.length).toBeGreaterThan(0);

    const kasus: { status: StatusPesanan; totalBayar: number }[] = [
      { status: "Selesai", totalBayar: 135499 },
      { status: "Bermasalah", totalBayar: 50010 },
      { status: "Dana Dikembalikan", totalBayar: 135499 },
      { status: "Menunggu Pembayaran", totalBayar: 135499 },
      { status: "Kedaluwarsa", totalBayar: 135499 },
      { status: "Dibatalkan", totalBayar: 135499 },
    ];

    let hasil: { status: StatusPesanan; biayaTransaksi: number | null }[] = [];
    await expect(
      db.transaction(async (tx) => {
        const disisipkan = await tx
          .insert(pesanan)
          .values(
            kasus.map(({ status, totalBayar }) => ({
              nomorPesanan: nomorPesanan(randomBytes(6)),
              tautan: randomBytes(32).toString("base64url"),
              email: `budi-${randomUUID()}@example.test`,
              varianId,
              hargaJual: totalBayar - 123,
              potonganVoucher: 0,
              kodeUnik: 123,
              totalBayar,
              qrisId: randomUUID(),
              kedaluwarsaPada: new Date("2026-11-11T10:15:00+07:00"),
              gambarQr: "data:image/png;base64,iVBORw0KGgo=",
              status,
            })),
          )
          .returning({ id: pesanan.id });
        for (const satu of perintah) await tx.execute(sql.raw(satu));
        const ids = disisipkan.map(({ id }) => id);
        const baris = await tx
          .select({
            id: pesanan.id,
            status: pesanan.status,
            biayaTransaksi: pesanan.biayaTransaksi,
          })
          .from(pesanan)
          .where(inArray(pesanan.id, ids));
        hasil = ids.map((id) => {
          const { status, biayaTransaksi } = baris.find((b) => b.id === id)!;
          return { status, biayaTransaksi };
        });
        throw new Batalkan();
      }),
    ).rejects.toBeInstanceOf(Batalkan);

    expect(hasil).toEqual([
      { status: "Selesai", biayaTransaksi: 949 },
      { status: "Bermasalah", biayaTransaksi: 0 },
      { status: "Dana Dikembalikan", biayaTransaksi: 949 },
      { status: "Menunggu Pembayaran", biayaTransaksi: null },
      { status: "Kedaluwarsa", biayaTransaksi: null },
      { status: "Dibatalkan", biayaTransaksi: null },
    ]);
  });
});
