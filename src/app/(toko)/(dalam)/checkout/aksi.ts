"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { buatPesanan } from "@/server/pesanan";

export type KeadaanFormCheckout = {
  email: string;
  galat?: { email?: string; checkout?: string };
};

const PESAN_EMAIL_KOSONG =
  "Email belum diisi. Tulis email Anda, misalnya nama@email.com, supaya detail pesanan bisa dikirim.";

// Isian email yang tidak terkirim sama sekali diperlakukan sama dengan email kosong.
const Email = z
  .string({ error: PESAN_EMAIL_KOSONG })
  .trim()
  .min(1, PESAN_EMAIL_KOSONG)
  .pipe(
    z.email(
      "Email ini belum lengkap atau salah tulis. Tulis email yang lengkap, misalnya nama@email.com.",
    ),
  );

const PESAN_TIDAK_DIJUAL =
  "Produk atau Varian ini sedang tidak dijual, jadi Pesanan tidak dibuat. Pilih Produk lain di Beranda.";

const PESAN_STOK_HABIS =
  "Stok Varian ini sudah habis, jadi Pesanan tidak dibuat. Pilih Varian lain, atau Produk lain di Beranda.";

const PESAN_QRIS_GAGAL =
  "QRIS gagal dibuat, jadi Pesanan belum dibuat. Tekan Bayar dengan QRIS untuk mencoba lagi.";

/**
 * Checkout satu Varian (PRD §5.1, §5.2): membuat Pesanan beserta QRIS-nya, lalu mengarahkan Pembeli ke
 * Tautan Pesanan, yang menampilkan Halaman bayar.
 */
export async function aksiCheckout(
  _sebelumnya: KeadaanFormCheckout,
  formData: FormData,
): Promise<KeadaanFormCheckout> {
  // Checkout terbuka untuk Tamu (PRD §2.1), dan login Member baru ada di M2, jadi tidak ada sesi yang
  // dibaca atau kewenangan yang diperiksa.
  const isianEmail = formData.get("email");
  // Email yang diketik Pembeli dikembalikan apa adanya untuk mengisi ulang form.
  const email = typeof isianEmail === "string" ? isianEmail : "";
  const masukanEmail = Email.safeParse(isianEmail);
  if (!masukanEmail.success) {
    return { email, galat: { email: masukanEmail.error.issues[0].message } };
  }
  const varianId = z.uuid().safeParse(formData.get("varianId"));
  if (!varianId.success) {
    return { email, galat: { checkout: PESAN_TIDAK_DIJUAL } };
  }

  const hasil = await buatPesanan({
    varianId: varianId.data,
    email: masukanEmail.data,
  });
  if (hasil.hasil === "tidak-dijual") {
    return { email, galat: { checkout: PESAN_TIDAK_DIJUAL } };
  }
  if (hasil.hasil === "stok-habis") {
    return { email, galat: { checkout: PESAN_STOK_HABIS } };
  }
  if (hasil.hasil === "qris-gagal") {
    return { email, galat: { checkout: PESAN_QRIS_GAGAL } };
  }
  redirect(`/pesanan/${hasil.tautan}`);
}
