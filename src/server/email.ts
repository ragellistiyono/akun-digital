// Satu adaptor untuk semua email yang dikirim toko (PRD §10.1). EMAIL_MODE memilih implementasinya:
// - `resend` mengirim lewat HTTP API Resend (email-resend.ts);
// - `tiruan` menyimpan email di memori proses supaya bisa dibaca test, untuk pengembangan dan test
//   (email-tiruan.ts).
import { emailResend } from "./email-resend";
import { emailTiruan } from "./email-tiruan";

/** Satu email yang dikirim toko, dengan isi teks biasa dan HTML yang sama. */
export type Email = {
  /** Pengirim, misalnya `MIWE Digital Store <no-reply@miwe.example>`. */
  dari: string;
  kepada: string;
  subjek: string;
  teks: string;
  html: string;
};

/** Antarmuka adaptor email. Setiap kegagalan, termasuk layanan email yang menolak atau tidak menjawab, dilempar. */
export type PengirimEmail = {
  kirim(email: Email): Promise<void>;
};

/**
 * Adaptor email menurut EMAIL_MODE. Dibaca saat dipakai, bukan saat modul dimuat, supaya `next build`
 * tidak membutuhkannya.
 */
export function pengirimEmailAktif(): PengirimEmail {
  const mode = process.env.EMAIL_MODE?.trim() ?? "";
  if (mode === "resend") return emailResend;
  if (mode === "tiruan") return emailTiruan;
  throw new Error(
    `EMAIL_MODE bernilai "${mode}", padahal hanya "resend" dan "tiruan" yang dikenal, jadi email tidak bisa dikirim. Isi EMAIL_MODE=resend di server, atau EMAIL_MODE=tiruan untuk pengembangan, di berkas .env, lalu jalankan ulang aplikasinya.`,
  );
}
