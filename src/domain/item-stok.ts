// Mengisi Item stok sebuah Varian (PRD §4.2): lewat form satu Item stok, atau dengan menempel banyak
// baris sekaligus. Item stok berupa isi kolom-kolom Format Item stok (PRD §4.1), menurut urutannya.
// Mengubah dan menghapus Item stok (PRD §4.4), serta kolom yang tampil di daftar Item stok (PRD §9.7).
import { kolomItemStokTerkirim } from "./item-stok-terkirim";

/** Status sebuah Item stok (GLOSSARY). Item stok baru berstatus Tersedia. */
export const STATUS_ITEM_STOK = ["Tersedia", "Ditahan", "Terkirim"] as const;

export type StatusItemStok = (typeof STATUS_ITEM_STOK)[number];

/**
 * Apakah sebuah Item stok boleh diubah atau dihapus Admin (PRD §4.4). Hanya Item stok Tersedia yang boleh.
 * Item stok Ditahan sudah disisihkan untuk Pesanan yang menunggu pembayaran (PRD §5.3), dan Item stok
 * Terkirim sudah dikirim ke sebuah Pesanan, jadi keduanya tidak bisa diubah atau dihapus.
 */
export function itemStokBolehDiubah(
  status: StatusItemStok,
): status is "Tersedia" {
  return status === "Tersedia";
}

/**
 * Kolom-kolom sebuah Item stok untuk daftar Item stok di dasbor admin (PRD §9.7), menurut urutan Format Item
 * stok: nama kolom dan isinya.
 *
 * - Item stok Terkirim tampil dengan nama kolom yang dicatat saat Terkirim (kolomItemStokTerkirim), karena
 *   Item stok yang sudah Terkirim tetap tampil dengan kolom lamanya (PRD §4.1).
 * - Item stok Tersedia dan Ditahan tampil dengan nama kolom Format Item stok yang berlaku sekarang.
 *
 * Melempar galat bila Item stok Terkirim tidak mencatat nama kolomnya, atau bila jumlah isi kolom Item stok
 * Tersedia atau Ditahan tidak sama dengan jumlah kolom Format Item stok. Keduanya tidak pernah terjadi,
 * karena nama kolom selalu dicatat saat Item stok Terkirim, dan kolom tidak bisa ditambah atau dihapus selama
 * Produk punya Item stok Tersedia atau Ditahan (PRD §4.1).
 */
export function kolomItemStok({
  status,
  formatItemStok,
  formatSaatTerkirim,
  nilai,
}: {
  status: StatusItemStok;
  formatItemStok: readonly string[];
  formatSaatTerkirim: readonly string[] | null;
  nilai: readonly string[];
}) {
  if (status === "Terkirim") {
    if (!formatSaatTerkirim) {
      throw new Error(
        "Item stok Terkirim ini tidak mencatat nama kolomnya, padahal nama kolom Format Item stok selalu dicatat saat Item stok Terkirim (PRD §4.1). Periksa item_stok.format_saat_terkirim untuk Item stok itu di database.",
      );
    }
    return kolomItemStokTerkirim({ formatSaatTerkirim, nilai });
  }
  if (formatItemStok.length !== nilai.length) {
    throw new Error(
      `Item stok ${status} ini punya ${nilai.length} isi kolom, padahal Format Item stok Produknya punya ${formatItemStok.length} kolom, dan kolom tidak bisa ditambah atau dihapus selama ada Item stok Tersedia atau Ditahan (PRD §4.1). Periksa Format Item stok Produk itu (produk.format_item_stok) terhadap isi Item stok-nya.`,
    );
  }
  return formatItemStok.map((nama, i) => ({ nama, nilai: nilai[i] }));
}

/** Pemisah kolom di setiap baris tempelan (PRD §4.2). */
export const PEMISAH_KOLOM = "|";

/**
 * Letak sebuah Item stok di toko: id-nya, nama Produk dan Varian-nya, dan statusnya (PRD §4.2 ▶ Keputusan
 * 2026-11-22).
 */
export type LetakItemStok = {
  id: string;
  produk: string;
  varian: string;
  status: StatusItemStok;
};

