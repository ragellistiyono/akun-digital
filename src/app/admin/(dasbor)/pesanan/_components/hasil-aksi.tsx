import { Check, TriangleAlert } from "lucide-react";

/** Tombol utama di panel aksi detail Pesanan (kelas `tombol` di globals.css), selebar isinya. */
export const KELAS_TOMBOL_UTAMA = "tombol w-fit";

/** Tombol garis untuk aksi kedua di panel aksi detail Pesanan (kelas `tombol-kedua`), selebar isinya. */
export const KELAS_TOMBOL_GARIS = "tombol tombol-kedua w-fit";

/**
 * Hasil aksi di detail Pesanan: pesan berhasil berwarna `st-selesai` dengan ikon `Check`, atau pesan galat
 * berwarna `aksi` dengan ikon `TriangleAlert`. Wadahnya selalu ada supaya pembaca layar mengumumkan isinya
 * saat berubah.
 */
export function HasilAksi({
  keadaan,
}: {
  keadaan: { pesan?: string; galat?: string };
}) {
  return (
    <p role="status" className="text-base">
      {keadaan.galat ? (
        <span className="flex items-start gap-2 text-aksi">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
            strokeWidth={2.5}
          />
          {keadaan.galat}
        </span>
      ) : (
        keadaan.pesan && (
          <span className="flex items-start gap-2 text-st-selesai">
            <Check
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
              strokeWidth={2.5}
            />
            {keadaan.pesan}
          </span>
        )
      )}
    </p>
  );
}
