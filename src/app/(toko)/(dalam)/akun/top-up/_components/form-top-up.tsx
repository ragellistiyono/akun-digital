"use client";

import { useActionState, useState } from "react";

import {
  NOMINAL_TOP_UP_MAKSIMAL,
  NOMINAL_TOP_UP_MINIMAL,
} from "@/domain/isian-top-up";
import { rupiah } from "@/lib/rupiah";

import { Isian } from "../../../../../_masuk/form-masuk";
import { aksiBuatTopUp, type KeadaanFormTopUp } from "../aksi";

/** Tombol cepat Halaman Top up (PRD §15.3), dalam rupiah. */
const NOMINAL_CEPAT = [50_000, 100_000, 200_000] as const;

const KEADAAN_AWAL: KeadaanFormTopUp = {};

/**
 * Form Halaman Top up (PRD §15.3): isian Nominal top up, tiga tombol cepat Rp 50.000, Rp 100.000, dan Rp 200.000 yang
 * mengisi isian itu dengan angkanya, lalu tombol "Bayar dengan QRIS". Isian tetap terisi setelah ditolak, dan pesan
 * penolakannya tampil di bawah isian.
 */
export function FormTopUp() {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    aksiBuatTopUp,
    KEADAAN_AWAL,
  );
  const [nominal, setNominal] = useState("");

  return (
    <form
      action={aksi}
      noValidate
      aria-label="Top up"
      className="kartu flex flex-col gap-4 p-5"
    >
      <Isian
        nama="nominal"
        label="Nominal top up"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Contoh: 50.000"
        bantuan={`Rupiah bulat, ${rupiah(NOMINAL_TOP_UP_MINIMAL)} sampai ${rupiah(NOMINAL_TOP_UP_MAKSIMAL)}.`}
        value={nominal}
        onChange={(e) => setNominal(e.target.value)}
        galat={keadaan.galat}
      />
      <div className="flex flex-wrap gap-2">
        {NOMINAL_CEPAT.map((nilai) => (
          <button
            key={nilai}
            type="button"
            onClick={() => setNominal(String(nilai))}
            className="tombol tombol-kecil tombol-kedua flex-1"
          >
            {rupiah(nilai)}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={sedangMengirim}
        className="tombol mt-2 w-full"
      >
        {sedangMengirim ? "Membuat QRIS…" : "Bayar dengan QRIS"}
      </button>
    </form>
  );
}
