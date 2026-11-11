import { Search } from "lucide-react";
import Form from "next/form";

/**
 * Kotak cari nama Produk di pita langit Beranda (PRD §3.6, DESIGN.md "Kotak cari"): 48 px, radius
 * 16 px, langit gelap pekat 78% dengan garis tipis, tanpa blur, dan cincin `monogram` saat fokus.
 * Pencarian dikirim dengan Enter (tombol cari di papan ketik ponsel) ke Beranda sebagai `?q=`; saringan
 * Kategori tidak ikut terbawa.
 */
export function KotakCari({ kataCari }: { kataCari: string }) {
  // Tujuan pencarian selalu berisi `?q=`, jadi prefetch Beranda tanpa kata cari tidak berguna.
  return (
    <Form action="/" prefetch={false} role="search" aria-label="Cari Produk">
      <label className="flex h-12 items-center gap-2 rounded-[16px] border border-langit-teks/14 bg-(--langit-gelap)/78 px-4 text-langit-redup focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-monogram focus-within:outline-solid">
        <Search aria-hidden="true" className="size-6 shrink-0" />
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
          className="h-full min-w-0 flex-1 bg-transparent text-base text-langit-teks outline-none placeholder:text-langit-redup"
        />
      </label>
    </Form>
  );
}
