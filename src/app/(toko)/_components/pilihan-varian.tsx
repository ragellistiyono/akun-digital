import { cn } from "@/lib/utils";
import type { HalamanProduk } from "@/server/katalog";

import { HargaNormal, LabelHemat } from "./kartu-produk";
import { teksHarga } from "./teks-harga";

/**
 * Pilihan Varian di Halaman Produk (PRD §3.2–§3.5, DESIGN.md "Pilihan Varian"): radiogroup berisi satu
 * kartu coretan bergaris pensil 2 px per Varian aktif, dengan radio lingkaran coretan 28 px, nama Varian
 * dan "Stok N", lalu Harga jual beserta Harga normal yang dicoret dan label Hemat. Varian terpilih menjadi
 * catatan post-it bergaris pulpen 3 px. Teks di dalamnya memakai `teks-postit`, supaya tetap terbaca di
 * mode gelap. Varian habis bertulisan "Habis", beropasitas 60%, dan radionya nonaktif sehingga tidak bisa
 * dipilih.
 *
 * Radionya radio bawaan browser (`name="varianId"`), jadi pilihan bekerja tanpa JavaScript dan dikirim
 * lewat form beli Halaman Produk.
 *
 * Varian Produk gratis (`gratis`) menampilkan "Gratis" di tempat Harga jual, dengan Harga normal yang tetap dicoret
 * tanpa label Hemat (PRD §16.4).
 */
export function PilihanVarian({
  varian,
  gratis,
  terpilihId,
  labelledBy,
}: {
  varian: HalamanProduk["varian"];
  gratis: boolean;
  /** id Varian yang sudah terpilih saat halaman dibuka, atau null bila tidak ada. */
  terpilihId: string | null;
  /** id judul yang menamai radiogroup ini. */
  labelledBy: string;
}) {
  return (
    // Antarkartu Varian 16 px, sama dengan jarak antarkartu lain dalam satu bagian (DESIGN.md Layout).
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-4">
      {varian.map((v) => (
        <label
          key={v.id}
          // Garis terpilih 3 px diimbangi padding 15 px, supaya isinya tidak bergeser saat dipilih.
          className={cn(
            "group/varian grid grid-cols-[28px_minmax(0,1fr)_minmax(0,auto)] items-center gap-3 rounded-coret-md border-2 border-pensil bg-permukaan p-4 transition-[border-color,background-color,box-shadow] duration-100 ease-out motion-reduce:transition-none has-checked:border-[3px] has-checked:border-pulpen has-checked:bg-postit has-checked:p-[15px] has-checked:text-teks-postit has-checked:shadow-coret-kecil",
            v.habis
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:border-pulpen",
          )}
        >
          <input
            type="radio"
            name="varianId"
            value={v.id}
            disabled={v.habis}
            defaultChecked={v.id === terpilihId}
            className="grid size-7 cursor-pointer appearance-none place-items-center rounded-coret-bulat border-2 border-pensil before:size-3.5 before:scale-0 before:rounded-coret-bulat before:bg-teks-postit checked:border-teks-postit checked:before:scale-100 disabled:cursor-not-allowed disabled:border-dashed"
          />
          <span className="min-w-0">
            <span className="block font-spidol text-[19px] leading-[1.2] font-bold [overflow-wrap:anywhere]">
              {v.nama}
            </span>
            <span className="block text-[15px] text-pensil-redup group-has-checked/varian:text-teks-postit">
              {v.habis ? "Habis" : `Stok ${v.stokVarian}`}
            </span>
          </span>
          <span className="flex min-w-0 flex-col items-end gap-1 text-right">
            <span className="font-spidol text-[20px] leading-[1.2] font-bold whitespace-nowrap">
              {teksHarga({ hargaJual: v.hargaJual, gratis })}
            </span>
            {v.hargaNormal !== null && (
              <HargaNormal
                nilai={v.hargaNormal}
                className="group-has-checked/varian:text-teks-postit"
              />
            )}
            {v.persenHemat !== null && <LabelHemat persen={v.persenHemat} />}
          </span>
        </label>
      ))}
    </div>
  );
}
