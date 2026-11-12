import { cn } from "@/lib/utils";

import { Keterangan } from "./keterangan-isian";

/** Isian 52 px (DESIGN.md Inputs / Fields): garis `garis`, fokus `aksi` dengan halo, galat `st-masalah`. */
export const KELAS_ISIAN =
  "rounded-[14px] border-[1.5px] border-garis bg-permukaan px-4 text-base text-tinta focus-visible:border-aksi focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--monogram)_30%,transparent)] focus-visible:outline-none aria-invalid:border-st-masalah";

/** Tombol garis 52 px untuk aksi kedua (DESIGN.md Buttons). */
export const KELAS_TOMBOL_GARIS =
  "inline-flex h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-garis bg-permukaan px-6 text-base font-extrabold text-tinta hover:border-monogram";

/**
 * Isian teks satu baris atau beberapa baris, dengan label di atas dan keterangan di bawah. `id` hanya
 * perlu diisi bila halaman memuat lebih dari satu isian dengan `nama` yang sama. `mono` dipakai untuk
 * isian nilai Item stok, yang ditulis dengan JetBrains Mono (DESIGN.md Typography).
 */
export function IsianTeks({
  nama,
  id = nama,
  label,
  nilaiAwal,
  galat,
  bantuan,
  banyakBaris = false,
  inputMode,
  autoFocus,
  mono = false,
}: {
  nama: string;
  id?: string;
  label: string;
  nilaiAwal: string;
  galat?: string;
  bantuan?: string;
  banyakBaris?: boolean;
  inputMode?: "numeric" | "email";
  autoFocus?: boolean;
  mono?: boolean;
}) {
  const idKeterangan = `${id}-keterangan`;
  const atribut = {
    id,
    name: nama,
    defaultValue: nilaiAwal,
    autoFocus,
    spellCheck: mono ? false : undefined,
    "aria-invalid": galat ? true : undefined,
    "aria-describedby": galat || bantuan ? idKeterangan : undefined,
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      {banyakBaris ? (
        <textarea
          {...atribut}
          rows={5}
          className={cn(
            KELAS_ISIAN,
            "min-h-32 py-3 leading-[1.6]",
            mono && "font-mono",
          )}
        />
      ) : (
        <input
          {...atribut}
          autoComplete="off"
          inputMode={inputMode}
          className={cn(KELAS_ISIAN, "h-[52px]", mono && "font-mono")}
        />
      )}
      <Keterangan id={idKeterangan} galat={galat} bantuan={bantuan} />
    </div>
  );
}

/** Kotak centang dengan label di sampingnya dan teks bantuan di bawahnya. */
export function KotakCentang({
  nama,
  id = nama,
  label,
  bantuan,
  dicentang,
}: {
  nama: string;
  id?: string;
  label: string;
  bantuan: string;
  dicentang: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-10 items-center gap-3">
        <input
          id={id}
          name={nama}
          type="checkbox"
          defaultChecked={dicentang}
          aria-describedby={`${id}-keterangan`}
          className="size-6 shrink-0 accent-aksi"
        />
        <label htmlFor={id} className="text-sm font-bold">
          {label}
        </label>
      </div>
      <Keterangan id={`${id}-keterangan`} bantuan={bantuan} />
    </div>
  );
}
