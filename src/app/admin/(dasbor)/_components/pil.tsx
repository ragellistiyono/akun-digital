import { Eye, EyeOff, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Pil keadaan dengan warna, ikon, dan label sekaligus (DESIGN.md Status Pesanan). */
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
        "inline-flex h-7 items-center gap-1 rounded-full pr-3 pl-2 text-[13px] font-extrabold whitespace-nowrap",
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
