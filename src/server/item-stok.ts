// Mengisi Item stok sebuah Varian dan menghitung Stok Varian (PRD §4.2, §5.3), daftar semua Varian untuk menu
// Item stok (PRD §4.2 ▶ Keputusan 2026-11-20), serta daftar Item stok per Varian beserta Pembeli-nya, mengubah dan
// menghapus Item stok Tersedia, dan menghapus semua Item stok Tersedia sebuah Varian (PRD §4.4, §9.7). Item stok
// kembar diperiksa di seluruh toko (PRD §4.2 ▶ Keputusan 2026-11-22). Aturannya ada di src/domain/item-stok.ts,
// src/domain/hapus-semua-item-stok.ts, dan src/domain/stok-varian.ts. Isinya disimpan terenkripsi (PRD §12) lewat
// enkripsi-item-stok.ts.
import { and, count, eq, inArray, sql } from "drizzle-orm";

import {
  isiBarisTempelan,
  itemStokBolehDiubah,
  kolomItemStok,
  periksaItemStok,
  rapikanIsiItemStok,
  STATUS_ITEM_STOK,
  tempelItemStok,
  type CariItemStokSama,
  type LetakItemStok,
  type MasalahItemStok,
  type StatusItemStok,
} from "@/domain/item-stok";
import { stokVarian } from "@/domain/stok-varian";

import { waktuDibuat } from "./daftar-pesanan";
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
  itemStokSama: CariItemStokSama,
) => { simpan: string[][]; hasil: H };

type Transaksi = Pick<typeof db, "select" | "execute">;

// Item stok disimpan dan dicari dalam kelompok, supaya tempelan yang sangat panjang tidak melewati batas jumlah
// parameter satu perintah PostgreSQL.
const UKURAN_KELOMPOK = 1_000;

/**
 * Menunggu giliran mengisi atau mengubah Item stok, sampai akhir transaksi. Item stok kembar diperiksa di seluruh
 * toko (PRD §4.2 ▶ Keputusan 2026-11-22), jadi semua pengisian dan pengubahan Item stok di toko berjalan satu per
 * satu lewat satu kunci advisory PostgreSQL. Dengan begitu dua Admin yang mengisi isi yang sama ke dua Varian
 * bersamaan tetap tidak menyimpan Item stok kembar. Checkout dan pembayaran tidak memakai kunci ini.
 */
