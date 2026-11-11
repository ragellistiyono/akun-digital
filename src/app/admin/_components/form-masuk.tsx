"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState, type ComponentProps, type ReactNode } from "react";

import { aksiMasukAdmin, type KeadaanFormMasuk } from "../aksi";

const KEADAAN_AWAL: KeadaanFormMasuk = { email: "" };

// Pesan galat (DESIGN.md Inputs / Fields): 13 px tebal, warna st-masalah, ikon TriangleAlert.
function PesanGalat({
  id,
  peran,
  children,
}: {
  id: string;
  peran?: "alert";
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      role={peran}
      className="flex items-start gap-1.5 text-[13px] font-bold text-st-masalah"
    >
      <TriangleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
      {children}
    </p>
  );
}

function Isian({
  nama,
  label,
  galat,
  ...atribut
}: {
  nama: string;
  label: string;
  galat?: string;
} & Omit<ComponentProps<"input">, "id" | "name">) {
  const idGalat = `${nama}-galat`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={nama} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={nama}
        name={nama}
        required
        aria-invalid={galat ? true : undefined}
        aria-describedby={galat ? idGalat : undefined}
        className="h-[52px] rounded-[14px] border-[1.5px] border-garis bg-permukaan px-4 text-base text-tinta focus-visible:border-aksi focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--monogram)_30%,transparent)] focus-visible:outline-none aria-invalid:border-st-masalah"
        {...atribut}
      />
      {galat && <PesanGalat id={idGalat}>{galat}</PesanGalat>}
    </div>
  );
}

export function FormMasuk() {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    aksiMasukAdmin,
    KEADAAN_AWAL,
  );

  return (
    <form
      action={aksi}
      noValidate
      className="mt-6 flex flex-col gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <Isian
        nama="email"
        label="Email"
        type="email"
        autoComplete="username"
        defaultValue={keadaan.email}
        galat={keadaan.galat?.email}
      />
      <Isian
        nama="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        galat={keadaan.galat?.password}
      />
      {keadaan.galat?.umum && (
        <PesanGalat id="masuk-galat" peran="alert">
          {keadaan.galat.umum}
        </PesanGalat>
      )}
      <button
        type="submit"
        disabled={sedangMengirim}
        className="mt-2 inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98] disabled:bg-permukaan-2 disabled:text-tinta-redup"
      >
        {sedangMengirim ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
