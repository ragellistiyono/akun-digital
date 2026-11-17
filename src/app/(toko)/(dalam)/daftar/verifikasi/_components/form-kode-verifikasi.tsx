"use client";

import { useActionState } from "react";

import { Isian, PesanGalat } from "../../../../../_masuk/form-masuk";
import { aksiMasukkanKode } from "../../aksi";
import type { KeadaanFormKode } from "../../pesan-daftar";

const KEADAAN_AWAL: KeadaanFormKode = {};

/**
 * Isian Kode verifikasi 6 digit dengan tombol "Verifikasi" (PRD §7.3). Penolakan kode tampil di bawah
 * isian.
 */
export function FormKodeVerifikasi() {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    aksiMasukkanKode,
    KEADAAN_AWAL,
  );

  return (
    <form action={aksi} noValidate className="flex flex-col gap-4">
      <Isian
        nama="kode"
        label="Kode verifikasi"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        bantuan="Kode 6 angka di email terakhir dari kami."
        galat={keadaan.galat?.kode}
      />
      {keadaan.galat?.umum && (
        <PesanGalat id="kode-galat-umum" peran="alert">
          {keadaan.galat.umum}
        </PesanGalat>
      )}
      <button
        type="submit"
        disabled={sedangMengirim}
        className="inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98] disabled:bg-permukaan-2 disabled:text-tinta-redup"
      >
        {sedangMengirim ? "Memeriksa…" : "Verifikasi"}
      </button>
    </form>
  );
}
