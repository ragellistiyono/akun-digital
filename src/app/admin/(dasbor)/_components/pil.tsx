import {
  Eye,
  EyeOff,
  Lock,
  Package,
  Send,
  type LucideIcon,
} from "lucide-react";

import type { StatusItemStok } from "@/domain/item-stok";
import { cn } from "@/lib/utils";

/**
 * Pil keadaan dengan warna, ikon, dan label sekaligus: tepi coretan bergaris 2 px sewarna teksnya, dengan
 * label spidol Kalam 15 px tebal 700, sama seperti pil Sampul (DESIGN.md Status Pesanan, keputusan 2026-11-11
 * #53). Kalam dipakai karena Patrick Hand hanya punya tebal 400.
 */
export function Pil({
  ikon: Ikon,
  label,
  className,
}: {
  ikon: LucideIcon;
  label: string;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-coret border-2 border-current pr-3 pl-2 font-spidol text-[15px] leading-none font-bold whitespace-nowrap",
        className,
      )}
    >
      <Ikon aria-hidden="true" className="size-4" strokeWidth={2.5} />
      {label}
    </span>
  );
}

/** Pil Aktif atau Nonaktif untuk Produk dan Varian (PRD §3.7), juga untuk status Member (PRD §2.3). */
export function PilAktif({ aktif }: { aktif: boolean }) {
  return aktif ? (
    <Pil
      ikon={Eye}
      label="Aktif"
      className="bg-st-selesai-bg text-st-selesai"
    />
  ) : (
    <Pil
      ikon={EyeOff}
      label="Nonaktif"
      className="bg-st-batal-bg text-st-batal"
    />
  );
}

/**
 * Ikon dan warna pil setiap status Item stok. Pil ini memakai anatomi pil status Pesanan (DESIGN.md Status
 * Pesanan), tetapi tidak pernah memakai token `st-*` maupun ikon milik status Pesanan, supaya keduanya jelas
 * berbeda di layar yang sama: ikon dari keluarga kotak kiriman, dan warna dari palet kertas, pulpen, dan
 * post-it.
 */
const PIL_STATUS_ITEM_STOK: Record<
  StatusItemStok,
  { ikon: LucideIcon; warna: string }
> = {
  Tersedia: { ikon: Package, warna: "bg-permukaan text-pulpen" },
  Ditahan: { ikon: Lock, warna: "bg-postit text-teks-postit" },
  Terkirim: { ikon: Send, warna: "bg-kertas-lama text-pensil" },
};

/** Pil status Item stok (GLOSSARY): Tersedia, Ditahan, atau Terkirim, dengan warna, ikon, dan label sekaligus. */
export function PilStatusItemStok({ status }: { status: StatusItemStok }) {
  const { ikon, warna } = PIL_STATUS_ITEM_STOK[status];
  return <Pil ikon={ikon} label={status} className={warna} />;
}
