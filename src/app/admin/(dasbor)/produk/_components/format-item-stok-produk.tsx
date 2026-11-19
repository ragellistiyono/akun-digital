"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";

import { aksiUbahFormatItemStok, type KeadaanFormatItemStok } from "../aksi";
import { EditorFormatItemStok } from "./form-produk";

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
        <button type="submit" disabled={sedangMenyimpan} className="tombol">
          {sedangMenyimpan ? "Menyimpan…" : "Simpan Format Item stok"}
        </button>
        <button
          type="button"
          onClick={() => onSelesai(false)}
          className="tombol tombol-kedua"
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
      className="kartu flex flex-col gap-6 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 id="format-judul" className="text-[26px]">
          Format Item stok
        </h2>
        <p className="text-base text-pensil-redup">
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
                className="inline-flex min-h-10 items-center rounded-coret border-2 border-dashed border-pensil bg-kertas-lama px-3 text-[17px] break-all"
              >
                {nama}
              </li>
            ))}
          </ol>
          {tersimpan && (
            <p
              role="status"
              className="flex items-start gap-2 text-base text-st-selesai"
            >
              <Check
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0"
                strokeWidth={2.5}
              />
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
              className="tombol tombol-kedua"
            >
              Ubah Format Item stok
            </button>
          </div>
        </>
      )}
    </section>
  );
}
