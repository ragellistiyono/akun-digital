import { TombolSalin } from "./tombol-salin";

/**
 * Blok Item stok Halaman Pesanan (PRD §6.1, DESIGN.md "Blok Item stok dan tombol Salin"): blok `langit`
 * radius 24 px. Setiap kolom Item stok menjadi satu baris berisi nama kolom (12 px `langit-redup`), isi
 * kolom dalam huruf mono 15 px putih yang boleh patah di mana saja, dan tombol Salin.
 */
export function BlokItemStok({
  kolom,
}: {
  kolom: { nama: string; nilai: string }[];
}) {
  return (
    <section aria-labelledby="judul-item-stok">
      <h2
        id="judul-item-stok"
        className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]"
      >
        Item stok Anda
      </h2>
      <div className="mt-4 rounded-[24px] bg-langit px-4 py-2 text-langit-teks">
        {kolom.map(({ nama, nilai }, urutan) => (
          <div
            key={urutan}
            className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-langit-garis py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-langit-redup">{nama}</p>
              <p className="font-mono text-[15px] font-medium text-teks-di-aksi [overflow-wrap:anywhere]">
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
