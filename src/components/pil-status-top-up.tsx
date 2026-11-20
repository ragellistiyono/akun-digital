import {
  Check,
  CircleX,
  Clock,
  Hourglass,
  type LucideIcon,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";

import type { StatusTopUp } from "@/domain/status-top-up";

/**
 * Ikon dan warna pil setiap status Top up (PRD §15.4). Status yang namanya sama dengan status Pesanan memakai ikon dan
 * warna status Pesanan itu (DESIGN.md Status Pesanan), dan Berhasil memakai ikon serta warna Selesai, karena keduanya
 * berarti sudah dibayar dan tuntas.
 */
const PIL_STATUS: Record<StatusTopUp, { Ikon: LucideIcon; warna: string }> = {
  "Menunggu Pembayaran": {
    Ikon: Clock,
    warna: "bg-st-tunggu-bg text-st-tunggu",
  },
  Berhasil: { Ikon: Check, warna: "bg-st-selesai-bg text-st-selesai" },
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
 * Pil status Top up dengan anatomi pil status Pesanan (DESIGN.md Status Pesanan): warna, ikon, dan label sekaligus,
 * setinggi 28 px dengan tepi coretan dan bingkai 2 px sewarna teks statusnya. Dipakai di menu Top up dasbor admin.
 */
export function PilStatusTopUp({ status }: { status: StatusTopUp }) {
  const { Ikon, warna } = PIL_STATUS[status];
  return (
    <span
      className={`inline-flex h-7 items-center gap-1 rounded-coret border-2 border-current pr-3 pl-2 font-spidol text-[15px] leading-none font-bold whitespace-nowrap ${warna}`}
    >
      <Ikon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
      {status}
    </span>
  );
}
