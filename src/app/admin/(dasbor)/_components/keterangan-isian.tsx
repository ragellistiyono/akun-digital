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
      <p id={id} className="flex items-start gap-2 text-[16px] text-aksi">
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0"
          strokeWidth={2.5}
        />
        {galat}
      </p>
    );
  }
  if (!bantuan) return null;
  return (
    <p id={id} className="text-[15px] text-pensil-redup">
      {bantuan}
    </p>
  );
}
