"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { nominalTagihanQris } from "@/domain/total-bayar";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { nilaiVoucher } from "@/server/penilaian-voucher";
import { buatPesanan, TautanPesanan } from "@/server/pesanan";
import { jamWibDibulatkanKeAtas } from "@/server/zona-waktu-toko";

export type KeadaanFormCheckout = {
  email: string;
  kodeVoucher: string;
  galat?: { email?: string; kodeVoucher?: string; checkout?: string };
  /**
   * Voucher ditolak karena khusus Member, sehingga pesan penolakannya diberi tautan Masuk (PRD §8.7 ▶ Keputusan
   * 2026-11-17).
   */
  voucherKhususMember?: true;
  /**
   * Diisi hanya bila checkout ditolak karena email milik Member nonaktif, supaya form menampilkan tombol WhatsApp di
   * bawah pesannya (PRD §5.2 ▶ Keputusan 2026-11-17). `null` berarti nomor WhatsApp toko belum diisi (PRD §9.8).
   */
  nomorWhatsapp?: string | null;
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

/** Pesan PRD §5.2 ▶ Keputusan 2026-11-17 untuk email milik Member nonaktif. */
const PESAN_MEMBER_NONAKTIF =
  "Email ini milik Member yang dinonaktifkan, jadi Pesanan tidak dibuat. Hubungi kami di WhatsApp.";

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
 *
 * Kode voucher yang diisi diperiksa saat Pesanan dibuat. Bila Voucher ditolak, Pesanan tidak dibuat, dan pesan
 * penolakannya tampil di isian kode voucher (PRD §8.7 ▶ Keputusan 2026-11-17). Isian kode selalu dikembalikan
 * apa adanya, supaya tetap berisi setelah checkout ditolak.
 */
export async function aksiCheckout(
  _sebelumnya: KeadaanFormCheckout,
  formData: FormData,
): Promise<KeadaanFormCheckout> {
  // Checkout terbuka untuk Tamu (PRD §2.1). Bila Member sedang login, email Pesanan diambil dari sesinya,
  // bukan dari isian form, supaya email lain yang dikirim lewat alat browser tidak dipakai (PRD §5.2).
  const sesiMember = await bacaSesiMember(await headers());
  const tokoCookie = await cookies();
  const tautanBrowserIni = tautanDiBrowser(
    tokoCookie.get(COOKIE_TAUTAN_PESANAN)?.value,
  );
  const isianEmail = sesiMember ? sesiMember.user.email : formData.get("email");
  // Email yang diketik Tamu dan kode voucher dikembalikan apa adanya untuk mengisi ulang form.
  const email = typeof isianEmail === "string" ? isianEmail : "";
  const isianKode = formData.get("kodeVoucher");
  const kodeVoucher = typeof isianKode === "string" ? isianKode : "";
  const isian = { email, kodeVoucher };
  const masukanEmail = Email.safeParse(isianEmail);
  if (!masukanEmail.success) {
    return {
      ...isian,
      galat: { email: masukanEmail.error.issues[0].message },
    };
  }
  const varianId = z.uuid().safeParse(formData.get("varianId"));
  if (!varianId.success) {
    return { ...isian, galat: { checkout: PESAN_TIDAK_DIJUAL } };
  }

  const hasil = await buatPesanan({
    varianId: varianId.data,
    email: masukanEmail.data,
    tautanDiBrowser: tautanBrowserIni,
    kodeVoucher,
    member: sesiMember !== null,
  });
  if (hasil.hasil === "tidak-dijual") {
    return { ...isian, galat: { checkout: PESAN_TIDAK_DIJUAL } };
  }
  if (hasil.hasil === "member-nonaktif") {
    const { nomorWhatsapp } = await bacaPengaturanToko();
    return {
      ...isian,
      galat: { checkout: PESAN_MEMBER_NONAKTIF },
      nomorWhatsapp,
    };
  }
  if (hasil.hasil === "stok-habis") {
    return { ...isian, galat: { checkout: PESAN_STOK_HABIS } };
  }
  if (hasil.hasil === "voucher-ditolak") {
    return {
      ...isian,
      galat: { kodeVoucher: hasil.pesan },
      ...(hasil.alasan === "khusus-member" && { voucherKhususMember: true }),
    };
  }
  if (hasil.hasil === "qris-gagal") {
    return { ...isian, galat: { checkout: PESAN_QRIS_GAGAL } };
  }
  if (hasil.hasil === "pesanan-menunggu-di-browser-lain") {
    return {
      ...isian,
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

/**
 * Hasil tombol "Pakai": Voucher diterima dengan potongan voucher dan Perkiraan bayar yang baru, beserta Harga jual
 * sebagai bahan hitungnya, atau ditolak dengan pesan penolakannya. `khususMember` menandai penolakan Voucher
 * khusus Member, yang pesannya diberi tautan Masuk.
 */
export type HasilPakaiVoucher =
  | {
      diterima: true;
      kodeVoucher: string;
      hargaJual: number;
      potonganVoucher: number;
      perkiraanBayar: number;
    }
  | { diterima: false; pesan: string; khususMember: boolean };

const MasukanPakaiVoucher = z.object({
  varianId: z.uuid(),
  kode: z.string(),
  email: z.string(),
});

/**
 * Tombol "Pakai" di Checkout (PRD §8.7 ▶ Keputusan 2026-11-17): memeriksa kode voucher untuk Varian itu dengan
 * penilaian yang sama seperti saat Pesanan dibuat (nilaiVoucher), tanpa membuat Pesanan.
 *
 * - Status login Member dibaca dari sesi. Bila Member sedang login, Batas per email memakai email Member itu.
 * - `email` adalah isi isian email saat "Pakai" ditekan. Bila masih kosong, Batas per email tidak diperiksa di
 *   sini, tetapi tetap diperiksa saat Pesanan dibuat.
 * - Hasil ini tidak menahan Voucher. Semua syarat diperiksa sekali lagi saat Pesanan dibuat (aksiCheckout).
 */
export async function aksiPakaiVoucher(
  masukan: unknown,
): Promise<HasilPakaiVoucher> {
  const kepala = await headers();
  const isian = MasukanPakaiVoucher.safeParse(masukan);
  if (!isian.success) {
    return { diterima: false, pesan: PESAN_TIDAK_DIJUAL, khususMember: false };
  }

  const hasil = await nilaiVoucher({ ...isian.data, kepala });
  if (hasil === null) {
    return { diterima: false, pesan: PESAN_TIDAK_DIJUAL, khususMember: false };
  }
  if (!hasil.dipakai) {
    return {
      diterima: false,
      pesan: hasil.pesan,
      khususMember: hasil.alasan === "khusus-member",
    };
  }
  const { nominal } = nominalTagihanQris(hasil);
  return {
    diterima: true,
    kodeVoucher: hasil.kodeVoucher,
    hargaJual: hasil.hargaJual,
    potonganVoucher: hasil.potonganVoucher,
    perkiraanBayar: nominal,
  };
}
