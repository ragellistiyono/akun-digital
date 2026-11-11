// Bahan bersama untuk test yang menyiapkan Pesanan langsung di database. Berkas ini hanya diimpor oleh
// test integrasi dan test e2e.
import { randomBytes, randomUUID } from "node:crypto";

import type { StatusItemStok } from "@/domain/item-stok";
import { nomorPesanan } from "@/domain/nomor-pesanan";
import type { StatusPesanan } from "@/domain/status-pesanan";

import { db } from "./db";
import { itemStok, pesanan } from "./db/schema";
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
 * Rp 123, dan Total bayar Rp 45.123. Hasilnya id, Tautan Pesanan, dan Nomor Pesanan-nya.
 */
export async function sisipkanPesanan({
  varianId,
  status,
  itemStok: item,
}: {
  varianId: string;
  status: StatusPesanan;
  itemStok?: ItemStokPesananUji;
}) {
  const tautan = randomBytes(32).toString("base64url");
  const nomor = nomorPesanan(randomBytes(6));
  const [{ id }] = await db
    .insert(pesanan)
    .values({
      nomorPesanan: nomor,
      tautan,
      email: `budi-${randomUUID()}@example.test`,
      varianId,
      hargaJual: 50000,
      potonganVoucher: 5000,
      kodeUnik: 123,
      totalBayar: 45123,
      qrisId: randomUUID(),
      kedaluwarsaPada: new Date(Date.now() + 15 * 60 * 1000),
      gambarQr: "data:image/png;base64,iVBORw0KGgo=",
      status,
    })
    .returning({ id: pesanan.id });
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
