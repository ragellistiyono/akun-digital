import { ChevronRight } from "lucide-react";
import Link from "next/link";

type VarianStokMenipis = {
  varianId: string;
  namaVarian: string;
  produkId: string;
  namaProduk: string;
  stokVarian: number;
};

/**
 * Daftar Stok menipis di Ringkasan (PRD §9.4 ▶ Keputusan 2026-11-17): nama Produk, nama Varian, dan Stok
 * Varian, dengan urutan dari daftarStokMenipis. Setiap baris membuka halaman Varian di dasbor admin (§9.7).
 */
export function DaftarStokMenipis({
  varian,
}: {
  varian: readonly VarianStokMenipis[];
}) {
  return (
    <div className="mt-4 rounded-[20px] bg-permukaan px-4 py-2 shadow-bayang">
      {varian.length === 0 ? (
        <p className="py-2 text-tinta-redup">
          Tidak ada Varian yang stoknya menipis.
        </p>
      ) : (
        <ul>
          {varian.map((v) => (
            <li
              key={v.varianId}
              className="border-b border-garis last:border-b-0"
            >
              <Link
                href={`/admin/produk/${v.produkId}/varian/${v.varianId}`}
                className="-mx-2 flex min-h-12 items-center gap-4 rounded-[12px] px-2 py-2 hover:bg-permukaan-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-bold break-words">
                    {v.namaProduk}
                  </span>
                  <span className="block text-[13px] break-words text-tinta-redup">
                    {v.namaVarian}
                  </span>
                </span>
                <span className="shrink-0 font-extrabold tabular-nums">
                  Stok {v.stokVarian}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-6 shrink-0 text-tinta-redup"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
