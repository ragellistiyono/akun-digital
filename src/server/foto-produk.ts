// Foto Produk (PRD §3.3): berkas gambar di folder unggahan (berkas-unggahan.ts), dengan urutannya di
// kolom produk.foto. Aturan batas 5 foto dan foto sampul ada di src/domain/foto-produk.ts.
import { eq } from "drizzle-orm";

import {
  fotoSampul,
  hapusFoto,
  pindahkanFoto,
  tambahFoto,
} from "@/domain/foto-produk";

import {
  alamatBerkasUnggahan,
  hapusBerkasUnggahan,
  simpanGambar,
} from "./berkas-unggahan";
import { db } from "./db";
import { produk } from "./db/schema";

type HasilUbahFoto = { sah: true; foto: string[] } | { sah: false };

/** Foto Produk untuk ditampilkan menurut urutannya, dengan tanda foto sampul (PRD §3.3). */
export function fotoUntukTampilan(foto: string[]) {
  const sampul = fotoSampul(foto);
  return foto.map((nama) => ({
    nama,
    alamat: alamatBerkasUnggahan(nama),
    sampul: nama === sampul,
  }));
}

/**
 * Membaca urutan foto sebuah Produk, lalu menyimpan urutan baru dari `ubah` bila hasilnya sah.
 * Hasilnya null bila Produk tidak ada. Baris Produk dikunci selama itu, supaya dua Admin yang
 * mengubah foto bersamaan tidak saling menimpa dan batas 5 foto tetap berlaku.
 */
async function ubahFoto<H extends HasilUbahFoto>(
  produkId: string,
  ubah: (foto: string[]) => H,
): Promise<H | null> {
  return db.transaction(async (tx) => {
    const [lama] = await tx
      .select({ foto: produk.foto })
      .from(produk)
      .where(eq(produk.id, produkId))
      .for("update");
    if (!lama) return null;

    const hasil = ubah(lama.foto);
    if (hasil.sah) {
      await tx
        .update(produk)
        .set({ foto: hasil.foto })
        .where(eq(produk.id, produkId));
    }
    return hasil;
  });
}

/**
 * Menyimpan foto baru di urutan terakhir Produk. Gambarnya disimpan di folder unggahan lebih dulu;
 * bila berkasnya ditolak, foto tidak ditambahkan. Bila Produk tidak ada, sudah punya 5 foto, atau
 * penulisan database gagal, gambar itu dihapus lagi.
 */
export async function unggahFotoProduk({
  produkId,
  foto,
}: {
  produkId: string;
  foto: File;
}) {
  const gambar = await simpanGambar(foto);
  if (gambar.hasil === "ditolak") return gambar;

  let hasil;
  try {
    hasil = await ubahFoto(produkId, (lama) => tambahFoto(lama, gambar.nama));
  } catch (galat) {
    await hapusBerkasUnggahan(gambar.nama);
    throw galat;
  }

  if (hasil === null) {
    await hapusBerkasUnggahan(gambar.nama);
    return { hasil: "tidak-ada" } as const;
  }
  if (!hasil.sah) {
    await hapusBerkasUnggahan(gambar.nama);
    return { hasil: "melebihi-batas", batas: hasil.batas } as const;
  }
  return { hasil: "diunggah" } as const;
}

/** Memindahkan satu foto Produk ke urutan baru (dari 1). Foto di urutan pertama menjadi sampul. */
export async function pindahkanFotoProduk({
  produkId,
  nama,
  urutan,
}: {
  produkId: string;
  nama: string;
  urutan: number;
}) {
  const hasil = await ubahFoto(produkId, (lama) =>
    pindahkanFoto(lama, nama, urutan),
  );
  if (hasil === null) return { hasil: "tidak-ada" } as const;
  return hasil.sah
    ? ({ hasil: "dipindah" } as const)
    : ({ hasil: "tidak-dipindah" } as const);
}

/**
 * Menghapus satu foto Produk beserta berkasnya di folder unggahan. Hanya foto milik Produk itu yang
 * bisa dihapus. Bila foto pertama dihapus, foto berikutnya menjadi sampul.
 */
export async function hapusFotoProduk({
  produkId,
  nama,
}: {
  produkId: string;
  nama: string;
}) {
  const hasil = await ubahFoto(produkId, (lama) => hapusFoto(lama, nama));
  if (hasil === null) return { hasil: "tidak-ada" } as const;
  if (!hasil.sah) return { hasil: "foto-tidak-ada" } as const;

  await hapusBerkasUnggahan(nama);
  return { hasil: "dihapus" } as const;
}
