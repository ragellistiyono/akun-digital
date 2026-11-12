// Adaptor email Resend (PRD §10.1): mengirim lewat HTTP API Resend dengan fetch, tanpa dependency baru.
// RESEND_API_KEY hanya dibaca di server, saat email dikirim, dan tidak pernah ikut dalam pesan galat.
import type { PengirimEmail } from "./email";

const ALAMAT_API = "https://api.resend.com/emails";

/** Batas waktu menunggu jawaban Resend, supaya pekerjaan latar tidak tertahan oleh Resend yang tidak menjawab. */
const BATAS_TUNGGU_MS = 15_000;

/** Panjang terbesar isi jawaban gagal Resend yang ikut di pesan galat. */
const PANJANG_JAWABAN_DI_GALAT = 500;

export const emailResend: PengirimEmail = {
  async kirim({ dari, kepada, subjek, teks, html }) {
    const kunci = process.env.RESEND_API_KEY?.trim() ?? "";
    if (kunci === "") {
      throw new Error(
        "RESEND_API_KEY kosong, jadi email tidak bisa dikirim lewat Resend. Isi RESEND_API_KEY di berkas .env dengan API key dari Dashboard Resend → API Keys, lalu jalankan ulang aplikasinya.",
      );
    }

    const jawaban = await fetch(ALAMAT_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kunci}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: dari,
        to: [kepada],
        subject: subjek,
        text: teks,
        html,
      }),
      signal: AbortSignal.timeout(BATAS_TUNGGU_MS),
    });
    if (!jawaban.ok) {
      const isi = (await jawaban.text().catch(() => "")).slice(
        0,
        PANJANG_JAWABAN_DI_GALAT,
      );
      throw new Error(
        `Resend menolak email ke ${kepada} dengan HTTP ${jawaban.status}: ${isi}. Periksa RESEND_API_KEY, domain pengirim EMAIL_FROM yang sudah diverifikasi di Resend, dan batas kiriman paket Resend.`,
      );
    }
  },
};
