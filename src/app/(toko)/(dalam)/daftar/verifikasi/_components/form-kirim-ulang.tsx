"use client";

import { useActionState } from "react";

import { PesanGalat } from "../../../../../_masuk/form-masuk";
import { aksiKirimUlangKode } from "../../aksi";
import type { KeadaanKirimUlang } from "../../pesan-daftar";

const KEADAAN_AWAL: KeadaanKirimUlang = { pesan: null };

/**
 * Tombol kedua "Kirim ulang kode" (PRD §7.7), dengan hasilnya di bawah tombol: pesan untuk menunggu
 * bila jeda 60 detik belum habis, atau kabar bahwa kode baru sudah dikirim. `onTerkirim` dipanggil
 * setiap kali kode baru berhasil dikirim.
 */
export function FormKirimUlang({ onTerkirim }: { onTerkirim: () => void }) {
  const [keadaan, aksi, sedangMengirim] = useActionState(async () => {
    const hasil = await aksiKirimUlangKode();
    if (hasil.pesan?.jenis === "terkirim") onTerkirim();
    return hasil;
  }, KEADAAN_AWAL);

  return (
    <form action={aksi} className="flex flex-col gap-4">
      <button
        type="submit"
        disabled={sedangMengirim}
        className="tombol tombol-kedua w-full"
      >
        {sedangMengirim ? "Mengirim…" : "Kirim ulang kode"}
      </button>
      {keadaan.pesan?.jenis === "galat" && (
        <PesanGalat id="kirim-ulang-galat" peran="alert">
          {keadaan.pesan.teks}
        </PesanGalat>
      )}
      {keadaan.pesan?.jenis === "terkirim" && (
        <p role="status" className="text-[16px] leading-snug text-st-selesai">
          {keadaan.pesan.teks}
        </p>
      )}
    </form>
  );
}
