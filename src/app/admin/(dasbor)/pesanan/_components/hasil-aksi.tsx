import { Check, TriangleAlert } from "lucide-react";

/** Tombol 40 px dengan kepadatan Operate dasbor admin (DESIGN.md Navigation). */
const KELAS_TOMBOL =
  "inline-flex h-10 w-fit items-center gap-2 rounded-[12px] px-4 text-sm font-bold disabled:bg-permukaan-2 disabled:text-tinta-redup";

export const KELAS_TOMBOL_UTAMA = `${KELAS_TOMBOL} bg-aksi text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98]`;

export const KELAS_TOMBOL_GARIS = `${KELAS_TOMBOL} border-[1.5px] border-garis bg-permukaan text-tinta hover:border-monogram`;

/**
 * Hasil aksi di detail Pesanan: pesan berhasil berwarna `st-selesai` dengan ikon `Check`, atau pesan galat
 * berwarna `st-masalah` dengan ikon `TriangleAlert`. Wadahnya selalu ada supaya pembaca layar mengumumkan
 * isinya saat berubah.
 */
export function HasilAksi({
  keadaan,
}: {
  keadaan: { pesan?: string; galat?: string };
}) {
  return (
    <p role="status" className="text-[13px] font-bold">
      {keadaan.galat ? (
        <span className="flex items-start gap-2 text-st-masalah">
          <TriangleAlert aria-hidden="true" className="size-6 shrink-0" />
          {keadaan.galat}
        </span>
      ) : (
        keadaan.pesan && (
          <span className="flex items-start gap-2 text-st-selesai">
            <Check aria-hidden="true" className="size-6 shrink-0" />
            {keadaan.pesan}
          </span>
        )
      )}
    </p>
  );
}
