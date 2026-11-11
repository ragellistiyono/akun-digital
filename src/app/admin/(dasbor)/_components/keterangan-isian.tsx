import { TriangleAlert } from "lucide-react";

/** Teks bantuan di bawah isian, yang diganti pesan galat bila isian ditolak (DESIGN.md Inputs / Fields). */
export function Keterangan({
  id,
  galat,
  bantuan,
}: {
  id: string;
  galat?: string;
  bantuan?: string;
}) {
  if (galat) {
    return (
      <p
        id={id}
        className="flex items-start gap-2 text-[13px] font-bold text-st-masalah"
      >
        <TriangleAlert aria-hidden="true" className="size-6 shrink-0" />
        {galat}
      </p>
    );
  }
  if (!bantuan) return null;
  return (
    <p id={id} className="text-[13px] text-tinta-redup">
      {bantuan}
    </p>
  );
}
