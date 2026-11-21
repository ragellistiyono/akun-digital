import { cookies } from "next/headers";

import { nomorTopUpSah } from "@/domain/nomor-top-up";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { cekStatusPembayaranTopUp } from "@/server/kabar-pembayaran-top-up";
import { bacaTopUpMember } from "@/server/top-up";

import { pasangPesanTopUp } from "../../../riwayat-saldo/pesan-top-up";

const teks = (isi: string, status: number) =>
  new Response(isi, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

const tidakDitemukan = () =>
  teks(
    "Top up ini tidak ditemukan di akun Anda, jadi statusnya tidak bisa dibaca. Buka lagi tab Akun.",
    404,
  );

// Status Top up yang ditanyakan Halaman bayar Top up secara berkala (ADR-0004: Halaman bayar menanyakan status ke
// server toko, bukan ke Qrispy). Hanya Member pemilik Top up itu yang boleh membacanya. Jalur cek status ke Qrispy
// dijalankan dulu, paling sering sekali per 15 detik untuk setiap Top up, supaya pembayaran yang sudah masuk terbaca
// tanpa Halaman bayar Top up dimuat ulang. Jawaban Berhasil juga memasang pesan "Top up Rp X berhasil", karena
// Halaman bayar Top up yang bertanya akan berpindah sendiri ke Riwayat saldo (PRD §15.3 ▶ Keputusan 2026-11-21, issue 240).
export async function GET(
  request: Request,
  { params }: RouteContext<"/akun/top-up/[nomor]/status">,
) {
  const sesiMember = await bacaSesiMember(request.headers);
  if (!sesiMember) {
    return teks(
      "Anda belum login sebagai Member, jadi status Top up tidak bisa dibaca. Login lagi, lalu buka Top up dari tab Akun.",
      401,
    );
  }
  const { nomor } = await params;
  const idMember = sesiMember.user.id;
  if (!nomorTopUpSah(nomor)) return tidakDitemukan();
  await cekStatusPembayaranTopUp(nomor, idMember);
  const topUp = await bacaTopUpMember({ nomorTopUp: nomor, idMember });
  if (!topUp) return tidakDitemukan();
  if (topUp.status === "Berhasil") {
    pasangPesanTopUp(await cookies(), "berhasil", nomor);
  }
  return Response.json(
    { status: topUp.status },
    { headers: { "Cache-Control": "no-store" } },
  );
}
