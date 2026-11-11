// Penyimpanan berkas unggahan Admin di folder UPLOAD_DIR: ikon Kategori, dan nanti Foto Produk.
// Berkas disajikan ke pengunjung lewat rute toko src/app/(toko)/unggahan/[nama].
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type HasilSimpanGambar =
  | { hasil: "disimpan"; nama: string }
  | { hasil: "ditolak"; alasan: "bukan-gambar" | "terlalu-besar" };

/** Batas ukuran satu gambar unggahan, dalam MB. */
export const BATAS_UKURAN_GAMBAR_MB = 2;
const BATAS_UKURAN_GAMBAR_BYTE = BATAS_UKURAN_GAMBAR_MB * 1024 * 1024;

type JenisGambar = {
  ekstensi: string;
  jenis: string;
  cocok: (isi: Uint8Array) => boolean;
};

const awalan = (isi: Uint8Array, byte: number[], mulai = 0) =>
  byte.every((nilai, i) => isi[mulai + i] === nilai);
const ascii = (teks: string) => [...teks].map((huruf) => huruf.charCodeAt(0));

// Jenis gambar dikenali dari byte awal isinya, bukan dari nama berkas atau jenis yang dikirim browser,
// supaya berkas lain yang diberi nama .png tetap ditolak. SVG sengaja tidak diterima karena bisa
// memuat skrip.
const JENIS_GAMBAR: JenisGambar[] = [
  {
    ekstensi: "png",
    jenis: "image/png",
    cocok: (isi) =>
      awalan(isi, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    ekstensi: "jpg",
    jenis: "image/jpeg",
    cocok: (isi) => awalan(isi, [0xff, 0xd8, 0xff]),
  },
  {
    ekstensi: "webp",
    jenis: "image/webp",
    cocok: (isi) => awalan(isi, ascii("RIFF")) && awalan(isi, ascii("WEBP"), 8),
  },
];

// Nama berkas yang dibuat simpanGambar: UUID acak dan ekstensi jenis gambarnya. Nama lain, termasuk
// yang memuat "/" atau "..", tidak pernah dibaca dari folder unggahan.
const POLA_NAMA_BERKAS =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.([a-z]+)$/;

/** Folder unggahan dari UPLOAD_DIR. Dibaca saat dipakai, supaya `next build` tidak membutuhkannya. */
function folderUnggahan() {
  const folder = process.env.UPLOAD_DIR;
  if (!folder) {
    throw new Error(
      "UPLOAD_DIR kosong, jadi berkas unggahan tidak bisa disimpan atau dibaca. Salin baris UPLOAD_DIR dari `.env.example` ke `.env`, lalu jalankan ulang aplikasinya.",
    );
  }
  return path.resolve(folder);
}

/**
 * Lokasi sebuah berkas di folder unggahan. Folder itu berada di luar kode aplikasi, jadi Turbopack
 * diminta tidak menelusurinya saat build.
 */
function lokasiBerkas(nama: string) {
  return path.join(/* turbopackIgnore: true */ folderUnggahan(), nama);
}

/**
 * Menyimpan gambar unggahan Admin (PNG, JPEG, atau WebP, paling besar 2 MB) dengan nama berkas acak
 * di folder unggahan. Berkas yang bukan gambar atau terlalu besar ditolak dan tidak ditulis.
 */
export async function simpanGambar(berkas: File): Promise<HasilSimpanGambar> {
  if (berkas.size > BATAS_UKURAN_GAMBAR_BYTE) {
    return { hasil: "ditolak", alasan: "terlalu-besar" };
  }
  const isi = new Uint8Array(await berkas.arrayBuffer());
  const jenis = JENIS_GAMBAR.find(({ cocok }) => cocok(isi));
  if (!jenis) return { hasil: "ditolak", alasan: "bukan-gambar" };

  const nama = `${randomUUID()}.${jenis.ekstensi}`;
  await mkdir(folderUnggahan(), { recursive: true });
  await writeFile(lokasiBerkas(nama), isi);
  return { hasil: "disimpan", nama };
}

/** Alamat gambar unggahan di toko, yang disajikan oleh rute src/app/(toko)/unggahan/[nama]. */
export function alamatBerkasUnggahan(nama: string) {
  return `/unggahan/${nama}`;
}

/** Isi dan jenis sebuah gambar unggahan, atau null bila nama itu bukan gambar unggahan yang ada. */
export async function bacaBerkasUnggahan(
  nama: string,
): Promise<{ isi: Uint8Array<ArrayBuffer>; jenis: string } | null> {
  const ekstensi = POLA_NAMA_BERKAS.exec(nama)?.[1];
  const jenis = JENIS_GAMBAR.find((j) => j.ekstensi === ekstensi);
  if (!jenis) return null;

  try {
    const isi = await readFile(lokasiBerkas(nama));
    return { isi: new Uint8Array(isi), jenis: jenis.jenis };
  } catch (galat) {
    if (galat instanceof Error && "code" in galat && galat.code === "ENOENT") {
      return null;
    }
    throw galat;
  }
}

/** Menghapus gambar unggahan yang tidak dipakai lagi. Nama yang bukan gambar unggahan diabaikan. */
export async function hapusBerkasUnggahan(nama: string) {
  if (!POLA_NAMA_BERKAS.test(nama)) return;
  await rm(lokasiBerkas(nama), { force: true });
}
