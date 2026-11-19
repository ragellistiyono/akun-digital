"use client";

import { useActionState } from "react";

import { Isian } from "../../../../_masuk/form-masuk";
import { aksiLupaPassword } from "../aksi";
import type { KeadaanFormLupaPassword } from "../pesan-lupa-password";

const KEADAAN_AWAL: KeadaanFormLupaPassword = { email: "" };

/**
 * Form Lupa password dengan isian email dan tombol "Kirim tautan" (PRD §7.5 ▶ Keputusan 2026-11-17). Setelah
 * email yang sah dikirim, pesan yang sama tampil di bawah isian, apa pun emailnya.
 */
export function FormLupaPassword() {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    aksiLupaPassword,
    KEADAAN_AWAL,
  );

  return (
    <form
      action={aksi}
      noValidate
      className="kartu paku relative mt-6 flex flex-col gap-4 p-5"
    >
      <Isian
        nama="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={keadaan.email}
        galat={keadaan.galat}
      />
      {keadaan.pesan && (
        <p role="status" className="text-[16px] leading-snug text-st-selesai">
          {keadaan.pesan}
        </p>
      )}
      <button
        type="submit"
        disabled={sedangMengirim}
        className="tombol mt-2 w-full"
      >
        {sedangMengirim ? "Mengirim…" : "Kirim tautan"}
      </button>
    </form>
  );
}
