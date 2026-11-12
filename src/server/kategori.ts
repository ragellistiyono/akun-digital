import { asc, count, DrizzleQueryError, eq, ne } from "drizzle-orm";
import postgres from "postgres";

import { bolehHapusKategori } from "@/domain/hapus-katalog";
import { namaKategoriDipakai } from "@/domain/nama-kategori";

import {
  alamatBerkasUnggahan,
  hapusBerkasUnggahan,
  simpanGambar,
} from "./berkas-unggahan";
import { db } from "./db";
import { kategori, produk } from "./db/schema";

/** Kategori untuk ditampilkan: nama dan alamat gambar ikonnya. */
export type Kategori = { id: string; nama: string; alamatIkon: string };

const untukTampilan = ({ id, nama, ikon }: typeof kategori.$inferSelect) => ({
  id,
  nama,
  alamatIkon: alamatBerkasUnggahan(ikon),
});

/** Semua Kategori, urut menurut nama. */
export async function daftarKategori(): Promise<Kategori[]> {
  const baris = await db
    .select()
    .from(kategori)
    .orderBy(asc(kategori.nama), asc(kategori.id));
  return baris.map(untukTampilan);
}

/** Satu Kategori menurut id-nya, atau null bila tidak ada. */
export async function bacaKategori(id: string): Promise<Kategori | null> {
  const [baris] = await db.select().from(kategori).where(eq(kategori.id, id));
  return baris ? untukTampilan(baris) : null;
}

type Penghubung = Pick<typeof db, "select">;

/** Apakah nama itu sudah dipakai Kategori selain Kategori `kecuali` (PRD §3.1). */
async function namaDipakai(
  penghubung: Penghubung,
  nama: string,
  kecuali?: string,
) {
  const lain = await penghubung
    .select({ nama: kategori.nama })
    .from(kategori)
    .where(kecuali ? ne(kategori.id, kecuali) : undefined);
  return namaKategoriDipakai(
    nama,
    lain.map((baris) => baris.nama),
  );
}

/**
 * Apakah penulisan ditolak indeks unik nama Kategori. Ini terjadi bila Kategori lain dengan nama yang
 * sama tersimpan bersamaan, setelah pemeriksaan nama selesai.
 */
const ditolakIndeksNama = (galat: unknown) =>
  galat instanceof DrizzleQueryError &&
  galat.cause instanceof postgres.PostgresError &&
  galat.cause.code === "23505" &&
  galat.cause.constraint_name === "kategori_nama_unik";

const NAMA_DIPAKAI = { hasil: "nama-dipakai" } as const;

/**
 * Membuat Kategori baru (PRD §3.1). Nama yang sudah dipakai Kategori lain ditolak sebelum gambar
 * ikonnya disimpan. Gambar ikon disimpan di folder unggahan lebih dulu; bila berkasnya ditolak,
 * Kategori tidak dibuat. Bila penulisan database gagal, gambar itu dihapus lagi.
 */
export async function buatKategori({
  nama,
  ikon,
}: {
  nama: string;
  ikon: File;
}) {
  if (await namaDipakai(db, nama)) return NAMA_DIPAKAI;

  const gambar = await simpanGambar(ikon);
  if (gambar.hasil === "ditolak") return gambar;

  try {
    await db.insert(kategori).values({ nama, ikon: gambar.nama });
  } catch (galat) {
    await hapusBerkasUnggahan(gambar.nama);
    if (ditolakIndeksNama(galat)) return NAMA_DIPAKAI;
    throw galat;
  }
  return { hasil: "dibuat" } as const;
}

/**
 * Mengubah nama Kategori, dan gambar ikonnya bila Admin memilih gambar baru. Tanpa gambar baru,
 * ikon lama tetap dipakai. Nama yang sudah dipakai Kategori lain ditolak, tetapi Kategori boleh
 * disimpan dengan namanya sendiri. Setelah ikon diganti, berkas ikon lama dihapus dari folder
 * unggahan. Bila Kategori tidak ada, namanya ditolak, atau penulisan database gagal, gambar
 * pengganti dihapus lagi.
 */
