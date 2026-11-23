"use client";

import { useActionState } from "react";

import { Isian, PesanGalat } from "../../../../../_masuk/form-masuk";
import { aksiMasukkanKode } from "../../aksi";
import type { KeadaanFormKode } from "../../pesan-daftar";
import { PARAMETER_TUJUAN } from "../../tujuan";

const KEADAAN_AWAL: KeadaanFormKode = {};

/**
 * Isian Kode verifikasi 6 digit dengan tombol "Verifikasi" (PRD §7.3). Penolakan kode tampil di bawah
 * isian. Form ini membawa `tujuan` setelah verifikasi, bila ada (PRD §7.3 ▶ Keputusan 2026-11-22).
 */
export function FormKodeVerifikasi({ tujuan }: { tujuan: string | null }) {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    aksiMasukkanKode,
    KEADAAN_AWAL,
  );

  return (
    <form action={aksi} noValidate className="flex flex-col gap-4">
      {tujuan && <input type="hidden" name={PARAMETER_TUJUAN} value={tujuan} />}
      <Isian
        nama="kode"
        label="Kode verifikasi"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        bantuan="Kode 6 angka di email terakhir dari kami."
        galat={keadaan.galat?.kode}
        className="text-[26px] tracking-[0.4em] uppercase"
      />
      {keadaan.galat?.umum && (
        <PesanGalat id="kode-galat-umum" peran="alert">
          {keadaan.galat.umum}
        </PesanGalat>
      )}
      <button type="submit" disabled={sedangMengirim} className="tombol w-full">
        {sedangMengirim ? "Memeriksa…" : "Verifikasi"}
      </button>
    </form>
  );
}
