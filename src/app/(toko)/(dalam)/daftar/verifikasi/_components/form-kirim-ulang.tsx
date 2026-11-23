"use client";

import { useActionState } from "react";

import { PesanGalat } from "../../../../../_masuk/form-masuk";
import { aksiKirimUlangKode } from "../../aksi";
import type { KeadaanKirimUlang } from "../../pesan-daftar";
import { PARAMETER_TUJUAN } from "../../tujuan";

const KEADAAN_AWAL: KeadaanKirimUlang = { pesan: null };

/**
 * Tombol kedua "Kirim ulang kode" (PRD §7.7), dengan hasilnya di bawah tombol: pesan untuk menunggu
 * bila jeda 60 detik belum habis, atau kabar bahwa kode baru sudah dikirim. `onTerkirim` dipanggil
 * setiap kali kode baru berhasil dikirim. Form ini membawa `tujuan` setelah verifikasi, bila ada, untuk
 * browser yang dibawa kembali ke halaman Daftar (PRD §7.3 ▶ Keputusan 2026-11-22).
 */
export function FormKirimUlang({
  tujuan,
  onTerkirim,
}: {
  tujuan: string | null;
  onTerkirim: () => void;
}) {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    async (_sebelumnya: KeadaanKirimUlang, formData: FormData) => {
      const hasil = await aksiKirimUlangKode(formData);
      if (hasil.pesan?.jenis === "terkirim") onTerkirim();
      return hasil;
    },
    KEADAAN_AWAL,
  );

  return (
    <form action={aksi} className="flex flex-col gap-4">
      {tujuan && <input type="hidden" name={PARAMETER_TUJUAN} value={tujuan} />}
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
