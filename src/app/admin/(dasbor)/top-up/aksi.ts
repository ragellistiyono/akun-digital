"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CARA_PENYELESAIAN_TOP_UP } from "@/domain/penyelesaian-top-up-bermasalah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { selesaikanTopUpBermasalah } from "@/server/top-up-admin";

/** Hasil "Tambahkan ke saldo" atau "Dana Dikembalikan" yang ditolak, untuk ditampilkan di detail Top up. */
export type KeadaanPenyelesaianTopUp = { galat?: string };

/** Cara penyelesaian dari tombol yang ditekan. */
const CaraPenyelesaian = z.enum(CARA_PENYELESAIAN_TOP_UP);

const PESAN_CARA_TIDAK_DIKENAL =
  'Pilihan penyelesaian tidak dikenal, jadi Top up ini tidak diubah. Muat ulang halaman, lalu tekan "Tambahkan ke saldo" atau "Tandai Dana Dikembalikan".';

/** Pesan bila penyelesaian tidak tersedia untuk Top up berstatus itu (penyelesaianTopUpBermasalahTersedia). */
const pesanTidakTersedia = (status: string) =>
  `Top up ini tidak diubah, karena berstatus ${status}, padahal "Tambahkan ke saldo" dan "Tandai Dana Dikembalikan" hanya tersedia untuk Top up Bermasalah. Muat ulang halaman untuk melihat status terbarunya.`;

/** Penyelesaian Top up Bermasalah di detail Top up dasbor admin (PRD §15.9). */
export async function aksiSelesaikanTopUpBermasalah(
  _sebelumnya: KeadaanPenyelesaianTopUp,
  formData: FormData,
): Promise<KeadaanPenyelesaianTopUp> {
  await wajibSesiAdmin(await headers());

  const topUpId = z.uuid().safeParse(formData.get("topUpId"));
  if (!topUpId.success) notFound();
  const cara = CaraPenyelesaian.safeParse(formData.get("cara"));
  if (!cara.success) return { galat: PESAN_CARA_TIDAK_DIKENAL };

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk menyelesaikan.
  const hasil = await selesaikanTopUpBermasalah({
    topUpId: topUpId.data,
    cara: cara.data,
  });
  switch (hasil.hasil) {
    case "tidak-ada":
      notFound();
    case "tidak-tersedia":
      return { galat: pesanTidakTersedia(hasil.status) };
    case "diselesaikan":
      // Detail Top up dibuat ulang dengan status barunya, begitu pula saldo di halaman Member.
      revalidatePath("/admin", "layout");
      return {};
  }
}
