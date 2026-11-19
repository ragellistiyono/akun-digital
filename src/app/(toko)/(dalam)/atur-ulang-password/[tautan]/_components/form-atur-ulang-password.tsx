"use client";

import { useActionState } from "react";

import { Isian } from "../../../../../_masuk/form-masuk";
import { aksiAturUlangPassword } from "../aksi";
import type { KeadaanFormAturUlang } from "../tautan-atur-ulang";

const KEADAAN_AWAL: KeadaanFormAturUlang = {};

/**
 * Form password baru minimal 8 karakter dan tombol "Simpan password" untuk Tautan atur ulang password itu
 * (PRD §7.5 ▶ Keputusan 2026-11-17).
 */
export function FormAturUlangPassword({ tautan }: { tautan: string }) {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    aksiAturUlangPassword.bind(null, tautan),
    KEADAAN_AWAL,
  );

  return (
    <form
      action={aksi}
      noValidate
      className="kartu paku relative mt-6 flex flex-col gap-4 p-5"
    >
      <Isian
        nama="passwordBaru"
        label="Password baru"
        type="password"
        autoComplete="new-password"
        bantuan="Minimal 8 karakter."
        galat={keadaan.galat}
      />
      <button
        type="submit"
        disabled={sedangMengirim}
        className="tombol mt-2 w-full"
      >
        {sedangMengirim ? "Menyimpan…" : "Simpan password"}
      </button>
    </form>
  );
}
