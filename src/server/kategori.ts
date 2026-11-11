import { asc, eq } from "drizzle-orm";

import {
  alamatBerkasUnggahan,
  hapusBerkasUnggahan,
  simpanGambar,
} from "./berkas-unggahan";
import { db } from "./db";
import { kategori } from "./db/schema";

/** Kategori untuk ditampilkan: nama dan alamat gambar ikonnya. */
type Kategori = { id: string; nama: string; alamatIkon: string };

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
 * berkasnya ditolak, Kategori tidak dibuat.
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

  await db.insert(kategori).values({ nama, ikon: gambar.nama });
  return { hasil: "dibuat" } as const;
}

/**
 * Mengubah nama Kategori, dan gambar ikonnya bila Admin memilih gambar baru. Tanpa gambar baru,
 * ikon lama tetap dipakai. Berkas ikon yang diganti dihapus dari folder unggahan.
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
  const hasil = await db.transaction(async (tx) => {
    // Baris dikunci supaya dua Admin yang mengganti ikon bersamaan tidak meninggalkan berkas yatim.
    const [lama] = await tx
      .select({ ikon: kategori.ikon })
      .from(kategori)
      .where(eq(kategori.id, id))
      .for("update");
    if (!lama) return { hasil: "tidak-ada" } as const;

    if (!ikon) {
      await tx.update(kategori).set({ nama }).where(eq(kategori.id, id));
      return { hasil: "diubah", ikonDiganti: null } as const;
    }

    const gambar = await simpanGambar(ikon);
    if (gambar.hasil === "ditolak") return gambar;
    await tx
      .update(kategori)
      .set({ nama, ikon: gambar.nama })
      .where(eq(kategori.id, id));
    return { hasil: "diubah", ikonDiganti: lama.ikon } as const;
  });

  if (hasil.hasil !== "diubah") return hasil;
  if (hasil.ikonDiganti) await hapusBerkasUnggahan(hasil.ikonDiganti);
  return { hasil: "diubah" } as const;
}
