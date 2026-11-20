import { teksSalinSemua } from "@/domain/teks-salin-semua";

import { TombolSalin, TombolSalinSemua } from "./tombol-salin";

/**
 * Blok Item stok Halaman Pesanan (PRD §6.1, DESIGN.md "Blok Item stok dan tombol Salin"): kartu `permukaan`
 * berbayangan tegas. Setiap kolom Item stok menjadi satu baris berisi nama kolom (15 px `pensil-redup`), isi
 * kolom dalam huruf mono 15 px `pensil` yang boleh patah di mana saja, dan tombol Salin. Antarbaris dipisah
 * coretan putus-putus. Kepala kartu berisi judul dan, rata kanan sejajar judul, tombol "Salin semua" yang
 * menyalin seluruh Item stok sekaligus (PRD §6.1 ▶ Keputusan 2026-11-20).
 */
export function BlokItemStok({
  kolom,
}: {
  kolom: { nama: string; nilai: string }[];
}) {
  return (
    <section aria-labelledby="judul-item-stok">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="judul-item-stok" className="text-[26px]">
          Item stok Anda
        </h2>
        <TombolSalinSemua teks={teksSalinSemua(kolom)} />
      </div>
      <div className="kartu kartu-tegas mt-4 px-4 py-2">
        {kolom.map(({ nama, nilai }, urutan) => (
          <div
            key={urutan}
            className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b-2 border-dashed border-pensil-redup py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-[15px] leading-snug text-pensil-redup">
                {nama}
              </p>
              <p className="font-mono text-[15px] font-medium text-pensil [overflow-wrap:anywhere]">
                {nilai}
              </p>
            </div>
            <TombolSalin nama={nama} nilai={nilai} />
          </div>
        ))}
      </div>
    </section>
  );
}
