import type { Metadata } from "next";

// Layar pembuka iPhone (PRD §11.4 ▶ Keputusan 2026-11-18): satu gambar per ukuran layar iPhone tegak,
// dari iPhone SE generasi 2 sampai iPhone 16 Pro Max, beserta iPhone 8 Plus, XS Max, dan Air yang
// ukurannya berbeda. Ukuran dalam titik CSS dan rasio piksel mengikuti spesifikasi Apple. iPhone hanya
// memakai gambar yang ukuran pikselnya persis sama dengan layarnya.
//
// Gambar di public/layar-pembuka/ dibuat sekali, sama untuk mode terang dan gelap: latar `langit`, logo
// docs/input/logo.png 160 px di tengah layar, dan nama "MIWE Digital Store" 24 px di bawahnya dengan
// huruf `title` (Manrope 800, 22 px) berwarna `langit-teks`. Bila logo atau warna berubah, gambarnya
// dibuat ulang dengan tata letak yang sama.
const LAYAR_IPHONE: { lebar: number; tinggi: number; rasio: number }[] = [
  { lebar: 375, tinggi: 667, rasio: 2 }, // iPhone SE generasi 2 dan 3
  { lebar: 414, tinggi: 736, rasio: 3 }, // iPhone 8 Plus
  { lebar: 375, tinggi: 812, rasio: 3 }, // iPhone 12 mini, 13 mini
  { lebar: 414, tinggi: 896, rasio: 2 }, // iPhone 11
  { lebar: 414, tinggi: 896, rasio: 3 }, // iPhone XS Max, 11 Pro Max
  { lebar: 390, tinggi: 844, rasio: 3 }, // iPhone 12, 13, 14, 16e
  { lebar: 428, tinggi: 926, rasio: 3 }, // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
  { lebar: 393, tinggi: 852, rasio: 3 }, // iPhone 14 Pro, 15, 15 Pro, 16
  { lebar: 430, tinggi: 932, rasio: 3 }, // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { lebar: 402, tinggi: 874, rasio: 3 }, // iPhone 16 Pro, 17, 17 Pro
  { lebar: 420, tinggi: 912, rasio: 3 }, // iPhone Air
  { lebar: 440, tinggi: 956, rasio: 3 }, // iPhone 16 Pro Max, 17 Pro Max
];

/**
 * Pengaturan iPhone untuk semua halaman: toko terbuka tanpa bilah alamat dengan judul "MIWE Digital" di
 * bawah ikonnya, bilah status tembus, dan layar pembuka sendiri. Karena bilah status tembus, warna `langit`
 * di belakang jam datang dari bilah atas toko dan dasbor admin, yang memberi ruang env(safe-area-inset-top).
 */
export function pengaturanIphone(
  judul: string,
): Pick<Metadata, "appleWebApp" | "other"> {
  return {
    appleWebApp: {
      title: judul,
      statusBarStyle: "black-translucent",
      startupImage: LAYAR_IPHONE.map(({ lebar, tinggi, rasio }) => ({
        url: `/layar-pembuka/layar-pembuka-${lebar * rasio}x${tinggi * rasio}.png`,
        media: `screen and (device-width: ${lebar}px) and (device-height: ${tinggi}px) and (-webkit-device-pixel-ratio: ${rasio}) and (orientation: portrait)`,
      })),
    },
    // Next.js menulis appleWebApp.capable sebagai meta mobile-web-app-capable, jadi meta milik iPhone
    // dipasang sendiri.
    other: { "apple-mobile-web-app-capable": "yes" },
  };
}
