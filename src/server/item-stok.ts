// Mengisi Item stok sebuah Varian dan menghitung Stok Varian (PRD §4.2, §5.3), serta daftar Item stok per
// Varian beserta mengubah dan menghapus Item stok Tersedia (PRD §4.4, §9.7). Aturannya ada di
// src/domain/item-stok.ts dan src/domain/stok-varian.ts. Isinya disimpan terenkripsi (PRD §12) lewat
// enkripsi-item-stok.ts.
import { and, count, eq, ne } from "drizzle-orm";

import {
  itemStokBolehDiubah,
  kolomItemStok,
  periksaItemStok,
  STATUS_ITEM_STOK,
  tempelItemStok,
  type MasalahItemStok,
  type StatusItemStok,
} from "@/domain/item-stok";
import { stokVarian } from "@/domain/stok-varian";

import { db } from "./db";
import { itemStok, pesanan, produk, varian } from "./db/schema";
import {
  bacaKunciItemStok,
  bukaItemStok,
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

/**
 * Stok Varian sebuah Varian beserta jumlah Item stok per status sebagai bahan hitungnya (PRD §5.3).
 * Bisa dibaca di dalam transaksi yang sedang berjalan.
 */
export async function bacaStokVarian(
  varianId: string,
  eksekutor: Pick<typeof db, "select"> = db,
) {
  const jumlahPerStatus = { Tersedia: 0, Ditahan: 0, Terkirim: 0 };
  const semua = await eksekutor
    .select({ status: itemStok.status, jumlah: count() })
    .from(itemStok)
    .where(eq(itemStok.varianId, varianId))
    .groupBy(itemStok.status);
  for (const { status, jumlah } of semua) jumlahPerStatus[status] = jumlah;
  return stokVarian({ jumlahPerStatus });
}

// Isi Item stok dibandingkan seperti yang dibaca orang: angka di dalamnya dibandingkan sebagai angka, jadi
// "Profil 2" berada sebelum "Profil 10".
const pembanding = new Intl.Collator("id", { numeric: true });

/**
 * Semua Item stok sebuah Varian untuk daftar Item stok di dasbor admin (PRD §9.7), atau hanya yang berstatus
 * `status` bila diberikan. Setiap Item stok membawa id, status, Nomor Pesanan yang menahannya (Ditahan) atau
 * menerimanya (Terkirim), dan isi lengkapnya per kolom menurut kolomItemStok. Isinya dibuka dengan
 * ITEM_STOK_KEY.
 *
 * Urutannya Tersedia, Ditahan, lalu Terkirim, dan di dalam status yang sama menurut isinya. Urutan ini
 * keputusan teknis, karena PRD tidak mengatur urutan daftar Item stok.
 */
export async function daftarItemStokVarian({
  varianId,
  status,
}: {
  varianId: string;
  status?: StatusItemStok;
}) {
  const semua = await db
    .select({
      id: itemStok.id,
      status: itemStok.status,
      nomorPesanan: pesanan.nomorPesanan,
      isiTerenkripsi: itemStok.isiTerenkripsi,
      formatSaatTerkirim: itemStok.formatSaatTerkirim,
      formatItemStok: produk.formatItemStok,
    })
    .from(itemStok)
    .innerJoin(varian, eq(itemStok.varianId, varian.id))
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .leftJoin(pesanan, eq(itemStok.pesananId, pesanan.id))
    .where(
      and(
        eq(itemStok.varianId, varianId),
        status === undefined ? undefined : eq(itemStok.status, status),
      ),
    );

  const isi = (satu: { kolom: { nilai: string }[] }) =>
    satu.kolom.map((k) => k.nilai).join("\n");
  return semua
    .map((baris) => ({
      id: baris.id,
      status: baris.status,
      nomorPesanan: baris.nomorPesanan,
      kolom: kolomItemStok({
        status: baris.status,
        formatItemStok: baris.formatItemStok,
        formatSaatTerkirim: baris.formatSaatTerkirim,
        nilai: bukaItemStok(baris.isiTerenkripsi),
      }),
    }))
    .sort(
      (a, b) =>
        STATUS_ITEM_STOK.indexOf(a.status) -
          STATUS_ITEM_STOK.indexOf(b.status) ||
        pembanding.compare(isi(a), isi(b)) ||
        a.id.localeCompare(b.id),
    );
}

/** Item stok yang dipilih Admin di halaman Varian: id-nya, beserta Varian dan Produk pemiliknya. */
type ItemStokDipilih = { produkId: string; varianId: string; id: string };

/**
 * Mengunci baris Item stok itu sampai akhir transaksi, bila Item stok itu milik Varian dan Produk itu.
 * Hasilnya statusnya, atau null bila tidak ada.
 *
 * Penahanan (PRD §5.3) dan pemrosesan pembayaran mengunci Item stok dengan FOR UPDATE, dan melewati yang
 * sedang dikunci (SKIP LOCKED). Jadi bila checkout lebih dulu mengunci Item stok ini, transaksi ini menunggu
 * checkout itu selesai lalu membaca status barunya, misalnya Ditahan. Bila transaksi ini lebih dulu, checkout
 * melewati Item stok ini dan menahan Item stok Tersedia lain.
 */
async function kunciItemStok(
  tx: Pick<typeof db, "select">,
  { produkId, varianId, id }: ItemStokDipilih,
) {
  const [baris] = await tx
    .select({ status: itemStok.status })
    .from(itemStok)
    .innerJoin(varian, eq(itemStok.varianId, varian.id))
    .where(
      and(
        eq(itemStok.id, id),
        eq(itemStok.varianId, varianId),
        eq(varian.produkId, produkId),
      ),
    )
    .for("update", { of: itemStok });
  return baris?.status ?? null;
}

/**
 * Mengubah isi sebuah Item stok, yaitu isi kolom-kolomnya menurut urutan Format Item stok (PRD §4.4).
 *
 * - Hanya Item stok Tersedia yang diubah (itemStokBolehDiubah). Item stok Ditahan atau Terkirim tidak berubah.
 * - Isi baru diperiksa seperti Item stok dari form (periksaItemStok, PRD §4.2): spasi di awal dan akhir kolom
 *   dibuang, dan isi dengan kolom kosong, jumlah kolom yang salah, atau yang sama persis dengan Item stok
 *   lain di Varian itu, terkirim maupun belum, ditolak. Item stok ini tidak dibandingkan dengan dirinya sendiri.
 * - Isi baru disimpan terenkripsi beserta sidik jari barunya (PRD §12). Tanpa ITEM_STOK_KEY yang sah, tidak ada
 *   yang diubah.
 *
 * Baris Varian dikunci lebih dulu, seperti saat Item stok diisi, supaya pengisian dan pengubahan bersamaan di
 * Varian yang sama tidak menghasilkan Item stok yang sama persis. Kuncinya FOR NO KEY UPDATE, yang tidak
 * menghalangi checkout membuat Pesanan untuk Varian itu. Lalu baris Item stok dikunci (kunciItemStok).
 */
export async function ubahItemStok({
  nilai,
  ...dipilih
}: ItemStokDipilih & { nilai: string[] }) {
  const kunci = bacaKunciItemStok();
  if (kunci.hasil !== "ada") {
    return { hasil: "kunci-bermasalah", masalah: kunci.hasil } as const;
  }

  return db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({ formatItemStok: produk.formatItemStok })
      .from(varian)
      .innerJoin(produk, eq(varian.produkId, produk.id))
      .where(
        and(
          eq(varian.id, dipilih.varianId),
          eq(varian.produkId, dipilih.produkId),
        ),
      )
      .for("no key update", { of: varian });
    const status = terkunci ? await kunciItemStok(tx, dipilih) : null;
    if (!terkunci || !status) return { hasil: "tidak-ada" } as const;
    if (!itemStokBolehDiubah(status)) {
      return { hasil: "tidak-boleh", status } as const;
    }

    const sidikJariLain = new Set(
      (
        await tx
          .select({ sidikJari: itemStok.sidikJari })
          .from(itemStok)
          .where(
            and(
              eq(itemStok.varianId, dipilih.varianId),
              ne(itemStok.id, dipilih.id),
            ),
          )
      ).map((baris) => baris.sidikJari),
    );
    const kolom = terkunci.formatItemStok;
    const periksa = periksaItemStok({
      kolom,
      nilai,
      sudahAda: (isi) => sidikJariLain.has(sidikJariItemStok(kunci.kunci, isi)),
    });
    if (!periksa.sah) {
      return { hasil: "ditolak", kolom, masalah: periksa.masalah } as const;
    }

    await tx
      .update(itemStok)
      .set({
        isiTerenkripsi: enkripsiItemStok(kunci.kunci, periksa.nilai),
        sidikJari: sidikJariItemStok(kunci.kunci, periksa.nilai),
      })
      .where(eq(itemStok.id, dipilih.id));
    return { hasil: "diubah", nilai: periksa.nilai } as const;
  });
}

/**
 * Menghapus sebuah Item stok (PRD §4.4). Hanya Item stok Tersedia yang dihapus (itemStokBolehDiubah); Item stok
 * Ditahan atau Terkirim tetap ada. Baris Item stok dikunci lebih dulu (kunciItemStok).
 */
export async function hapusItemStok(dipilih: ItemStokDipilih) {
  return db.transaction(async (tx) => {
    const status = await kunciItemStok(tx, dipilih);
    if (!status) return { hasil: "tidak-ada" } as const;
    if (!itemStokBolehDiubah(status)) {
      return { hasil: "tidak-boleh", status } as const;
    }
    await tx.delete(itemStok).where(eq(itemStok.id, dipilih.id));
    return { hasil: "dihapus" } as const;
  });
}
