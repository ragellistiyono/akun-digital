import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { StatusItemStok } from "@/domain/item-stok";
import { STATUS_ITEM_STOK } from "@/domain/item-stok";
import { cn } from "@/lib/utils";

import { PilAktif } from "../../_components/pil";
import { alamatVarianTerpilih } from "../alamat";

type BarisVarian = {
  varianId: string;
  namaVarian: string;
  namaProduk: string;
  varianAktif: boolean;
  produkAktif: boolean;
  jumlahPerStatus: Record<StatusItemStok, number>;
};

/**
 * Daftar semua Varian di menu Item stok (PRD §4.2 ▶ Keputusan 2026-11-20): nama Produk, nama Varian, pil Aktif
 * atau Nonaktif Varian itu (ditambah "Produk nonaktif" bila Produknya nonaktif), serta jumlah Item stok
 * Tersedia, Ditahan, dan Terkirim, dengan urutan dari daftarVarianItemStok.
 * Mengetuk sebuah baris memilih Varian itu. Baris Varian yang sedang terpilih ditandai post-it, seperti Varian
 * terpilih di toko (DESIGN.md Post-it).
 */
export function DaftarVarian({
  varian,
  varianTerpilih,
}: {
  varian: readonly BarisVarian[];
  varianTerpilih: string | undefined;
}) {
  if (varian.length === 0) {
    return (
      <p className="py-2 text-pensil-redup">
        Belum ada Varian. Tambah Varian di halaman ubah Produk, lalu isi Item
        stok-nya di sini.
      </p>
    );
  }
  return (
    <ul aria-label="Daftar Varian">
      {varian.map((v) => {
        const terpilih = v.varianId === varianTerpilih;
        return (
          <li
            key={v.varianId}
            className="border-b-2 border-dashed border-pensil last:border-b-0"
          >
            <Link
              href={alamatVarianTerpilih(v.varianId)}
              aria-current={terpilih ? "true" : undefined}
              className={cn(
                "-mx-2 flex min-h-12 items-center gap-4 rounded-coret px-2 py-2",
                terpilih
                  ? "bg-postit text-teks-postit"
                  : "hover:bg-kertas-lama",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="break-words">
                  {v.namaProduk}
                  <span className="sr-only"> </span>
                  <span className="block text-[15px] break-words opacity-80">
                    {v.namaVarian}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <PilAktif aktif={v.varianAktif} />
                  {!v.produkAktif && (
                    <span className="text-[15px] whitespace-nowrap">
                      Produk nonaktif
                    </span>
                  )}
                  {STATUS_ITEM_STOK.map((status) => (
                    <span
                      key={status}
                      className="font-spidol text-[15px] font-bold tabular-nums whitespace-nowrap"
                    >
                      {status} {v.jumlahPerStatus[status]}
                    </span>
                  ))}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-6 shrink-0 opacity-70"
                strokeWidth={2.5}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
