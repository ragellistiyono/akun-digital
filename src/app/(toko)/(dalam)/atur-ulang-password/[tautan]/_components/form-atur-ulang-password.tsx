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
      className="mt-6 flex flex-col gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
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
        className="mt-2 inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98] disabled:bg-permukaan-2 disabled:text-tinta-redup"
      >
        {sedangMengirim ? "Menyimpan…" : "Simpan password"}
      </button>
    </form>
  );
}
