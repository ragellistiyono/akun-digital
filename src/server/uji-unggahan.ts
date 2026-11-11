// Bahan bersama untuk test yang memakai folder unggahan test. Berkas ini hanya diimpor oleh test.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { parse } from "dotenv";

/**
 * Folder unggahan test, dibaca langsung dari .env.ci dan bukan dari process.env, supaya test gagal
 * bila ternyata menulis ke folder lain.
 */
export const FOLDER_UNGGAHAN_TEST = path.resolve(
  parse(readFileSync(".env.ci")).UPLOAD_DIR ?? "",
);

/** Gambar PNG 1×1 piksel yang sah. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Isi berkas berawalan PNG yang unik per pemanggilan, supaya test bisa memastikan isi itu tidak
 * tertulis walaupun test lain menulis ke folder yang sama pada saat bersamaan.
 */
export function pngUnik(ukuran = PNG.length + 36) {
  const isi = Buffer.alloc(ukuran);
  PNG.copy(isi);
  isi.write(randomUUID(), ukuran - 36);
  return isi;
}

/** Apakah ada berkas di folder unggahan test yang isinya persis sama. */
export async function adaBerkasBerisi(isi: Buffer) {
  const semuaNama = await readdir(FOLDER_UNGGAHAN_TEST).catch(() => []);
  for (const nama of semuaNama) {
    const lokasi = path.join(FOLDER_UNGGAHAN_TEST, nama);
    // Berkas bisa saja dihapus test lain di antara readdir dan stat.
    const info = await stat(lokasi).catch(() => null);
    if (info?.size !== isi.length) continue;
    if (isi.equals(await readFile(lokasi).catch(() => Buffer.alloc(0)))) {
      return true;
    }
  }
  return false;
}
