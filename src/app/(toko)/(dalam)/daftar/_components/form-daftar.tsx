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
      className="mt-6 flex flex-col gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
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
        className="mt-2 inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98] disabled:bg-permukaan-2 disabled:text-tinta-redup"
      >
        {sedangMengirim ? "Mengirim…" : "Daftar"}
      </button>
    </form>
  );
}