async function tungguGiliranIsiItemStok(tx: Transaksi) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('item-stok-kembar'))`,
  );
}

/**
 * Pencari Item stok toko yang sama persis untuk periksaItemStok dan tempelItemStok. Item stok toko dari Varian
 * dan Produk mana pun, berstatus apa pun, yang sidik jarinya sama dengan salah satu isi `calon` dibaca sekali dari
 * database beserta letaknya, jadi isi Item stok yang tersimpan tidak perlu dibuka (PRD §12). `calon` harus memuat
 * setiap isi yang nanti ditanyakan domain, sudah dirapikan seperti rapikanIsiItemStok. Isi lain yang ditanyakan
 * melempar galat, supaya Item stok kembar tidak pernah lolos tanpa diperiksa.
 */
async function pencariItemStokSama(
  tx: Transaksi,
  kunci: KunciItemStok,
  calon: readonly (readonly string[])[],
): Promise<CariItemStokSama> {
  const dicari = [
    ...new Set(calon.map((nilai) => sidikJariItemStok(kunci, nilai))),
  ];
  const letakPerSidikJari = new Map<string, LetakItemStok[]>(
    dicari.map((sidikJari) => [sidikJari, []]),
  );
  for (let mulai = 0; mulai < dicari.length; mulai += UKURAN_KELOMPOK) {
    const semua = await tx
      .select({
        sidikJari: itemStok.sidikJari,
        id: itemStok.id,
        produk: produk.nama,
        varian: varian.nama,
        status: itemStok.status,
      })
      .from(itemStok)
      .innerJoin(varian, eq(itemStok.varianId, varian.id))
      .innerJoin(produk, eq(varian.produkId, produk.id))
      .where(
        inArray(
          itemStok.sidikJari,
          dicari.slice(mulai, mulai + UKURAN_KELOMPOK),
        ),
      );
    for (const { sidikJari, ...letak } of semua) {
      letakPerSidikJari.get(sidikJari)?.push(letak);
    }
  }

  return (nilai) => {
    const letak = letakPerSidikJari.get(sidikJariItemStok(kunci, nilai));
    if (!letak) {
      throw new Error(
        "Isi Item stok ini diperiksa tanpa dicari dulu di seluruh toko, jadi Item stok kembar bisa lolos. Sertakan isinya, yang sudah dirapikan rapikanIsiItemStok, di calon pencariItemStokSama.",
      );
    }
    return letak;
  };
}

/**
 * Memeriksa Item stok baru untuk sebuah Varian milik Produk itu, lalu menyimpan yang diterima dengan
 * status Tersedia. `calon` adalah isi Item stok baru yang akan diperiksa (pencariItemStokSama). Hasilnya null
 * bila Varian tidak ada atau milik Produk lain.
 *
 * Pengisian menunggu gilirannya lebih dulu (tungguGiliranIsiItemStok), lalu baris Varian dan Produknya dikunci
 * selama pemeriksaan dan penyimpanan, supaya Format Item stok-nya tidak berubah di tengah jalan. Item stok yang
 * sudah ada di toko dikenali dari sidik jarinya, jadi isinya tidak perlu dibuka.
 */
async function isiVarian<H>(
  kunci: KunciItemStok,
  { produkId, varianId }: { produkId: string; varianId: string },
  calon: readonly (readonly string[])[],
  periksa: Pemeriksa<H>,
): Promise<H | null> {
  return db.transaction(async (tx) => {
    await tungguGiliranIsiItemStok(tx);
    const [terkunci] = await tx
      .select({ formatItemStok: produk.formatItemStok })
      .from(varian)
      .innerJoin(produk, eq(varian.produkId, produk.id))
      .where(and(eq(varian.id, varianId), eq(varian.produkId, produkId)))
      .for("update");
    if (!terkunci) return null;

    const { simpan, hasil } = periksa(
      terkunci.formatItemStok,
      await pencariItemStokSama(tx, kunci, calon),
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
  >(
    kunci.kunci,
    varianDipilih,
    [rapikanIsiItemStok(nilai)],
    (kolom, itemStokSama) => {
      const periksa = periksaItemStok({ kolom, nilai, itemStokSama });
      if (periksa.sah) {
        return { simpan: [periksa.nilai], hasil: { hasil: "disimpan" } };
      }
      return {
        simpan: [],
        hasil: { hasil: "ditolak", kolom, masalah: periksa.masalah },
      };
    },
  );
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
    isiBarisTempelan(teks),
    (kolom, itemStokSama) => {
      const tempel = tempelItemStok({ kolom, teks, itemStokSama });
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

// Isi Item stok, serta nama Produk dan Varian, dibandingkan seperti yang dibaca orang: angka di dalamnya
// dibandingkan sebagai angka, jadi "Profil 2" berada sebelum "Profil 10".
const pembanding = new Intl.Collator("id", { numeric: true });

/**
 * Semua Varian untuk menu Item stok di dasbor admin (PRD §4.2 ▶ Keputusan 2026-11-20), termasuk Varian dan
 * Produk nonaktif. Setiap Varian membawa nama dan status aktif Varian serta Produknya, Format Item stok
 * Produknya, dan Stok Varian beserta jumlah Item stok per status sebagai bahan hitungnya (PRD §5.3).
 *
 * Urutannya menurut nama Produk, lalu nama Varian, A sampai Z, dengan angka di dalam nama dibandingkan sebagai
 * angka, jadi "3 Bulan" berada sebelum "12 Bulan".
 */
export async function daftarVarianItemStok() {
  const baris = await db
    .select({
      varianId: varian.id,
      namaVarian: varian.nama,
      varianAktif: varian.aktif,
      produkId: produk.id,
      namaProduk: produk.nama,
      produkAktif: produk.aktif,
      formatItemStok: produk.formatItemStok,
      status: itemStok.status,
      jumlah: count(itemStok.id),
    })
    .from(varian)
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .leftJoin(itemStok, eq(itemStok.varianId, varian.id))
    .groupBy(varian.id, produk.id, itemStok.status);

  const perVarian = new Map<
    string,
    Omit<(typeof baris)[number], "status" | "jumlah"> & {
      jumlahPerStatus: Record<StatusItemStok, number>;
    }
  >();
  for (const { status, jumlah, ...v } of baris) {
    const ada = perVarian.get(v.varianId) ?? {
      ...v,
      jumlahPerStatus: { Tersedia: 0, Ditahan: 0, Terkirim: 0 },
    };
    if (status !== null) ada.jumlahPerStatus[status] = jumlah;
    perVarian.set(v.varianId, ada);
  }

  return [...perVarian.values()]
    .map(({ jumlahPerStatus, ...v }) => ({
      ...v,
      stok: stokVarian({ jumlahPerStatus }),
    }))
    .sort(
      (a, b) =>
        pembanding.compare(a.namaProduk, b.namaProduk) ||
        pembanding.compare(a.namaVarian, b.namaVarian) ||
        a.varianId.localeCompare(b.varianId),
    );
}

/**
 * Semua Item stok sebuah Varian untuk daftar Item stok di dasbor admin (PRD §9.7), atau hanya yang berstatus
 * `status` bila diberikan. Setiap Item stok membawa id, status, Nomor Pesanan yang menahannya (Ditahan) atau
 * menerimanya (Terkirim), Pembeli-nya, dan isi lengkapnya per kolom menurut kolomItemStok. Isinya dibuka dengan
 * ITEM_STOK_KEY.
 *
 * Pembeli Item stok (PRD §9.7 ▶ Keputusan 2026-11-22) adalah email Pesanan saat ini, termasuk hasil koreksi email,
 * beserta waktunya: waktu Pesanan dibuat untuk Item stok Ditahan, dan waktu bayar Pesanan untuk Item stok
 * Terkirim. Waktunya null bila tidak tercatat. Item stok Tersedia tidak punya Pembeli.
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
    .with(waktuDibuat)
    .select({
      id: itemStok.id,
      status: itemStok.status,
      nomorPesanan: pesanan.nomorPesanan,
      email: pesanan.email,
      waktuDibuat: waktuDibuat.waktu,
      waktuBayar: pesanan.waktuBayar,
      isiTerenkripsi: itemStok.isiTerenkripsi,
      formatSaatTerkirim: itemStok.formatSaatTerkirim,
      formatItemStok: produk.formatItemStok,
    })
    .from(itemStok)
    .innerJoin(varian, eq(itemStok.varianId, varian.id))
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .leftJoin(pesanan, eq(itemStok.pesananId, pesanan.id))
    .leftJoin(waktuDibuat, eq(waktuDibuat.pesananId, pesanan.id))
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
      pembeli:
        baris.email === null
          ? null
          : {
              email: baris.email,
              waktu:
                baris.status === "Terkirim"
                  ? baris.waktuBayar
                  : baris.waktuDibuat,
            },
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
 *   dibuang, dan isi dengan kolom kosong, jumlah kolom yang salah, atau Item stok kembar, yaitu yang sama persis
 *   dengan Item stok lain di seluruh toko, terkirim maupun belum, ditolak (PRD §4.2 ▶ Keputusan 2026-11-22). Item
 *   stok ini tidak dibandingkan dengan dirinya sendiri.
 * - Isi baru disimpan terenkripsi beserta sidik jari barunya (PRD §12). Tanpa ITEM_STOK_KEY yang sah, tidak ada
 *   yang diubah.
 *
 * Pengubahan menunggu gilirannya lebih dulu, seperti saat Item stok diisi (tungguGiliranIsiItemStok), supaya
 * pengisian dan pengubahan bersamaan tidak menghasilkan Item stok kembar. Lalu baris Varian dikunci dengan FOR NO
 * KEY UPDATE, yang tidak menghalangi checkout membuat Pesanan untuk Varian itu, dan baris Item stok dikunci
 * (kunciItemStok).
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
    await tungguGiliranIsiItemStok(tx);
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

    const kolom = terkunci.formatItemStok;
    const periksa = periksaItemStok({
      kolom,
      nilai,
      itemStokSama: await pencariItemStokSama(tx, kunci.kunci, [
        rapikanIsiItemStok(nilai),
      ]),
      sedangDiubah: dipilih.id,
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

/**
 * Menghapus semua Item stok Varian itu yang masih Tersedia saat penegasannya disetujui (PRD §4.4 ▶ Keputusan
 * 2026-11-22). Item stok Ditahan dan Terkirim tidak ikut terhapus. Hasilnya jumlah yang benar-benar terhapus, atau
 * "varian-tidak-ada" bila Varian itu tidak ada atau milik Produk lain.
 *
 * Status diperiksa oleh perintah hapus itu sendiri. Bila checkout sedang mengunci salah satu Item stok untuk
 * ditahan (PRD §5.3), perintah ini menunggu checkout itu selesai, lalu melewati Item stok yang sudah menjadi
 * Ditahan. Bila perintah ini lebih dulu, checkout melewati Item stok yang sedang dihapus (SKIP LOCKED).
 */
export async function hapusSemuaItemStokTersedia({
  produkId,
  varianId,
}: {
  produkId: string;
  varianId: string;
}) {
  return db.transaction(async (tx) => {
    const [ada] = await tx
      .select({ id: varian.id })
      .from(varian)
      .where(and(eq(varian.id, varianId), eq(varian.produkId, produkId)));
    if (!ada) return { hasil: "varian-tidak-ada" } as const;

    const terhapus = await tx
      .delete(itemStok)
      .where(
        and(eq(itemStok.varianId, varianId), eq(itemStok.status, "Tersedia")),
      )
      .returning({ id: itemStok.id });
    return { hasil: "dihapus", jumlah: terhapus.length } as const;
  });
}