export async function ubahKategori({
  id,
  nama,
  ikon,
}: {
  id: string;
  nama: string;
  ikon?: File;
}) {
  let ikonPengganti: string | undefined;
  if (ikon) {
    const gambar = await simpanGambar(ikon);
    if (gambar.hasil === "ditolak") return gambar;
    ikonPengganti = gambar.nama;
  }

  let hasil:
    | { hasil: "tidak-ada" }
    | typeof NAMA_DIPAKAI
    | { hasil: "diubah"; ikonLama: string };
  try {
    hasil = await db.transaction(async (tx) => {
      // Baris dikunci supaya dua Admin yang mengganti ikon bersamaan masing-masing menghapus ikon
      // yang memang ia ganti, dan tidak ada berkas yang tertinggal.
      const [lama] = await tx
        .select({ ikon: kategori.ikon })
        .from(kategori)
        .where(eq(kategori.id, id))
        .for("update");
      if (!lama) return { hasil: "tidak-ada" } as const;
      if (await namaDipakai(tx, nama, id)) return NAMA_DIPAKAI;

      await tx
        .update(kategori)
        .set({ nama, ikon: ikonPengganti ?? lama.ikon })
        .where(eq(kategori.id, id));
      return { hasil: "diubah", ikonLama: lama.ikon } as const;
    });
  } catch (galat) {
    if (ikonPengganti) await hapusBerkasUnggahan(ikonPengganti);
    if (ditolakIndeksNama(galat)) return NAMA_DIPAKAI;
    throw galat;
  }

  if (hasil.hasil !== "diubah") {
    if (ikonPengganti) await hapusBerkasUnggahan(ikonPengganti);
    return hasil;
  }
  if (ikonPengganti) await hapusBerkasUnggahan(hasil.ikonLama);
  return { hasil: "diubah" } as const;
}

/**
 * Menghapus Kategori beserta berkas gambar ikonnya (PRD §3.1). Kategori yang masih berisi Produk, termasuk
 * Produk nonaktif, tidak dihapus (bolehHapusKategori), dan hasilnya membawa jumlah Produk itu.
 *
 * Baris Kategori dikunci FOR UPDATE lebih dulu, baru Produknya dihitung. Produk yang dibuat di Kategori ini,
 * atau dipindahkan ke Kategori ini, mengunci baris Kategori lewat foreign key-nya (FOR KEY SHARE), jadi
 * penyimpanan seperti itu menunggu transaksi ini selesai, atau transaksi ini menunggu penyimpanan itu lalu
 * ikut menghitung Produknya. Berkas ikon dihapus setelah Kategori terhapus dari database.
 */
export async function hapusKategori(id: string) {
  const hasil = await db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({ ikon: kategori.ikon })
      .from(kategori)
      .where(eq(kategori.id, id))
      .for("update");
    if (!terkunci) return { hasil: "tidak-ada" } as const;

    const jumlah = { aktif: 0, nonaktif: 0 };
    const semua = await tx
      .select({ aktif: produk.aktif, jumlah: count() })
      .from(produk)
      .where(eq(produk.kategoriId, id))
      .groupBy(produk.aktif);
    for (const baris of semua) {
      jumlah[baris.aktif ? "aktif" : "nonaktif"] = baris.jumlah;
    }
    const boleh = bolehHapusKategori({
      jumlahProdukAktif: jumlah.aktif,
      jumlahProdukNonaktif: jumlah.nonaktif,
    });
    if (!boleh.boleh) {
      return {
        hasil: "berisi-produk",
        jumlahProduk: boleh.jumlahProduk,
      } as const;
    }

    await tx.delete(kategori).where(eq(kategori.id, id));
    return { hasil: "dihapus", ikon: terkunci.ikon } as const;
  });

  if (hasil.hasil !== "dihapus") return hasil;
  await hapusBerkasUnggahan(hasil.ikon);
  return { hasil: "dihapus" } as const;
}
