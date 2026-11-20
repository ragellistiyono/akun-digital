"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { nomorTopUpSah } from "@/domain/nomor-top-up";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { batalkanTopUp } from "@/server/top-up";

import type { KeadaanPembatalan } from "../../../pesanan/[tautan]/aksi";

const PESAN_TIDAK_DIKENAL =
  "Top up ini tidak ditemukan di akun Anda, jadi tidak ada yang dibatalkan. Buka lagi tab Akun.";

const PESAN_GAGAL =
  "Top up belum bisa dibatalkan karena Qrispy belum membatalkan QRIS-nya, jadi Top up masih Menunggu Pembayaran. Tekan Batalkan sekali lagi untuk mencoba lagi.";

const PESAN_SUDAH_DIBAYAR =
  "Pembayaran Anda sudah masuk, jadi Top up tidak dibatalkan. Saldo bertambah setelah pembayarannya diproses.";

const NomorTopUp = z.string().refine(nomorTopUpSah);

/**
 * Tombol "Batalkan" di Halaman bayar Top up (PRD §15.3, mengikuti §5.8): langsung membatalkan Top up milik Member
 * yang login, tanpa dialog, lalu Member kembali ke tab Akun. Top up yang ternyata sudah tidak Menunggu Pembayaran juga
 * membawa Member ke tab Akun. Bila QRIS-nya ternyata sudah dibayar, atau pembatalannya gagal, Member tetap di Halaman
 * bayar Top up dengan pesannya. Permintaan tanpa sesi Member dibawa ke halaman Masuk.
 */
export async function aksiBatalkanTopUp(
  _sebelumnya: KeadaanPembatalan,
  formData: FormData,
): Promise<KeadaanPembatalan> {
  const sesiMember = await bacaSesiMember(await headers());
  if (!sesiMember) redirect("/masuk");
  const nomor = NomorTopUp.safeParse(formData.get("nomorTopUp"));
  if (!nomor.success) return { galat: PESAN_TIDAK_DIKENAL };

  const pembatalan = await batalkanTopUp({
    nomorTopUp: nomor.data,
    idMember: sesiMember.user.id,
  });
  switch (pembatalan.hasil) {
    case "tidak-ditemukan":
      return { galat: PESAN_TIDAK_DIKENAL };
    case "gagal":
      return { galat: PESAN_GAGAL };
    case "sudah-dibayar":
      return { galat: PESAN_SUDAH_DIBAYAR };
    case "dibatalkan":
    case "tidak-bisa-dibatalkan":
      redirect("/akun");
  }
}
