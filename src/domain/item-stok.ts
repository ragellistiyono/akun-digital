// Mengisi Item stok sebuah Varian (PRD §4.2): lewat form satu Item stok, atau dengan menempel banyak
// baris sekaligus. Item stok berupa isi kolom-kolom Format Item stok (PRD §4.1), menurut urutannya.

/** Status sebuah Item stok (GLOSSARY). Item stok baru berstatus Tersedia. */
export const STATUS_ITEM_STOK = ["Tersedia", "Ditahan", "Terkirim"] as const;

export type StatusItemStok = (typeof STATUS_ITEM_STOK)[number];

/** Pemisah kolom di setiap baris tempelan (PRD §4.2). */
export const PEMISAH_KOLOM = "|";

/**
 * Pemeriksa apakah sebuah Item stok sama persis dengan Item stok yang sudah ada di Varian itu, terkirim
 * maupun belum. Lapisan server menjawabnya tanpa membuka isi Item stok yang tersimpan.
 */
type SudahAda = (nilai: readonly string[]) => boolean;

/** Sebab sebuah Item stok ditolak. Nomor kolom dihitung dari 1, menurut Format Item stok. */
export type MasalahItemStok =
  | { alasan: "jumlah-kolom-salah"; jumlahKolom: number }
  | { alasan: "kolom-kosong"; nomorKolom: number[] }
  | { alasan: "sudah-ada" };

type HasilPeriksaItemStok =
  { sah: true; nilai: string[] } | { sah: false; masalah: MasalahItemStok };

/**
 * Memeriksa satu Item stok, yaitu isi kolom-kolomnya menurut urutan Format Item stok (PRD §4.2).
 * Spasi di awal dan akhir setiap kolom dibuang. Item stok ditolak bila jumlah kolomnya tidak sama
 * dengan Format Item stok, ada kolom yang kosong, atau sama persis dengan Item stok yang sudah ada di
 * Varian itu. Hanya satu alasan yang diberikan, diperiksa menurut urutan itu.
 */
export function periksaItemStok({
  kolom,
  nilai,
  sudahAda,
}: {
  kolom: readonly string[];
  nilai: readonly string[];
  sudahAda: SudahAda;
}): HasilPeriksaItemStok {
  const isi = nilai.map((satu) => satu.trim());
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
  if (sudahAda(isi)) return { sah: false, masalah: { alasan: "sudah-ada" } };
  return { sah: true, nilai: isi };
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
  sudahAda,
}: {
  kolom: readonly string[];
  teks: string;
  sudahAda: SudahAda;
}): HasilTempel {
  const tersimpan: string[][] = [];
  const ditolak: DitolakTempel[] = [];
  // Isi setiap Item stok yang sudah diterima dari tempelan ini, beserta nomor barisnya.
  const barisDiterima = new Map<string, number>();

  teks.split(/\r?\n/).forEach((isiBaris, indeks) => {
    if (isiBaris.trim() === "") return;
    const baris = indeks + 1;

    const periksa = periksaItemStok({
      kolom,
      nilai: isiBaris.split(PEMISAH_KOLOM),
      sudahAda,
    });
    if (!periksa.sah) {
      ditolak.push({ baris, teks: isiBaris, ...periksa.masalah });
      return;
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
      return;
    }
    barisDiterima.set(kunci, baris);
    tersimpan.push(periksa.nilai);
  });

  return {
    tersimpan,
    ditolak,
    ringkasan: `${tersimpan.length} tersimpan, ${ditolak.length} ditolak`,
  };
}
