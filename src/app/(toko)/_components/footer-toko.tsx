import { TautanHalamanHukum } from "./tautan-halaman-hukum";

// Footer toko dengan tautan halaman Syarat & Ketentuan dan Kebijakan Privasi (PRD §9.8), dipisah dari isi
// halaman oleh garis pensil putus-putus. Footer tampil di semua halaman toko, termasuk tab Akun yang tidak
// lagi menautkan kedua halaman itu sendiri (PRD §11.1 ▶ Keputusan 2026-11-20).
//
// Wadahnya sama dengan bilah atas dan isi halaman: 1120 px di tengah dengan padding samping 16/32 px. Garis
// putus-putusnya selebar wadah, dan tautannya rata tengah, supaya seimbang dengan semua pola halaman
// (kolom 560 atau 720 px di tengah maupun grid selebar isi). Garisnya berjarak 56 px dari isi terakhir,
// supaya kartu yang miring beserta bayangannya tetap berjarak minimal 48 px (DESIGN.md "Tata letak
// halaman"). Padding bawah 112 px di ponsel menjaga footer tidak tertutup navigasi bawah, dan 216 px di
// halaman yang punya bilah lekat (DESIGN.md Layout).
export function FooterToko() {
  return (
    <footer className="mx-auto max-w-[1184px] px-4 pt-14 pb-28 lebar:px-8 lebar:pb-16 max-lebar:[body:has([data-bilah-lekat])_&]:pb-[216px]">
      <nav
        aria-label="Halaman hukum"
        className="border-t-2 border-dashed border-pensil pt-4"
      >
        <TautanHalamanHukum />
      </nav>
    </footer>
  );
}
