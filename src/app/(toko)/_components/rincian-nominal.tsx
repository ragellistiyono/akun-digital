import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BarisRincian = { label: string; nilai: ReactNode; redup?: boolean };

/**
 * Rincian Total bayar (PRD §5.5, DESIGN.md "Cards / Containers"): tabel 15 px dengan nilai rata kanan.
 * Baris terakhir, yaitu Total bayar atau Perkiraan bayar, dipisah garis putus 1,5 px dan berukuran 20 px
 * tebal 800. Nilainya sudah ditulis sebagai rupiah oleh halaman yang memasangnya.
 */
export function RincianNominal({
  baris,
  total,
}: {
  baris: BarisRincian[];
  total: BarisRincian;
}) {
  return (
    <table className="w-full border-collapse text-[15px]">
      <tbody>
        {baris.map(({ label, nilai, redup }) => (
          <tr key={label}>
            <th scope="row" className="py-2 pr-4 text-left font-normal">
              {label}
            </th>
            <td
              className={cn(
                "py-2 text-right font-bold",
                redup && "text-tinta-redup",
              )}
            >
              {nilai}
            </td>
          </tr>
        ))}
        <tr className="text-xl font-extrabold tracking-[-0.01em]">
          <th
            scope="row"
            className="border-t-[1.5px] border-dashed border-garis pt-4 pr-4 text-left"
          >
            {total.label}
          </th>
          <td className="border-t-[1.5px] border-dashed border-garis pt-4 text-right">
            {total.nilai}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
