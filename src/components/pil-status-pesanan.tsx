import {
  Check,
  CircleX,
  Clock,
  Hourglass,
  type LucideIcon,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";

import type { StatusPesanan } from "@/domain/status-pesanan";

/** Ikon dan warna pil setiap status Pesanan (DESIGN.md Status Pesanan). */
const PIL_STATUS: Record<StatusPesanan, { Ikon: LucideIcon; warna: string }> = {
  "Menunggu Pembayaran": {
    Ikon: Clock,
    warna: "bg-st-tunggu-bg text-st-tunggu",
  },
  Selesai: { Ikon: Check, warna: "bg-st-selesai-bg text-st-selesai" },
  Kedaluwarsa: {
    Ikon: Hourglass,
    warna: "bg-st-kedaluwarsa-bg text-st-kedaluwarsa",
  },
  Dibatalkan: { Ikon: CircleX, warna: "bg-st-batal-bg text-st-batal" },
  Bermasalah: {
    Ikon: TriangleAlert,
    warna: "bg-st-masalah-bg text-st-masalah",
  },
  "Dana Dikembalikan": {
    Ikon: RotateCcw,
    warna: "bg-st-kembali-bg text-st-kembali",
  },
};

/**
 * Pil status Pesanan (DESIGN.md Status Pesanan): warna, ikon, dan label sekaligus. Dipakai di Halaman bayar,
 * Halaman Pesanan, dan daftar Pesanan di dasbor admin.
 */
export function PilStatusPesanan({ status }: { status: StatusPesanan }) {
  const { Ikon, warna } = PIL_STATUS[status];
  return (
    <span
      className={`inline-flex h-7 items-center gap-1 rounded-full pr-3 pl-2 text-[13px] font-bold whitespace-nowrap ${warna}`}
    >
      <Ikon aria-hidden="true" className="size-4" strokeWidth={2.4} />
      {status}
    </span>
  );
}
