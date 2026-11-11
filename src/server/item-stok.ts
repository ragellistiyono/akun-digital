// Mengisi Item stok sebuah Varian dan menghitung Stok Varian (PRD §4.2, §5.3). Aturannya ada di
// src/domain/item-stok.ts dan src/domain/stok-varian.ts. Isinya disimpan terenkripsi (PRD §12) lewat
// enkripsi-item-stok.ts.
import { and, count, eq } from "drizzle-orm";

import {
  periksaItemStok,
  tempelItemStok,
  type MasalahItemStok,
} from "@/domain/item-stok";
import { stokVarian } from "@/domain/stok-varian";

import { db } from "./db";
import { itemStok, produk, varian } from "./db/schema";
import {
  bacaKunciItemStok,
  enkripsiItemStok,
  sidikJariItemStok,
} from "./enkripsi-item-stok";

type KunciItemStok = Extract<
  ReturnType<typeof bacaKunciItemStok>,
  { hasil: "ada" }
>["kunci"];

type Pemeriksa<H> = (
  kolom: string[],
  sudahAda: (nilai: readonly string[]) => boolean,
) => { simpan: string[][]; hasil: H };

// Item stok disimpan dalam kelompok, supaya tempelan yang sangat panjang tidak melewati batas jumlah
// parameter satu perintah PostgreSQL.
const UKURAN_KELOMPOK = 1_000;

/**
 * Memeriksa Item stok baru untuk sebuah Varian milik Produk itu, lalu menyimpan yang diterima dengan
 * status Tersedia. Hasilnya null bila Varian tidak ada atau milik Produk lain.
 *
 * Baris Varian dan Produknya dikunci selama pemeriksaan dan penyimpanan, supaya dua Admin yang mengisi
 * Varian yang sama bersamaan tetap tidak menyimpan Item stok yang sama persis. Item stok yang sudah ada
 * dikenali dari sidik jarinya, jadi isinya tidak perlu dibuka.
 */
async function isiVarian<H>(
  kunci: KunciItemStok,
  { produkId, varianId }: { produkId: string; varianId: string },
  periksa: Pemeriksa<H>,
): Promise<H | null> {
  return db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({ formatItemStok: produk.formatItemStok })
      .from(varian)
      .innerJoin(produk, eq(varian.produkId, produk.id))
      .where(and(eq(varian.id, varianId), eq(varian.produkId, produkId)))
      .for("update");
    if (!terkunci) return null;

    const sidikJariAda = new Set(
      (
        await tx
          .select({ sidikJari: itemStok.sidikJari })
          .from(itemStok)
          .where(eq(itemStok.varianId, varianId))
      ).map((baris) => baris.sidikJari),
    );
    const { simpan, hasil } = periksa(terkunci.formatItemStok, (nilai) =>
      sidikJariAda.has(sidikJariItemStok(kunci, nilai)),
    );

    for (let mulai = 0; mulai < simpan.length; mulai += UKURAN_KELOMPOK) {
      await tx.insert(itemStok).values(
        simpan.slice(mulai, mulai + UKURAN_KELOMPOK).map((nilai) => ({
          varianId,
          isiTerenkripsi: enkripsiItemStok(kunci, nilai),
          sidikJari: sidikJariItemStok(kunci, nilai),
        })),
      );
    }
    return hasil;
  });
}

/**
 * Menyimpan satu Item stok dari form, berupa isi kolom-kolomnya menurut urutan Format Item stok.
 * Tanpa ITEM_STOK_KEY yang sah, tidak ada yang disimpan.
 */
export async function tambahItemStok({
  nilai,
  ...varianDipilih
}: {
  produkId: string;
  varianId: string;
  nilai: string[];
}) {
  const kunci = bacaKunciItemStok();
  if (kunci.hasil !== "ada") {
    return { hasil: "kunci-bermasalah", masalah: kunci.hasil } as const;
  }

  const hasil = await isiVarian<
    | { hasil: "disimpan" }
    | { hasil: "ditolak"; kolom: string[]; masalah: MasalahItemStok }
  >(kunci.kunci, varianDipilih, (kolom, sudahAda) => {
    const periksa = periksaItemStok({ kolom, nilai, sudahAda });
    if (periksa.sah) {
      return { simpan: [periksa.nilai], hasil: { hasil: "disimpan" } };
    }
    return {
      simpan: [],
      hasil: { hasil: "ditolak", kolom, masalah: periksa.masalah },
    };
  });
  return hasil ?? ({ hasil: "varian-tidak-ada" } as const);
}

/**
 * Menyimpan Item stok dari teks tempelan, satu baris untuk satu Item stok (PRD §4.2). Baris yang
 * benar disimpan, dan hasilnya memuat ringkasan serta baris yang ditolak. Tanpa ITEM_STOK_KEY yang
 * sah, tidak ada yang disimpan.
 */
export async function tempelItemStokVarian({
  teks,
  ...varianDipilih
}: {
  produkId: string;
  varianId: string;
  teks: string;
}) {
  const kunci = bacaKunciItemStok();
  if (kunci.hasil !== "ada") {
    return { hasil: "kunci-bermasalah", masalah: kunci.hasil } as const;
  }

  const hasil = await isiVarian(
    kunci.kunci,
    varianDipilih,
    (kolom, sudahAda) => {
      const tempel = tempelItemStok({ kolom, teks, sudahAda });
      return {
        simpan: tempel.tersimpan,
        hasil: { hasil: "ditempel", kolom, tempel } as const,
      };
    },
  );
  return hasil ?? ({ hasil: "varian-tidak-ada" } as const);
}

/** Stok Varian sebuah Varian beserta jumlah Item stok per status sebagai bahan hitungnya (PRD §5.3). */
export async function bacaStokVarian(varianId: string) {
  const jumlahPerStatus = { Tersedia: 0, Ditahan: 0, Terkirim: 0 };
  const semua = await db
    .select({ status: itemStok.status, jumlah: count() })
    .from(itemStok)
    .where(eq(itemStok.varianId, varianId))
    .groupBy(itemStok.status);
  for (const { status, jumlah } of semua) jumlahPerStatus[status] = jumlah;
  return stokVarian({ jumlahPerStatus });
}
