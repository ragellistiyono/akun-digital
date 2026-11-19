import type { Metadata } from "next";

// Layar pembuka iPhone (PRD §11.4 ▶ Keputusan 2026-11-18 dan 2026-11-20): satu gambar per ukuran layar
// iPhone tegak, dari iPhone SE generasi 2 sampai iPhone 16 Pro Max, beserta iPhone 8 Plus, XS Max, dan Air
// yang ukurannya berbeda. Ukuran dalam titik CSS dan rasio piksel mengikuti spesifikasi Apple. iPhone hanya
// memakai gambar yang ukuran pikselnya persis sama dengan layarnya.
//
// Gambar di public/layar-pembuka/ dibuat sekali, sama untuk mode terang dan gelap: latar `kertas`, logo
// docs/input/logo.png 160 titik di tengah layar, dan nama "MIWE Digital Store" 24 titik di bawahnya dengan
// huruf `title` (Kalam 700, 28 titik) berwarna `pensil`. Logo diberi bingkai pensil 3 titik beradius
// `coret-alt` dan bayangan tegas 4 titik ke kanan bawah (DESIGN.md Shadow Vocabulary).
//
// Cara membuat ulang, bila logo, token, atau daftar di bawah berubah: tulis halaman HTML dengan tata letak
// di atas (nilai warna dan radius dari frontmatter docs/DESIGN.md, logo dan huruf Kalam 700 latin dari
// .next/static/media disematkan sebagai data URL), lalu tangkap dengan Chromium dari @playwright/test:
// untuk setiap baris LAYAR_IPHONE, viewport = lebar x tinggi titik dan deviceScaleFactor = rasio, sehingga
// PNG-nya persis (lebar*rasio) x (tinggi*rasio) piksel. Simpan sebagai layar-pembuka-<px>x<px>.png. Ikon
// maskable public/ikon/ikon-maskable-512.png dibuat dengan cara yang sama: viewport 512 x 512, rasio 1,
// logo 410 px di tengah latar `kertas` tanpa bingkai. Ikon lain di public/ikon/ adalah logo utuh tanpa
// latar, jadi tidak ikut dibuat ulang. Periksa hasilnya dengan e2e/ikon-dan-manifest.spec.ts dan
// e2e/layar-pembuka-iphone.spec.ts.
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
 * bawah ikonnya, bilah status bawaan, dan layar pembuka sendiri. Bilah status bawaan berlatar terang dengan
 * teks gelap dan tidak tembus (PRD §11.4 ▶ Keputusan 2026-11-20): iPhone meletakkan halaman di bawahnya,
 * jadi bilah atas toko dan dasbor admin tidak perlu mewarnai zona di belakang jam.
 */
export function pengaturanIphone(
  judul: string,
): Pick<Metadata, "appleWebApp" | "other"> {
  return {
    appleWebApp: {
      title: judul,
      statusBarStyle: "default",
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
