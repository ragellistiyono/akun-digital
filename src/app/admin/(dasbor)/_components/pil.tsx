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
 * Pil keadaan dengan warna, ikon, dan label sekaligus. Labelnya `label-kecil` (13 px, tebal 700), sama
 * seperti pil Sampul (DESIGN.md Status Pesanan, keputusan 2026-11-11 #53).
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
        "inline-flex h-7 items-center gap-1 rounded-full pr-3 pl-2 text-[13px] font-bold whitespace-nowrap",
        className,
      )}
    >
      <Ikon aria-hidden="true" className="size-4" strokeWidth={2.4} />
      {label}
    </span>
  );
}

/** Pil Aktif atau Nonaktif untuk Produk dan Varian (PRD §3.7). */
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
 * berbeda di layar yang sama: ikon dari keluarga kotak kiriman, dan warna dari palet merek dan senja.
 */
const PIL_STATUS_ITEM_STOK: Record<
  StatusItemStok,
  { ikon: LucideIcon; warna: string }
> = {
  Tersedia: {
    ikon: Package,
    warna:
      "bg-[color-mix(in_srgb,var(--monogram)_14%,var(--permukaan))] text-aksi-teks",
  },
  Ditahan: { ikon: Lock, warna: "bg-persik text-persik-teks" },
  Terkirim: { ikon: Send, warna: "bg-langit-2 text-langit-teks" },
};

/** Pil status Item stok (GLOSSARY): Tersedia, Ditahan, atau Terkirim, dengan warna, ikon, dan label sekaligus. */
export function PilStatusItemStok({ status }: { status: StatusItemStok }) {
  const { ikon, warna } = PIL_STATUS_ITEM_STOK[status];
  return <Pil ikon={ikon} label={status} className={warna} />;
}
