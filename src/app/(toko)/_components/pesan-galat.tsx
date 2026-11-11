import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/** Pesan galat 13 px tebal berwarna `st-masalah` dengan ikon TriangleAlert (DESIGN.md Inputs / Fields). */
export function PesanGalat({
  id,
  pesan,
  className,
}: {
  id?: string;
  pesan: string;
  className?: string;
}) {
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "flex items-start gap-2 text-[13px] font-bold text-st-masalah",
        className,
      )}
    >
      <TriangleAlert aria-hidden="true" className="size-6 shrink-0" />
      {pesan}
    </p>
  );
}
