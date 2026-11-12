// Email tiruan untuk pengembangan dan test: tidak mengirim apa pun, hanya menyimpan setiap email di memori
// proses ini supaya bisa dibaca test lewat emailTiruanKe.
import type { Email, PengirimEmail } from "./email";

// Email yang sudah "dikirim", urut menurut waktu kirim. Disimpan di globalThis, karena Next.js bisa memuat
// modul ini lebih dari sekali dalam satu proses server, padahal semua pengirim harus menyimpan ke tempat
// yang sama. Data ini hilang saat proses berhenti.
const wadah = globalThis as typeof globalThis & { __emailTiruan?: Email[] };
const terkirim = (wadah.__emailTiruan ??= []);

export const emailTiruan: PengirimEmail = {
  async kirim(email) {
    terkirim.push(email);
  },
};

/** Email tiruan yang sudah dikirim ke alamat itu di proses ini, urut menurut waktu kirim. */
export function emailTiruanKe(kepada: string) {
  return terkirim.filter((email) => email.kepada === kepada);
}
