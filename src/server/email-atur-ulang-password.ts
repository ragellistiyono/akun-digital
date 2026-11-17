// Email "Atur ulang password" (PRD §7.5, §10.2 ▶ Keputusan 2026-11-17): Tautan atur ulang password untuk
// Member, dengan masa berlakunya dan footer WhatsApp yang sama seperti email "Pesanan selesai".
import { z } from "zod";

import { aman, footerWhatsapp } from "./bagian-email";
import type { Email } from "./email";
import { bacaPengaturanToko } from "./pengaturan-toko";

const PESAN =
  "Buka tautan berikut untuk membuat password baru. Tautan berlaku 30 menit dan hanya bisa dipakai sekali. Abaikan email ini bila Anda tidak memintanya, password Anda tidak berubah.";

/** Variabel lingkungan wajib yang dibaca saat dipakai, bukan saat modul dimuat, supaya `next build` tidak membutuhkannya. */
function bacaWajib(nama: "EMAIL_FROM" | "APP_URL", contoh: string) {
  const nilai = process.env[nama]?.trim() ?? "";
  if (nilai === "") {
    throw new Error(
      `${nama} kosong, jadi email "Atur ulang password" tidak bisa dikirim. Isi ${nama} di berkas .env, misalnya ${contoh}, lalu jalankan ulang aplikasinya.`,
    );
  }
  return nilai;
}

const AlamatToko = z.url({ protocol: /^https?$/ });

/** Tautan atur ulang password sebagai alamat lengkap di APP_URL, yaitu alamat toko (PRD §12 ▶ Keputusan 2026-11-15). */
function alamatTautan(tautan: string) {
  const alamatToko = bacaWajib("APP_URL", "https://miwe.example");
  if (!AlamatToko.safeParse(alamatToko).success) {
    throw new Error(
      `APP_URL bernilai "${alamatToko}", padahal harus alamat http atau https, jadi Tautan atur ulang password tidak bisa dibuat. Perbaiki APP_URL di berkas .env, misalnya https://miwe.example, lalu jalankan ulang aplikasinya.`,
    );
  }
  return `${alamatToko.replace(/\/+$/, "")}/atur-ulang-password/${tautan}`;
}

/**
 * Email "Atur ulang password" untuk email itu, berbahasa Indonesia, sebagai teks biasa dan HTML. `tautan`
 * adalah bagian acak Tautan atur ulang password, yang dijadikan alamat lengkap di APP_URL. Nomor WhatsApp di
 * footer dibaca dari Pengaturan toko saat email dibuat. HTML-nya tanpa warna, sama seperti email lain.
 */
export async function emailAturUlangPassword({
  kepada,
  tautan,
}: {
  kepada: string;
  tautan: string;
}): Promise<Email> {
  const dari = bacaWajib(
    "EMAIL_FROM",
    "MIWE Digital Store <no-reply@miwe.example>",
  );
  const alamat = alamatTautan(tautan);
  const { nomorWhatsapp } = await bacaPengaturanToko();
  const footer = footerWhatsapp(nomorWhatsapp);

  const teks = [
    "Atur ulang password",
    "",
    PESAN,
    "",
    alamat,
    ...footer.teks,
  ].join("\n");
  const html = [
    `<div style="font-family:Manrope,system-ui,sans-serif;font-size:15px;line-height:1.5">`,
    `<h1 style="font-size:22px;margin:0 0 16px">Atur ulang password</h1>`,
    `<p style="margin:0 0 16px">${aman(PESAN)}</p>`,
    `<p style="margin:0 0 16px"><a href="${aman(alamat)}" style="word-break:break-all">${aman(alamat)}</a></p>`,
    ...footer.html,
    `</div>`,
  ].join("\n");

  return { dari, kepada, subjek: "Atur ulang password", teks, html };
}
