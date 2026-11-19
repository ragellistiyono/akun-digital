"use client";

import { useActionState } from "react";

import { Isian, PesanGalat } from "../../../../_masuk/form-masuk";
import { aksiDaftar } from "../aksi";
import type { KeadaanFormDaftar } from "../pesan-daftar";

const KEADAAN_AWAL: KeadaanFormDaftar = { email: "" };

/** Form Daftar dengan email, password minimal 8 karakter, dan tombol "Daftar" (PRD §7.2, §7.5). */
export function FormDaftar() {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    aksiDaftar,
    KEADAAN_AWAL,
  );

  return (
    <form
      action={aksi}
      noValidate
      className="kartu selotip relative mt-6 flex flex-col gap-4 p-5"
    >
      <Isian
        nama="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={keadaan.email}
        galat={keadaan.galat?.email}
      />
      <Isian
        nama="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        bantuan="Minimal 8 karakter."
        galat={keadaan.galat?.password}
      />
      {keadaan.galat?.umum && (
        <PesanGalat id="daftar-galat" peran="alert">
          {keadaan.galat.umum}
        </PesanGalat>
      )}
      <button
        type="submit"
        disabled={sedangMengirim}
        className="tombol mt-2 w-full"
      >
        {sedangMengirim ? "Mengirim…" : "Daftar"}
      </button>
    </form>
  );
}
