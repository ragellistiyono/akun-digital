"use client";

import { useActionState } from "react";

import { Isian, PesanGalat } from "../../../../_masuk/form-masuk";
import { aksiGantiPassword } from "../aksi";
import type { KeadaanFormGantiPassword } from "../pesan-akun";

const KEADAAN_AWAL: KeadaanFormGantiPassword = {};

/**
 * Form ganti password di tab Akun Member: password lama, password baru minimal 8 karakter, dan tombol
 * "Ganti password" (PRD §7.6 ▶ Keputusan 2026-11-17). Kedua isian dikosongkan setiap kali form dikirim.
 */
export function FormGantiPassword() {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    aksiGantiPassword,
    KEADAAN_AWAL,
  );

  return (
    <form
      action={aksi}
      noValidate
      aria-labelledby="ganti-password-judul"
      className="kartu flex flex-col gap-4 p-5"
    >
      <h2 id="ganti-password-judul" className="text-[26px]">
        Ganti password
      </h2>
      <Isian
        nama="passwordLama"
        label="Password lama"
        type="password"
        autoComplete="current-password"
        galat={keadaan.galat?.passwordLama}
      />
      <Isian
        nama="passwordBaru"
        label="Password baru"
        type="password"
        autoComplete="new-password"
        bantuan="Minimal 8 karakter."
        galat={keadaan.galat?.passwordBaru}
      />
      {keadaan.galat?.umum && (
        <PesanGalat id="ganti-password-galat" peran="alert">
          {keadaan.galat.umum}
        </PesanGalat>
      )}
      {keadaan.berhasil && (
        <p role="status" className="text-[16px] leading-snug text-st-selesai">
          {keadaan.berhasil}
        </p>
      )}
      <button
        type="submit"
        disabled={sedangMengirim}
        className="tombol mt-2 w-full"
      >
        {sedangMengirim ? "Menyimpan…" : "Ganti password"}
      </button>
    </form>
  );
}
