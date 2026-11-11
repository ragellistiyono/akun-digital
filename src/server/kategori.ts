import { asc, eq } from "drizzle-orm";

import {
  alamatBerkasUnggahan,
  hapusBerkasUnggahan,
  simpanGambar,
} from "./berkas-unggahan";
import { db } from "./db";
import { kategori } from "./db/schema";

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

/**
 * Membuat Kategori baru (PRD §3.1). Gambar ikonnya disimpan di folder unggahan lebih dulu; bila
 * berkasnya ditolak, Kategori tidak dibuat. Bila penulisan database gagal, gambar itu dihapus lagi.
 */
export async function buatKategori({
  nama,
  ikon,
}: {
  nama: string;
  ikon: File;
}) {
  const gambar = await simpanGambar(ikon);
  if (gambar.hasil === "ditolak") return gambar;

  try {
    await db.insert(kategori).values({ nama, ikon: gambar.nama });
  } catch (galat) {
    await hapusBerkasUnggahan(gambar.nama);
    throw galat;
  }
  return { hasil: "dibuat" } as const;
}

/**
 * Mengubah nama Kategori, dan gambar ikonnya bila Admin memilih gambar baru. Tanpa gambar baru,
 * ikon lama tetap dipakai. Setelah ikon diganti, berkas ikon lama dihapus dari folder unggahan. Bila
 * Kategori tidak ada atau penulisan database gagal, gambar pengganti dihapus lagi.
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

  let ikonLama: string | null;
  try {
    ikonLama = await db.transaction(async (tx) => {
      // Baris dikunci supaya dua Admin yang mengganti ikon bersamaan masing-masing menghapus ikon
      // yang memang ia ganti, dan tidak ada berkas yang tertinggal.
      const [lama] = await tx
        .select({ ikon: kategori.ikon })
        .from(kategori)
        .where(eq(kategori.id, id))
        .for("update");
      if (!lama) return null;

      await tx
        .update(kategori)
        .set({ nama, ikon: ikonPengganti ?? lama.ikon })
        .where(eq(kategori.id, id));
      return lama.ikon;
    });
  } catch (galat) {
    if (ikonPengganti) await hapusBerkasUnggahan(ikonPengganti);
    throw galat;
  }

  if (ikonLama === null) {
    if (ikonPengganti) await hapusBerkasUnggahan(ikonPengganti);
    return { hasil: "tidak-ada" } as const;
  }
  if (ikonPengganti) await hapusBerkasUnggahan(ikonLama);
  return { hasil: "diubah" } as const;
}
