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
      className="flex flex-col gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <h2 id="ganti-password-judul" className="text-lg font-extrabold">
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
        <p role="status" className="text-[13px] font-bold text-st-selesai">
          {keadaan.berhasil}
        </p>
      )}
      <button
        type="submit"
        disabled={sedangMengirim}
        className="mt-2 inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98] disabled:bg-permukaan-2 disabled:text-tinta-redup"
      >
        {sedangMengirim ? "Menyimpan…" : "Ganti password"}
      </button>
    </form>
  );
}
