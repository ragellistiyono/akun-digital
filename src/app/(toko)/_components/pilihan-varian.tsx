import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import type { HalamanProduk } from "@/server/katalog";

import { HargaNormal, LabelHemat } from "./kartu-produk";

/**
 * Pilihan Varian di Halaman Produk (PRD §3.2–§3.5, DESIGN.md "Pilihan Varian"): radiogroup berisi satu
 * kartu 20 px bergaris 2 px per Varian aktif, dengan radio 24 px, nama Varian dan "Stok N", lalu Harga
 * jual beserta Harga normal yang dicoret dan label Hemat. Varian habis bertulisan "Habis", beropasitas
 * 60%, dan radionya nonaktif sehingga tidak bisa dipilih.
 *
 * Radionya radio bawaan browser (`name="varianId"`), jadi pilihan bekerja tanpa JavaScript dan bisa
 * dikirim lewat form. Varian ber-stok pertama sudah terpilih saat halaman dibuka.
 */
export function PilihanVarian({
  varian,
  labelledBy,
}: {
  varian: HalamanProduk["varian"];
  /** id judul yang menamai radiogroup ini. */
  labelledBy: string;
}) {
  const terpilihId = varian.find((v) => !v.habis)?.id;

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-2">
      {varian.map((v) => (
        <label
          key={v.id}
          className={cn(
            "grid grid-cols-[24px_minmax(0,1fr)_minmax(0,auto)] items-center gap-3 rounded-[20px] border-2 border-garis bg-permukaan p-4 transition-colors duration-150 motion-reduce:transition-none has-checked:border-aksi has-checked:bg-[color-mix(in_srgb,var(--monogram)_9%,var(--permukaan))]",
            v.habis
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:border-monogram",
          )}
        >
          <input
            type="radio"
            name="varianId"
            value={v.id}
            disabled={v.habis}
            defaultChecked={v.id === terpilihId}
            className="grid size-6 cursor-pointer appearance-none place-items-center rounded-full border-2 border-garis before:size-3 before:scale-0 before:rounded-full before:bg-aksi checked:border-aksi checked:before:scale-100 disabled:cursor-not-allowed"
          />
          <span className="min-w-0">
            <span className="block text-base font-extrabold [overflow-wrap:anywhere]">
              {v.nama}
            </span>
            <span className="block text-[13px] font-bold text-tinta-redup">
              {v.habis ? "Habis" : `Stok ${v.stokVarian}`}
            </span>
          </span>
          <span className="flex min-w-0 flex-col items-end gap-1 text-right">
            <span className="text-lg font-extrabold tracking-[-0.02em] whitespace-nowrap">
              {rupiah(v.hargaJual)}
            </span>
            {v.hargaNormal !== null && <HargaNormal nilai={v.hargaNormal} />}
            {v.persenHemat !== null && <LabelHemat persen={v.persenHemat} />}
          </span>
        </label>
      ))}
    </div>
  );
}
