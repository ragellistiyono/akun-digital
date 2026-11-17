import { z } from "zod";

import { emailTiruanKe } from "@/server/email-tiruan";

const teks = (isi: string, status: number) =>
  new Response(isi, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

// Pembaca email tiruan untuk test e2e: email yang sudah "dikirim" ke alamat `kepada` oleh proses server
// ini, urut menurut waktu kirim, sebagai JSON [{ subjek, teks }]. Email tiruan hanya tersimpan di memori
// proses server, jadi test e2e yang berjalan di proses lain membacanya lewat sini. Hanya aktif bila
// EMAIL_MODE=tiruan; di server toko (EMAIL_MODE=resend) alamat ini selalu 404.
export function GET(request: Request) {
  if (process.env.EMAIL_MODE?.trim() !== "tiruan") {
    return teks(
      "Pembaca email tiruan hanya aktif bila EMAIL_MODE=tiruan, jadi tidak ada email yang dibaca. Jalankan toko dengan EMAIL_MODE=tiruan untuk memakainya.",
      404,
    );
  }
  const kepada = z
    .email()
    .safeParse(new URL(request.url).searchParams.get("kepada"));
  if (!kepada.success) {
    return teks(
      "Parameter kepada tidak berisi email yang sah, jadi tidak ada email yang dibaca. Tambahkan ?kepada=<email> pada alamatnya.",
      400,
    );
  }
  return Response.json(
    emailTiruanKe(kepada.data).map(({ subjek, teks }) => ({ subjek, teks })),
  );
}
