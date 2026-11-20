"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  type AlasanIsianTopUp,
  NOMINAL_TOP_UP_MAKSIMAL,
  NOMINAL_TOP_UP_MINIMAL,
} from "@/domain/isian-top-up";
import { rupiah } from "@/lib/rupiah";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { buatTopUp } from "@/server/top-up";

import { PARAMETER_ALAMAT_KEMBALI } from "../../masuk/alamat-kembali";

/** Alamat Halaman Top up. */
const ALAMAT_TOP_UP = "/akun/top-up";

/** Keadaan form Top up setelah "Bayar dengan QRIS" ditolak. */
export type KeadaanFormTopUp = { galat?: string };

// Pesan "minimal" dan "maksimal" persis seperti PRD §15.3. Pesan isian kosong dan bukan rupiah bulat menyebut sebabnya
// dan langkah berikutnya, mengikuti pola isian rupiah lain (PRD §14.3 ▶ Keputusan 2026-11-20).
const PESAN_ISIAN: Record<AlasanIsianTopUp, string> = {
  kosong:
    "Nominal top up belum diisi. Ketik nominalnya dalam rupiah, misalnya 50.000, atau tekan salah satu tombol nominal.",
  "bukan-rupiah-bulat":
    "Nominal top up harus rupiah bulat tanpa sen, misalnya 50.000. Hapus huruf, tanda minus, dan angka di belakang koma.",
  "di-bawah-minimal": `Nominal top up minimal ${rupiah(NOMINAL_TOP_UP_MINIMAL)}.`,
  "di-atas-maksimal": `Nominal top up maksimal ${rupiah(NOMINAL_TOP_UP_MAKSIMAL)}.`,
};

const PESAN_QRIS_GAGAL =
  "QRIS gagal dibuat, jadi Top up belum dibuat. Tekan Bayar dengan QRIS untuk mencoba lagi.";

const MasukanTopUp = z.object({ nominal: z.string() });

/**
 * "Bayar dengan QRIS" di Halaman Top up (PRD §15.3). Hanya Member yang login bisa top up; permintaan tanpa sesi
 * Member dibawa ke halaman Masuk, lalu kembali ke Halaman Top up. Top up yang dibuat, dan Top up Menunggu Pembayaran
 * yang masih ada, dibuka di Halaman bayar Top up-nya. Isian yang ditolak dan QRIS yang gagal dibuat tampil sebagai
 * pesan di bawah isian.
 */
export async function aksiBuatTopUp(
  _sebelumnya: KeadaanFormTopUp,
  formData: FormData,
): Promise<KeadaanFormTopUp> {
  const sesiMember = await bacaSesiMember(await headers());
  if (!sesiMember) {
    redirect(
      `/masuk?${new URLSearchParams({ [PARAMETER_ALAMAT_KEMBALI]: ALAMAT_TOP_UP })}`,
    );
  }
  const masukan = MasukanTopUp.safeParse({
    nominal: formData.get("nominal") ?? "",
  });
  if (!masukan.success) return { galat: PESAN_ISIAN.kosong };

  const hasil = await buatTopUp({
    idMember: sesiMember.user.id,
    nominal: masukan.data.nominal,
  });
  switch (hasil.hasil) {
    case "ditolak":
      return { galat: PESAN_ISIAN[hasil.alasan] };
    case "qris-gagal":
      return { galat: PESAN_QRIS_GAGAL };
    case "dibuat":
    case "menunggu":
      redirect(`${ALAMAT_TOP_UP}/${hasil.nomorTopUp}`);
  }
}
