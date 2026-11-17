// Email "Kode verifikasi" (PRD §7.3, §10.2 ▶ Keputusan 2026-11-17): Kode verifikasi untuk Pendaftar,
// dengan masa berlakunya dan footer WhatsApp yang sama seperti email "Pesanan selesai".
import { aman, footerWhatsapp } from "./bagian-email";
import type { Email } from "./email";
import { bacaPengaturanToko } from "./pengaturan-toko";

const PESAN =
  "Masukkan kode ini untuk menyelesaikan pendaftaran Member MIWE Digital Store. Kode berlaku 10 menit. Abaikan email ini bila Anda tidak mendaftar.";

/** Pengirim email dari EMAIL_FROM, dibaca saat dipakai supaya `next build` tidak membutuhkannya. */
function bacaPengirim() {
  const dari = process.env.EMAIL_FROM?.trim() ?? "";
  if (dari === "") {
    throw new Error(
      'EMAIL_FROM kosong, jadi email "Kode verifikasi" tidak bisa dikirim. Isi EMAIL_FROM di berkas .env, misalnya MIWE Digital Store <no-reply@miwe.example>, lalu jalankan ulang aplikasinya.',
    );
  }
  return dari;
}

/**
 * Email "Kode verifikasi" untuk email itu, berbahasa Indonesia, sebagai teks biasa dan HTML. Subjeknya
 * "Kode verifikasi: <kode>". Nomor WhatsApp di footer dibaca dari Pengaturan toko saat email dibuat.
 * HTML-nya tanpa warna, sama seperti email "Pesanan selesai".
 */
export async function emailKodeVerifikasi({
  kepada,
  kode,
}: {
  kepada: string;
  kode: string;
}): Promise<Email> {
  const dari = bacaPengirim();
  const { nomorWhatsapp } = await bacaPengaturanToko();
  const footer = footerWhatsapp(nomorWhatsapp);

  const teks = ["Kode verifikasi", "", PESAN, "", kode, ...footer.teks].join(
    "\n",
  );
  const html = [
    `<div style="font-family:Manrope,system-ui,sans-serif;font-size:15px;line-height:1.5">`,
    `<h1 style="font-size:22px;margin:0 0 16px">Kode verifikasi</h1>`,
    `<p style="margin:0 0 16px">${aman(PESAN)}</p>`,
    `<p style="margin:0 0 16px;font-size:28px;font-weight:bold;letter-spacing:4px">${aman(kode)}</p>`,
    ...footer.html,
    `</div>`,
  ].join("\n");

  return { dari, kepada, subjek: `Kode verifikasi: ${kode}`, teks, html };
}
