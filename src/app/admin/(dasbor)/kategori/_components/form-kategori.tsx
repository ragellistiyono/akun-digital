"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";

import { Keterangan } from "../../_components/keterangan-isian";
import {
  aksiBuatKategori,
  aksiUbahKategori,
  type KeadaanFormKategori,
} from "../aksi";

/**
 * Form Kategori untuk membuat (tanpa `kategori`) atau mengubah Kategori yang sudah ada. Saat mengubah,
 * gambar ikon boleh tidak dipilih supaya ikon lama tetap dipakai.
 */
export function FormKategori({
  kategori,
  batasUkuranMb,
}: {
  kategori?: { id: string; nama: string; alamatIkon: string };
  batasUkuranMb: number;
}) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState<
    KeadaanFormKategori,
    FormData
  >(kategori ? aksiUbahKategori : aksiBuatKategori, {
    nama: kategori?.nama ?? "",
  });
  const galatNama = keadaan.galat?.nama;
  const galatIkon = keadaan.galat?.ikon;
  const syaratGambar = `PNG, JPEG, atau WebP, paling besar ${batasUkuranMb} MB.`;

  return (
    <form
      action={aksi}
      noValidate
      className="kartu flex flex-col gap-6 p-4 sm:p-6"
    >
      {kategori && <input type="hidden" name="id" value={kategori.id} />}

      <div className="flex flex-col gap-2">
        <label htmlFor="nama" className="text-[17px] leading-tight">
          Nama
        </label>
        <input
          id="nama"
          name="nama"
          autoComplete="off"
          defaultValue={keadaan.nama}
          aria-invalid={galatNama ? true : undefined}
          aria-describedby={galatNama ? "nama-keterangan" : undefined}
          className="isian"
        />
        <Keterangan id="nama-keterangan" galat={galatNama} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="ikon" className="text-[17px] leading-tight">
          {kategori ? "Ganti gambar ikon" : "Gambar ikon"}
        </label>
        {kategori && (
          <div className="flex items-center gap-3 text-[15px] text-pensil-redup">
            <Image
              unoptimized
              src={kategori.alamatIkon}
              alt=""
              width={48}
              height={48}
              className="size-12 rounded-coret-bulat border-2 border-pensil bg-kertas-lama p-2 object-contain"
            />
            Ikon saat ini
          </div>
        )}
        <input
          id="ikon"
          name="ikon"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-invalid={galatIkon ? true : undefined}
          aria-describedby="ikon-keterangan"
          className="rounded-coret-alt border-2 border-dashed border-pensil bg-permukaan p-2 text-[15px] text-pensil-redup file:mr-3 file:h-10 file:cursor-pointer file:rounded-coret file:border-2 file:border-solid file:border-pensil file:bg-kertas-lama file:px-4 file:text-[17px] file:text-pensil hover:file:bg-pulpen hover:file:text-teks-di-pulpen aria-invalid:border-solid aria-invalid:border-aksi"
        />
        <Keterangan
          id="ikon-keterangan"
          galat={galatIkon}
          bantuan={
            kategori
              ? `Kosongkan bila ikon tidak diganti. ${syaratGambar}`
              : syaratGambar
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={sedangMenyimpan} className="tombol">
          {sedangMenyimpan ? "Menyimpan…" : "Simpan"}
        </button>
        <Link href="/admin/kategori" className="tombol tombol-kedua">
          Batal
        </Link>
      </div>
    </form>
  );
}
