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
      className="mt-6 flex flex-col gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
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
        <p role="status" className="text-[13px] font-bold text-st-selesai">
          {keadaan.pesan}
        </p>
      )}
      <button
        type="submit"
        disabled={sedangMengirim}
        className="mt-2 inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98] disabled:bg-permukaan-2 disabled:text-tinta-redup"
      >
        {sedangMengirim ? "Mengirim…" : "Kirim tautan"}
      </button>
    </form>
  );
}
