"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { buatPesanan, TautanPesanan } from "@/server/pesanan";
import { jamWibDibulatkanKeAtas } from "@/server/zona-waktu-toko";

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

/** Pesan PRD §5.4 ▶ Keputusan 2026-11-11, tanpa tautan ke Pesanan itu dan tanpa tombol batal. */
const pesanPesananMenunggu = (kedaluwarsaPada: Date) =>
  `Email ini masih punya Pesanan yang menunggu pembayaran sampai pukul ${jamWibDibulatkanKeAtas(kedaluwarsaPada)} WIB. Lanjutkan dari perangkat tempat Anda memesan, atau checkout lagi setelah waktu itu.`;

/**
 * Cookie httpOnly berisi Tautan Pesanan yang dibuat di browser ini, dipisah titik, dengan yang terbaru di
 * akhir. Dengan cookie ini, checkout lagi dari browser yang sama diarahkan ke Pesanan yang masih menunggu
 * (PRD §5.4 ▶ Keputusan 2026-11-11).
 */
const COOKIE_TAUTAN_PESANAN = "tautan-pesanan";
const PEMISAH_TAUTAN = ".";

/** Tautan Pesanan terbaru yang disimpan cookie itu. Yang lebih lama dibuang. */
const BATAS_TAUTAN_DI_COOKIE = 20;

/**
 * Cookie itu bertahan satu jam sejak Pesanan terakhir di browser ini, empat kali masa berlaku QRIS 15 menit
 * (PRD §5.8), supaya Tautan Pesanan tidak tersimpan di browser lebih lama dari yang dibutuhkan.
 */
const UMUR_COOKIE_DETIK = 60 * 60;

/** Tautan Pesanan yang sah di cookie browser. Isi cookie yang tidak berbentuk Tautan Pesanan diabaikan. */
function tautanDiBrowser(isiCookie: string | undefined) {
  return (isiCookie ?? "")
    .split(PEMISAH_TAUTAN)
    .filter((tautan) => TautanPesanan.safeParse(tautan).success);
}

/**
 * Checkout satu Varian (PRD §5.1, §5.2): membuat Pesanan beserta QRIS-nya, menyimpan Tautan Pesanan-nya di
 * cookie browser ini, lalu mengarahkan Pembeli ke Tautan Pesanan, yang menampilkan Halaman bayar.
 *
 * Bila email itu masih punya Pesanan Menunggu Pembayaran (PRD §5.4), Pembeli diarahkan ke Pesanan itu bila
 * Pesanan itu dibuat di browser ini, dan ditolak dengan pesan berisi jam kedaluwarsanya bila tidak.
 */
export async function aksiCheckout(
  _sebelumnya: KeadaanFormCheckout,
  formData: FormData,
): Promise<KeadaanFormCheckout> {
  // Checkout terbuka untuk Tamu (PRD §2.1), dan login Member baru ada di M2, jadi tidak ada sesi yang
  // dibaca. Yang dibaca hanya Tautan Pesanan yang dibuat di browser ini.
  const tokoCookie = await cookies();
  const tautanBrowserIni = tautanDiBrowser(
    tokoCookie.get(COOKIE_TAUTAN_PESANAN)?.value,
  );
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
    tautanDiBrowser: tautanBrowserIni,
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
  if (hasil.hasil === "pesanan-menunggu-di-browser-lain") {
    return {
      email,
      galat: { checkout: pesanPesananMenunggu(hasil.kedaluwarsaPada) },
    };
  }
  if (hasil.hasil === "dibuat") {
    tokoCookie.set(
      COOKIE_TAUTAN_PESANAN,
      [...tautanBrowserIni, hasil.tautan]
        .slice(-BATAS_TAUTAN_DI_COOKIE)
        .join(PEMISAH_TAUTAN),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: UMUR_COOKIE_DETIK,
      },
    );
  }
  redirect(`/pesanan/${hasil.tautan}`);
}
