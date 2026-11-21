"use server";

import { cookies, headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";

import { nomorTopUpSah } from "@/domain/nomor-top-up";
import { pesanSudahDibayarTopUpTampil } from "@/domain/pembatalan-top-up";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { bacaTopUpMember, batalkanTopUp } from "@/server/top-up";

import type { KeadaanPembatalan } from "../../../pesanan/[tautan]/aksi";
import { pasangPesanTopUp } from "../../riwayat-saldo/pesan-top-up";

const PESAN_TIDAK_DIKENAL =
  "Top up ini tidak ditemukan di akun Anda, jadi tidak ada yang dibatalkan. Buka lagi tab Akun.";

const PESAN_GAGAL =
  "Top up belum bisa dibatalkan karena Qrispy belum membatalkan QRIS-nya, jadi Top up masih Menunggu Pembayaran. Tekan Batalkan sekali lagi untuk mencoba lagi.";

const NomorTopUp = z.string().refine(nomorTopUpSah);

/**
 * Tombol "Batalkan" di Halaman bayar Top up (PRD §15.3, mengikuti §5.8): langsung membatalkan Top up milik Member
 * yang login, tanpa dialog, lalu Member kembali ke tab Akun. Bila QRIS-nya ternyata sudah dibayar, Top up diproses
 * sebagai sudah dibayar. Bila pesanSudahDibayarTopUpTampil menentukan pesan sudah dibayar tampil, yaitu Top up itu
 * Berhasil, Member dibawa ke Riwayat saldo yang sekali menampilkan "Pembayaran Anda sudah masuk, jadi Top up tidak
 * dibatalkan." sebagai ganti pesan berhasil (PRD §15.3 ▶ Keputusan 2026-11-21, issue 240). Selain itu Member dibawa
 * kembali ke Halaman bayar Top up, yang menampilkan Halaman Top up Bermasalah bila Top up Bermasalah, dan meneruskan
 * Member ke tab Akun untuk status lain. Bila pembatalannya gagal, Member tetap di Halaman bayar Top up
 * dengan pesannya. Permintaan tanpa sesi Member dibawa ke halaman Masuk.
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
    case "dibatalkan":
      redirect("/akun");
    case "sudah-dibayar":
    case "tidak-bisa-dibatalkan": {
      const topUp = await bacaTopUpMember({
        nomorTopUp: nomor.data,
        idMember: sesiMember.user.id,
      });
      if (
        topUp &&
        pesanSudahDibayarTopUpTampil({
          hasil: pembatalan.hasil,
          status: topUp.status,
        })
      ) {
        pasangPesanTopUp(await cookies(), "sudah-dibayar", nomor.data);
        redirect("/akun/riwayat-saldo", RedirectType.replace);
      }
      redirect(`/akun/top-up/${nomor.data}`);
    }
  }
}
