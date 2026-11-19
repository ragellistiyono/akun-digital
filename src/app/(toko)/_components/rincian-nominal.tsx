import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BarisRincian = { label: string; nilai: ReactNode; redup?: boolean };

/**
 * Rincian Total bayar (PRD §5.5, DESIGN.md "Cards / Containers"): tabel ringkas 17 px dengan nilai rata
 * kanan. Baris terakhir, yaitu Total bayar atau Perkiraan bayar, dipisah garis putus pensil 2 px dan ditulis
 * spidol tebal 22 px. Nilainya sudah ditulis sebagai rupiah oleh halaman yang memasangnya.
 *
 * Nilai tidak dipatahkan di dalam angka, misalnya "Rp" dan "45.123" di dua baris pada lebar 360 px. Bila
 * kolomnya sempit, labelnya yang patah baris, di mana saja bila perlu, misalnya kode Voucher 20 karakter di
 * "Potongan voucher (KODE)". Nilai panjang yang boleh dipatahkan, seperti "Rp X + Kode unik" di Checkout,
 * membungkus bagian-bagiannya sendiri dengan `whitespace-normal`.
 */
export function RincianNominal({
  baris,
  total,
}: {
  baris: BarisRincian[];
  total: BarisRincian;
}) {
  return (
    <table className="w-full border-collapse text-[17px] leading-[1.3]">
      <tbody>
        {baris.map(({ label, nilai, redup }) => (
          <tr key={label}>
            <th
              scope="row"
              className="py-1.5 pr-4 text-left font-normal [overflow-wrap:anywhere]"
            >
              {label}
            </th>
            <td
              className={cn(
                "py-1.5 text-right whitespace-nowrap",
                redup && "text-pensil-redup",
              )}
            >
              {nilai}
            </td>
          </tr>
        ))}
        <tr className="font-spidol text-[22px] leading-[1.2] font-bold">
          <th
            scope="row"
            className="border-t-2 border-dashed border-pensil pt-3 pr-4 text-left"
          >
            {total.label}
          </th>
          <td className="border-t-2 border-dashed border-pensil pt-3 text-right whitespace-nowrap">
            {total.nilai}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