/**
 * Pencari Item stok toko yang semua kolomnya sama persis dengan isi itu, dari Varian dan Produk mana pun,
 * berstatus Tersedia, Ditahan, maupun Terkirim. Isi yang dicari sudah dibuang spasinya di awal dan akhir
 * setiap kolom, lalu dibandingkan apa adanya: huruf besar dan kecil dibedakan, dan Item stok dengan jumlah
 * kolom berbeda tidak pernah sama. Lapisan server menjawabnya tanpa membuka isi Item stok yang tersimpan.
 */
export type CariItemStokSama = (
  nilai: readonly string[],
) => readonly LetakItemStok[];

/** Sebab sebuah Item stok ditolak. Nomor kolom dihitung dari 1, menurut Format Item stok. */
export type MasalahItemStok =
  | { alasan: "jumlah-kolom-salah"; jumlahKolom: number }
  | { alasan: "kolom-kosong"; nomorKolom: number[] }
  | { alasan: "sudah-ada"; letak: LetakItemStok; pesan: string };

type HasilPeriksaItemStok =
  { sah: true; nilai: string[] } | { sah: false; masalah: MasalahItemStok };

// Nama Produk dan Varian dibandingkan seperti yang dibaca orang, sama seperti daftar Varian di menu Item stok:
// angka di dalamnya dibandingkan sebagai angka, jadi "3 Bulan" berada sebelum "12 Bulan".
const pembandingNama = new Intl.Collator("id", { numeric: true });

/**
 * Item stok kembar (PRD §4.2 ▶ Keputusan 2026-11-22): dari Item stok toko yang sama persis, letak yang disebut
 * adalah yang pertama menurut nama Produk, lalu nama Varian, A sampai Z. Bila nama Produk dan Varian-nya juga
 * sama, urutannya Tersedia, Ditahan, Terkirim, lalu id, supaya letak yang disebut selalu sama. Item stok yang
 * sedang diubah tidak dibandingkan dengan dirinya sendiri. Null bila tidak ada Item stok lain yang sama persis.
 */
function letakItemStokKembar(
  sama: readonly LetakItemStok[],
  sedangDiubah: string | null,
) {
  const [pertama] = sama
    .filter((letak) => letak.id !== sedangDiubah)
    .toSorted(
      (a, b) =>
        pembandingNama.compare(a.produk, b.produk) ||
        pembandingNama.compare(a.varian, b.varian) ||
        STATUS_ITEM_STOK.indexOf(a.status) -
          STATUS_ITEM_STOK.indexOf(b.status) ||
        a.id.localeCompare(b.id),
    );
  return pertama ?? null;
}

/**
 * Isi sebuah Item stok seperti yang dibandingkan dan disimpan: spasi di awal dan akhir setiap kolom dibuang
 * (PRD §4.2 ▶ Keputusan 2026-11-11). Kolom yang hanya berisi spasi menjadi kosong.
 */
export function rapikanIsiItemStok(nilai: readonly string[]) {
  return nilai.map((satu) => satu.trim());
}

/**
 * Memeriksa satu Item stok, yaitu isi kolom-kolomnya menurut urutan Format Item stok (PRD §4.2).
 * Spasi di awal dan akhir setiap kolom dibuang. Item stok ditolak bila jumlah kolomnya tidak sama
 * dengan Format Item stok, ada kolom yang kosong, atau ia Item stok kembar: sama persis dengan Item stok lain
 * di toko (PRD §4.2 ▶ Keputusan 2026-11-22). Alasan kembar menyebut letak Item stok yang sama, misalnya
 * "Sudah ada di Netflix Premium – 3 Bulan (Terkirim)". Hanya satu alasan yang diberikan, diperiksa menurut
 * urutan itu.
 *
 * `sedangDiubah` adalah id Item stok yang sedang diubah (PRD §4.4), yang tidak dibandingkan dengan dirinya
 * sendiri.
 */
