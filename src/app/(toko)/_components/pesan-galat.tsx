import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Pesan galat 16 px berwarna `aksi` dengan ikon TriangleAlert (DESIGN.md Inputs / Fields). Warna `aksi`
 * dipakai, bukan `spidol`, karena teks ini harus terbaca. `pesan` boleh berisi tautan, misalnya tautan
 * Masuk di pesan Voucher khusus Member.
 */
export function PesanGalat({
  id,
  pesan,
  className,
}: {
  id?: string;
  pesan: ReactNode;
  className?: string;
}) {
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "flex items-start gap-2 text-[16px] leading-snug text-aksi",
        className,
      )}
    >
      <TriangleAlert
        aria-hidden="true"
        strokeWidth={2.5}
        className="size-5 shrink-0"
      />
      <span>{pesan}</span>
    </p>
  );
}
