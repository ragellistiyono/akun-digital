"use client";

import { TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";

import {
  aksiBuatKategori,
  aksiUbahKategori,
  type KeadaanFormKategori,
} from "../aksi";

/** Teks bantuan di bawah isian, yang diganti pesan galat bila isian ditolak (DESIGN.md Inputs / Fields). */
function Keterangan({
  id,
  galat,
  bantuan,
}: {
  id: string;
  galat?: string;
  bantuan?: string;
}) {
  if (galat) {
    return (
      <p
        id={id}
        className="flex items-start gap-2 text-[13px] font-bold text-st-masalah"
      >
        <TriangleAlert aria-hidden="true" className="size-6 shrink-0" />
        {galat}
      </p>
    );
  }
  if (!bantuan) return null;
  return (
    <p id={id} className="text-[13px] text-tinta-redup">
      {bantuan}
    </p>
  );
}

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
      className="mt-6 flex max-w-[560px] flex-col gap-6 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      {kategori && <input type="hidden" name="id" value={kategori.id} />}

      <div className="flex flex-col gap-2">
        <label htmlFor="nama" className="text-sm font-bold">
          Nama
        </label>
        <input
          id="nama"
          name="nama"
          autoComplete="off"
          defaultValue={keadaan.nama}
          aria-invalid={galatNama ? true : undefined}
          aria-describedby={galatNama ? "nama-keterangan" : undefined}
          className="h-[52px] rounded-[14px] border-[1.5px] border-garis bg-permukaan px-4 text-base text-tinta focus-visible:border-aksi focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--monogram)_30%,transparent)] focus-visible:outline-none aria-invalid:border-st-masalah"
        />
        <Keterangan id="nama-keterangan" galat={galatNama} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="ikon" className="text-sm font-bold">
          {kategori ? "Ganti gambar ikon" : "Gambar ikon"}
        </label>
        {kategori && (
          <div className="flex items-center gap-3 text-[13px] text-tinta-redup">
            <Image
              unoptimized
              src={kategori.alamatIkon}
              alt=""
              width={48}
              height={48}
              className="size-12 rounded-[10px] bg-permukaan-2 object-contain"
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
          className="rounded-[14px] border-[1.5px] border-garis bg-permukaan p-2 text-sm text-tinta-redup file:mr-3 file:h-9 file:rounded-[10px] file:border-[1.5px] file:border-solid file:border-garis file:bg-permukaan-2 file:px-3 file:text-sm file:font-bold file:text-tinta hover:file:border-monogram aria-invalid:border-st-masalah"
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
        <button
          type="submit"
          disabled={sedangMenyimpan}
          className="inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98] disabled:bg-permukaan-2 disabled:text-tinta-redup"
        >
          {sedangMenyimpan ? "Menyimpan…" : "Simpan"}
        </button>
        <Link
          href="/admin/kategori"
          className="inline-flex h-[52px] items-center justify-center rounded-[14px] border-[1.5px] border-garis bg-permukaan px-6 text-base font-extrabold text-tinta hover:border-monogram"
        >
          Batal
        </Link>
      </div>
    </form>
  );
}
