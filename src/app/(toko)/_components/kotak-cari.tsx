import { Search } from "lucide-react";
import Form from "next/form";

/**
 * Kotak cari nama Produk di pita pemandangan Beranda (PRD §3.6, DESIGN.md "Kotak cari"): isian coretan
 * 48 px dengan ikon Search. Latarnya `permukaan` pekat dengan bayangan potongan kertas, supaya tetap
 * terbaca di atas pemandangan. Saat fokus garisnya menjadi pulpen biru dengan halo tipis.
 * Pencarian dikirim dengan Enter (tombol cari di papan ketik ponsel) ke Beranda sebagai `?q=`; saringan
 * Kategori tidak ikut terbawa.
 */
export function KotakCari({ kataCari }: { kataCari: string }) {
  // Tujuan pencarian selalu berisi `?q=`, jadi prefetch Beranda tanpa kata cari tidak berguna. Jarak 20 px
  // di atas kotak menjauhkannya dari garis pensil bilah atas yang menjorok 4 px ke pita; awan pita mulai
  // di bawah kotak setinggi 48 px ini. Di ponsel kotak selebar isi; mulai 900 px kotak dibatasi 720 px di
  // tengah pita, karena isian selebar 1120 px terlalu panjang untuk satu nama Produk.
  return (
    <Form
      action="/"
      prefetch={false}
      role="search"
      aria-label="Cari Produk"
      className="pt-5 lebar:mx-auto lebar:max-w-[720px]"
    >
      <label className="relative block">
        <Search
          aria-hidden="true"
          strokeWidth={2.5}
          className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-pensil-redup"
        />
        <span className="sr-only">Cari nama Produk</span>
        {/* Isian dipasang ulang setiap kata cari di alamat berubah, supaya isinya ikut kosong saat
            Pembeli memilih chip Kategori atau kembali ke Beranda. */}
        <input
          key={kataCari}
          type="search"
          name="q"
          defaultValue={kataCari}
          placeholder="Cari nama Produk"
          autoComplete="off"
          enterKeyHint="search"
          className="isian h-12 min-h-12 pl-13 shadow-coret focus:ring-3 focus:ring-pulpen/20"
        />
      </label>
    </Form>
  );
}
