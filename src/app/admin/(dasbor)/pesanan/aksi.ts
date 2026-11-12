"use server";

import { refresh, revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CARA_PENYELESAIAN } from "@/domain/penyelesaian-bermasalah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { kirimUlangEmailPesanan } from "@/server/detail-pesanan";
import { selesaikanPesananBermasalah } from "@/server/penyelesaian-bermasalah";

/** Hasil kirim ulang email "Pesanan selesai" untuk ditampilkan di detail Pesanan. */
export type KeadaanKirimUlangEmail = { pesan?: string; galat?: string };

/**
 * Isian email baru yang dikembalikan ke form koreksi email, apa adanya bila ditolak beserta pesan galatnya,
 * atau email yang tersimpan beserta pesan hasilnya.
 */
export type KeadaanKoreksiEmail = {
  email: string;
  pesan?: string;
  galat?: string;
};

/** Hasil Kirim Item stok atau Tandai Dana Dikembalikan yang ditolak, untuk ditampilkan di detail Pesanan. */
export type KeadaanPenyelesaianBermasalah = { galat?: string };

/** Pesanan yang dipilih, dari form. Pesanan dengan id yang tidak sah pasti tidak ada. */
function bacaPesananId(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("pesananId"));
  if (!id.success) notFound();
  return id.data;
}

const PESAN_EMAIL_KOSONG =
  "Email baru belum diisi. Tulis email Pembeli yang benar, misalnya nama@email.com, lalu tekan Simpan dan kirim ulang.";

// Isian email yang tidak terkirim sama sekali diperlakukan sama dengan email kosong.
const EmailBaru = z
  .string({ error: PESAN_EMAIL_KOSONG })
  .trim()
  .min(1, PESAN_EMAIL_KOSONG)
  .pipe(
    z.email(
      "Email baru belum lengkap atau salah tulis. Tulis email yang lengkap, misalnya nama@email.com, lalu tekan Simpan dan kirim ulang.",
    ),
  );

/** Pesan bila kirim ulang tidak tersedia untuk Pesanan berstatus itu (kirimUlangEmailTersedia). */
const pesanTidakTersedia = (status: string) =>
  `Email "Pesanan selesai" tidak dikirim ulang, karena Pesanan ini berstatus ${status}, padahal kirim ulang hanya tersedia untuk Pesanan Selesai. Muat ulang halaman untuk melihat status terbarunya.`;

const KETERANGAN_GAGAL =
  'Bila pengiriman gagal, toko mencoba lagi sendiri beberapa kali, lalu memasang tanda "Email gagal" di Pesanan ini.';

export async function aksiKirimUlangEmail(
  _sebelumnya: KeadaanKirimUlangEmail,
  formData: FormData,
): Promise<KeadaanKirimUlangEmail> {
  await wajibSesiAdmin(await headers());

  const pesananId = bacaPesananId(formData);

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengirim ulang.
  const hasil = await kirimUlangEmailPesanan({ pesananId });
  switch (hasil.hasil) {
    case "tidak-ada":
      notFound();
    case "tidak-tersedia":
      return { galat: pesanTidakTersedia(hasil.status) };
    case "dijadwalkan":
      return {
        pesan: `Email "Pesanan selesai" sedang dikirim ulang ke ${hasil.email}. ${KETERANGAN_GAGAL}`,
      };
  }
}

export async function aksiKoreksiEmail(
  _sebelumnya: KeadaanKoreksiEmail,
  formData: FormData,
): Promise<KeadaanKoreksiEmail> {
  await wajibSesiAdmin(await headers());

  const pesananId = bacaPesananId(formData);
  const isian = formData.get("email");
  // Email yang diketik Admin dikembalikan apa adanya untuk mengisi ulang form.
  const email = typeof isian === "string" ? isian : "";
  const emailBaru = EmailBaru.safeParse(isian);
  if (!emailBaru.success) {
    return { email, galat: emailBaru.error.issues[0].message };
  }

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengoreksi.
  const hasil = await kirimUlangEmailPesanan({
    pesananId,
    emailBaru: emailBaru.data,
  });
  switch (hasil.hasil) {
    case "tidak-ada":
      notFound();
    case "tidak-tersedia":
      return {
        email,
        galat: `Email Pesanan tidak diganti. ${pesanTidakTersedia(hasil.status)}`,
      };
    case "dijadwalkan":
      // Detail Pesanan dibuat ulang, supaya email baru tampil di sana.
      refresh();
      return {
        email: hasil.email,
        pesan: `Email Pesanan diganti menjadi ${hasil.email}, dan email "Pesanan selesai" sedang dikirim ke alamat itu. ${KETERANGAN_GAGAL}`,
      };
  }
}

/** Cara penyelesaian dari tombol yang ditekan, yaitu "Kirim Item stok" atau "Tandai Dana Dikembalikan". */
const CaraPenyelesaian = z.enum(CARA_PENYELESAIAN);

const PESAN_CARA_TIDAK_DIKENAL =
  'Pilihan penyelesaian tidak dikenal, jadi Pesanan ini tidak diubah. Muat ulang halaman, lalu tekan "Kirim Item stok" atau "Tandai Dana Dikembalikan".';

const PESAN_STOK_HABIS =
  'Item stok tidak dikirim, karena Stok Varian Pesanan ini 0, jadi Pesanan tetap Bermasalah. Isi Item stok Varian itu dulu di menu Produk, lalu tekan "Kirim Item stok" lagi. Item stok dari Varian lain tidak bisa dipakai.';

/** Pesan bila penyelesaian tidak tersedia untuk Pesanan berstatus itu (penyelesaianBermasalahTersedia). */
const pesanPenyelesaianTidakTersedia = (status: string) =>
  `Pesanan ini tidak diubah, karena berstatus ${status}, padahal "Kirim Item stok" dan "Tandai Dana Dikembalikan" hanya tersedia untuk Pesanan Bermasalah. Muat ulang halaman untuk melihat status terbarunya.`;

export async function aksiSelesaikanBermasalah(
  _sebelumnya: KeadaanPenyelesaianBermasalah,
  formData: FormData,
): Promise<KeadaanPenyelesaianBermasalah> {
  await wajibSesiAdmin(await headers());

  const pesananId = bacaPesananId(formData);
  const cara = CaraPenyelesaian.safeParse(formData.get("cara"));
  if (!cara.success) return { galat: PESAN_CARA_TIDAK_DIKENAL };

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk menyelesaikan.
  const hasil = await selesaikanPesananBermasalah({
    pesananId,
    cara: cara.data,
  });
  switch (hasil.hasil) {
    case "tidak-ada":
      notFound();
    case "tidak-tersedia":
      return { galat: pesanPenyelesaianTidakTersedia(hasil.status) };
    case "stok-habis":
      return { galat: PESAN_STOK_HABIS };
    case "diselesaikan":
      // Detail Pesanan dibuat ulang dengan status barunya, begitu pula jumlah Pesanan Bermasalah di menu,
      // yang dihitung di layout dasbor admin.
      revalidatePath("/admin", "layout");
      return {};
  }
}
