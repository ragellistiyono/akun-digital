"use client";

import Link from "next/link";
import { useActionState } from "react";

import { IsianTeks, KELAS_ISIAN } from "../../../_components/isian-form";
import { Keterangan } from "../../../_components/keterangan-isian";
import {
  aksiTambahBiayaOperasional,
  aksiUbahBiayaOperasional,
  type KeadaanFormBiayaOperasional,
} from "../aksi";
import { alamatBulan } from "../alamat";

/**
 * Form Biaya operasional untuk mencatat biaya baru (tanpa `idBiaya`) atau mengubah biaya yang sudah ada
 * (PRD §14.4). `hariIni` adalah tanggal WIB "YYYY-MM-DD", batas akhir isian tanggal. Form tidak memakai validasi
 * browser (`noValidate`), supaya tanggal yang akan datang tetap sampai ke server dan ditolak dengan pesan di
 * isiannya. Batal kembali ke daftar bulan `bulanBatal`.
 */
export function FormBiayaOperasional({
  idBiaya,
  awal,
  hariIni,
  bulanBatal,
}: {
  idBiaya?: string;
  awal: KeadaanFormBiayaOperasional;
  hariIni: string;
  bulanBatal: string;
}) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState<
    KeadaanFormBiayaOperasional,
    FormData
  >(idBiaya ? aksiUbahBiayaOperasional : aksiTambahBiayaOperasional, awal);
  const { isian, galat = {} } = keadaan;

  return (
    // Isian dipasang ulang setiap keadaan baru tiba, supaya nilai yang dikembalikan server ikut tampil.
    <form
      key={JSON.stringify(isian)}
      action={aksi}
      noValidate
      className="kartu flex flex-col gap-6 p-4 sm:p-6"
    >
      {idBiaya && <input type="hidden" name="id" value={idBiaya} />}

      <div className="flex flex-col gap-2">
        <label htmlFor="tanggal" className="text-[17px] leading-tight">
          Tanggal
        </label>
        <input
          id="tanggal"
          name="tanggal"
          type="date"
          max={hariIni}
          defaultValue={isian.tanggal}
          aria-invalid={galat.tanggal ? true : undefined}
          aria-describedby="tanggal-keterangan"
          className={`${KELAS_ISIAN} h-[52px]`}
        />
        <Keterangan
          id="tanggal-keterangan"
          galat={galat.tanggal}
          bantuan="Paling lambat hari ini, menurut WIB."
        />
      </div>

      <IsianTeks
        nama="keterangan"
        label="Keterangan"
        nilaiAwal={isian.keterangan}
        galat={galat.keterangan}
        bantuan="Untuk apa biaya ini, paling banyak 100 karakter. Misalnya Sewa server November."
      />

      <IsianTeks
        nama="nominal"
        label="Nominal"
        nilaiAwal={isian.nominal}
        galat={galat.nominal}
        bantuan="Rupiah bulat, minimal Rp 1. Misalnya 150.000."
        inputMode="numeric"
      />

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={sedangMenyimpan} className="tombol">
          {sedangMenyimpan ? "Menyimpan…" : "Simpan"}
        </button>
        <Link href={alamatBulan(bulanBatal)} className="tombol tombol-kedua">
          Batal
        </Link>
      </div>
    </form>
  );
}