export function periksaItemStok({
  kolom,
  nilai,
  itemStokSama,
  sedangDiubah = null,
}: {
  kolom: readonly string[];
  nilai: readonly string[];
  itemStokSama: CariItemStokSama;
  sedangDiubah?: string | null;
}): HasilPeriksaItemStok {
  const isi = rapikanIsiItemStok(nilai);
  if (isi.length !== kolom.length) {
    return {
      sah: false,
      masalah: { alasan: "jumlah-kolom-salah", jumlahKolom: isi.length },
    };
  }
  const nomorKolom = isi.flatMap((satu, i) => (satu === "" ? [i + 1] : []));
  if (nomorKolom.length > 0) {
    return { sah: false, masalah: { alasan: "kolom-kosong", nomorKolom } };
  }
  const letak = letakItemStokKembar(itemStokSama(isi), sedangDiubah);
  if (letak) {
    return {
      sah: false,
      masalah: {
        alasan: "sudah-ada",
        letak,
        pesan: `Sudah ada di ${letak.produk} – ${letak.varian} (${letak.status})`,
      },
    };
  }
  return { sah: true, nilai: isi };
}

/** Setiap baris tempelan yang tidak kosong beserta nomor barisnya, dihitung dari 1 termasuk baris kosong. */
function barisTempelan(teks: string) {
  return teks.split(/\r?\n/).flatMap((isiBaris, indeks) =>
    isiBaris.trim() === ""
      ? []
      : [
          {
            baris: indeks + 1,
            teks: isiBaris,
            nilai: isiBaris.split(PEMISAH_KOLOM),
          },
        ],
  );
}

/**
 * Isi setiap baris tempelan yang tidak kosong, sudah dirapikan seperti rapikanIsiItemStok. Lapisan server
 * memakainya untuk membaca Item stok toko yang mungkin sama persis, sebelum tempelan diperiksa tempelItemStok.
 */
export function isiBarisTempelan(teks: string) {
  return barisTempelan(teks).map(({ nilai }) => rapikanIsiItemStok(nilai));
}

type DitolakTempel = { baris: number; teks: string } & (
  MasalahItemStok | { alasan: "kembar-dalam-tempelan"; samaDenganBaris: number }
);

type HasilTempel = {
  /** Isi kolom setiap Item stok yang disimpan, menurut urutan barisnya. */
  tersimpan: string[][];
  /** Baris yang ditolak beserta nomor baris, teks aslinya, dan alasannya. */
  ditolak: DitolakTempel[];
  /** Ringkasan untuk Admin, misalnya "48 tersimpan, 2 ditolak". */
  ringkasan: string;
};

/**
 * Menempel banyak Item stok sekaligus (PRD §4.2). Setiap baris teks menjadi satu Item stok, dengan
 * kolom dipisah |. Nomor baris dihitung dari 1, termasuk baris kosong.
 *
 * - Baris kosong, atau yang hanya berisi spasi, diabaikan dan tidak dihitung.
 * - Setiap baris lain diperiksa seperti Item stok dari form (periksaItemStok). Baris yang lolos
 *   tetapi kembar dengan baris sebelumnya di tempelan yang sama juga ditolak: baris pertama
 *   disimpan, dan baris berikutnya ditolak.
 * - Setiap baris mendapat paling banyak satu alasan penolakan.
 */
export function tempelItemStok({
  kolom,
  teks,
  itemStokSama,
}: {
  kolom: readonly string[];
  teks: string;
  itemStokSama: CariItemStokSama;
}): HasilTempel {
  const tersimpan: string[][] = [];
  const ditolak: DitolakTempel[] = [];
  // Isi setiap Item stok yang sudah diterima dari tempelan ini, beserta nomor barisnya.
  const barisDiterima = new Map<string, number>();

  for (const { baris, teks: isiBaris, nilai } of barisTempelan(teks)) {
    const periksa = periksaItemStok({ kolom, nilai, itemStokSama });
    if (!periksa.sah) {
      ditolak.push({ baris, teks: isiBaris, ...periksa.masalah });
      continue;
    }
    const kunci = JSON.stringify(periksa.nilai);
    const barisPertama = barisDiterima.get(kunci);
    if (barisPertama !== undefined) {
      ditolak.push({
        baris,
        teks: isiBaris,
        alasan: "kembar-dalam-tempelan",
        samaDenganBaris: barisPertama,
      });
      continue;
    }
    barisDiterima.set(kunci, baris);
    tersimpan.push(periksa.nilai);
  }

  return {
    tersimpan,
    ditolak,
    ringkasan: `${tersimpan.length} tersimpan, ${ditolak.length} ditolak`,
  };
}
