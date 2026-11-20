// Biaya operasional di database (PRD §14.4). Aturan isiannya diperiksa periksaIsianBiayaOperasional di
// src/domain/biaya-operasional.ts sebelum fungsi di sini dipanggil, dan totalnya dihitung totalBiayaOperasional.
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";

import { totalBiayaOperasional } from "@/domain/biaya-operasional";

import { db } from "./db";
import { biayaOperasional } from "./db/schema";

/** Isian Biaya operasional yang sudah diperiksa: tanggal WIB "YYYY-MM-DD", keterangan tanpa spasi tepi, nominal. */
export type IsianBiayaOperasional = {
  tanggal: string;
  keterangan: string;
  nominal: number;
};

const kolom = {
  id: biayaOperasional.id,
  tanggal: biayaOperasional.tanggal,
  keterangan: biayaOperasional.keterangan,
  nominal: biayaOperasional.nominal,
};

/** Mencatat satu Biaya operasional. Hasilnya id biaya itu. */
export async function tambahBiayaOperasional(isian: IsianBiayaOperasional) {
  const [baris] = await db
    .insert(biayaOperasional)
    .values(isian)
    .returning({ id: biayaOperasional.id });
  return baris;
}

/**
 * Biaya operasional bertanggal bulan "YYYY-MM" itu beserta totalnya (PRD §14.4). Urutannya menurut tanggal dengan
 * yang terbaru di atas; biaya bertanggal sama diurutkan dengan yang terakhir dicatat di atas.
 */
export async function daftarBiayaOperasional(bulan: string) {
  const awal = `${bulan}-01`;
  const biaya = await db
    .select(kolom)
    .from(biayaOperasional)
    .where(
      and(
        gte(biayaOperasional.tanggal, awal),
        lt(
          biayaOperasional.tanggal,
          sql`(${awal}::date + interval '1 month')::date`,
        ),
      ),
    )
    .orderBy(
      desc(biayaOperasional.tanggal),
      desc(biayaOperasional.dicatatPada),
    );
  return totalBiayaOperasional(biaya);
}

/** Bulan "YYYY-MM" dari Biaya operasional bertanggal paling awal, atau null bila belum ada biaya. */
export async function bulanPertamaBiayaOperasional() {
  const [baris] = await db
    .select({ tanggal: biayaOperasional.tanggal })
    .from(biayaOperasional)
    .orderBy(asc(biayaOperasional.tanggal))
    .limit(1);
  return baris ? baris.tanggal.slice(0, 7) : null;
}

/** Satu Biaya operasional, atau null bila tidak ada. */
export async function bacaBiayaOperasional(id: string) {
  const [baris] = await db
    .select(kolom)
    .from(biayaOperasional)
    .where(eq(biayaOperasional.id, id));
  return baris ?? null;
}

/** Mengganti tanggal, keterangan, dan nominal sebuah Biaya operasional. */
export async function ubahBiayaOperasional({
  id,
  ...isian
}: IsianBiayaOperasional & { id: string }): Promise<{
  hasil: "diubah" | "tidak-ada";
}> {
  const diubah = await db
    .update(biayaOperasional)
    .set(isian)
    .where(eq(biayaOperasional.id, id))
    .returning({ id: biayaOperasional.id });
  return { hasil: diubah.length > 0 ? "diubah" : "tidak-ada" };
}

/**
 * Menghapus sebuah Biaya operasional. Penegasannya dilakukan di tampilan sebelum fungsi ini dipanggil. Hasilnya
 * membawa tanggal biaya yang terhapus, supaya dasbor bisa kembali ke daftar bulannya.
 */
export async function hapusBiayaOperasional(
  id: string,
): Promise<{ hasil: "dihapus"; tanggal: string } | { hasil: "tidak-ada" }> {
  const [dihapus] = await db
    .delete(biayaOperasional)
    .where(eq(biayaOperasional.id, id))
    .returning({ tanggal: biayaOperasional.tanggal });
  return dihapus
    ? { hasil: "dihapus", tanggal: dihapus.tanggal }
    : { hasil: "tidak-ada" };
}
