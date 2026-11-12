"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";

import { KELAS_TOMBOL_GARIS } from "../../_components/isian-form";
import { aksiUbahFormatItemStok, type KeadaanFormatItemStok } from "../aksi";
import { EditorFormatItemStok } from "./form-produk";

const KELAS_TOMBOL_SIMPAN = `${KELAS_TOMBOL_GARIS} disabled:bg-permukaan-2 disabled:text-tinta-redup`;

/**
 * Form ubah Format Item stok (PRD §4.1). Setiap kolom lama membawa nomor kolom lamanya, supaya server bisa
 * membedakan ganti nama dari tambah dan hapus kolom. Setelah Format tersimpan, atau saat Admin memilih Batal,
 * form ditutup lewat `onSelesai`.
 */
function FormFormatItemStok({
  produkId,
  kolom,
  onSelesai,
}: {
  produkId: string;
  kolom: string[];
  onSelesai: (tersimpan: boolean) => void;
}) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState<
    KeadaanFormatItemStok,
    FormData
  >(
    async (sebelumnya, formData) => {
      const hasil = await aksiUbahFormatItemStok(sebelumnya, formData);
      if (hasil.tersimpan) onSelesai(true);
      return hasil;
    },
    { kolom: kolom.map((nama, i) => ({ nama, nomorLama: i + 1 })) },
  );

  // Daftar kolom dipasang ulang dengan isian yang dikirim setiap kali server menjawab, supaya
  // pengaturan ulang form setelah aksi tidak mengembalikan kolom ke isi awalnya.
  const [keadaanTerakhir, setKeadaanTerakhir] = useState(keadaan);
  const [versi, setVersi] = useState(0);
  if (keadaan !== keadaanTerakhir) {
    setKeadaanTerakhir(keadaan);
    setVersi(versi + 1);
  }

  return (
    <form
      action={aksi}
      noValidate
      aria-label="Ubah Format Item stok"
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="id" value={produkId} />
      <EditorFormatItemStok
        key={versi}
        kolomAwal={keadaan.kolom}
        kolomDitolak={keadaan.galat?.kolomDitolak}
        galat={keadaan.galat?.pesan}
        bantuan="Nama kolom bisa diganti kapan saja. Kolom hanya bisa ditambah atau dihapus bila Produk ini tidak punya Item stok Tersedia atau Ditahan."
      />
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={sedangMenyimpan}
          className={KELAS_TOMBOL_SIMPAN}
        >
          {sedangMenyimpan ? "Menyimpan…" : "Simpan Format Item stok"}
        </button>
        <button
          type="button"
          onClick={() => onSelesai(false)}
          className={KELAS_TOMBOL_GARIS}
        >
          Batal
        </button>
      </div>
    </form>
  );
}

/**
 * Format Item stok di halaman Ubah Produk (PRD §4.1): daftar nama kolom menurut urutannya, dan form untuk
 * mengubahnya. Format Item stok tersimpan saat Simpan Format Item stok dipilih, terpisah dari tombol Simpan
 * di form Produk.
 */
export function FormatItemStokProduk({
  produkId,
  kolom,
}: {
  produkId: string;
  kolom: string[];
}) {
  const [mengubah, setMengubah] = useState(false);
  const [tersimpan, setTersimpan] = useState(false);

  return (
    <section
      aria-labelledby="format-judul"
      className="mt-4 flex max-w-[560px] flex-col gap-6 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <div className="flex flex-col gap-2">
        <h2
          id="format-judul"
          className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]"
        >
          Format Item stok
        </h2>
        <p className="text-[13px] text-tinta-redup">
          Nama kolom untuk mengisi Item stok semua Varian Produk ini. Item stok
          Terkirim tetap tampil dengan nama kolom saat dikirim. Format Item stok
          tersimpan saat Simpan Format Item stok dipilih, terpisah dari tombol
          Simpan di form Produk.
        </p>
      </div>

      {mengubah ? (
        <FormFormatItemStok
          produkId={produkId}
          kolom={kolom}
          onSelesai={(berhasil) => {
            setMengubah(false);
            setTersimpan(berhasil);
          }}
        />
      ) : (
        <>
          <ol aria-labelledby="format-judul" className="flex flex-wrap gap-2">
            {kolom.map((nama, i) => (
              <li
                key={`${i}-${nama}`}
                className="inline-flex h-9 items-center rounded-[10px] bg-permukaan-2 px-3 text-sm font-bold break-all"
              >
                {nama}
              </li>
            ))}
          </ol>
          {tersimpan && (
            <p
              role="status"
              className="flex items-start gap-2 text-[13px] font-bold text-st-selesai"
            >
              <Check aria-hidden="true" className="size-6 shrink-0" />
              Format Item stok tersimpan.
            </p>
          )}
          <div>
            <button
              type="button"
              onClick={() => {
                setTersimpan(false);
                setMengubah(true);
              }}
              className={KELAS_TOMBOL_GARIS}
            >
              Ubah Format Item stok
            </button>
          </div>
        </>
      )}
    </section>
  );
}
