"use client";

import { useActionState, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Keterangan } from "./keterangan-isian";

type KeadaanHapus = { galat?: string };

/** Tombol kecil 36 px (DESIGN.md Buttons). */
const KELAS_TOMBOL_KECIL =
  "inline-flex h-9 items-center rounded-[10px] border-[1.5px] border-garis bg-permukaan px-3 text-sm font-bold text-tinta hover:border-monogram disabled:bg-permukaan-2 disabled:text-tinta-redup";

/**
 * Tombol hapus yang meminta penegasan di tempat, tanpa dialog, seperti hapus Item stok di halaman Varian.
 * Setelah tombol dipilih, tampil pertanyaan "Hapus `nama`?" beserta `akibat`-nya, lalu tombol "Ya, hapus
 * `nama`" dan Batal. Form penegasan mengirim `isian` sebagai isian tersembunyi ke `aksi`. Bila server menolak,
 * misalnya karena aturan PRD §3.1 atau §3.7, pesannya tampil di bawah tombol.
 */
export function PenegasanHapus({
  aksi,
  isian,
  nama,
  akibat,
  tombol,
  idGalat,
}: {
  aksi: (sebelumnya: KeadaanHapus, formData: FormData) => Promise<KeadaanHapus>;
  isian: Record<string, string>;
  nama: string;
  akibat: string;
  tombol: ReactNode;
  idGalat: string;
}) {
  const [menegaskan, setMenegaskan] = useState(false);
  const [keadaan, kirim, sedangMenghapus] = useActionState<
    KeadaanHapus,
    FormData
  >(aksi, {});

  return (
    <div className="flex flex-col gap-2">
      {menegaskan ? (
        <form action={kirim} className="flex flex-col gap-2">
          {Object.entries(isian).map(([namaIsian, nilai]) => (
            <input
              key={namaIsian}
              type="hidden"
              name={namaIsian}
              value={nilai}
            />
          ))}
          <p className="text-sm font-bold [overflow-wrap:anywhere]">
            Hapus {nama}? {akibat}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={sedangMenghapus}
              className={cn(KELAS_TOMBOL_KECIL, "text-st-masalah")}
            >
              {sedangMenghapus ? "Menghapus…" : `Ya, hapus ${nama}`}
            </button>
            <button
              type="button"
              onClick={() => setMenegaskan(false)}
              className={KELAS_TOMBOL_KECIL}
            >
              Batal
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setMenegaskan(true)}
            className={KELAS_TOMBOL_KECIL}
          >
            {tombol}
          </button>
        </div>
      )}
      {keadaan.galat && (
        <div role="alert">
          <Keterangan id={idGalat} galat={keadaan.galat} />
        </div>
      )}
    </div>
  );
}

/**
 * Panel "Hapus …" di bawah halaman ubah Kategori atau Produk: judul, keterangan kapan penghapusan diterima
 * beserta akibatnya, dan PenegasanHapus dengan tombol berlabel sama dengan judulnya.
 */
export function PanelHapus({
  judul,
  keterangan,
  ...penegasan
}: Omit<Parameters<typeof PenegasanHapus>[0], "tombol" | "idGalat"> & {
  judul: string;
  keterangan: string;
}) {
  return (
    <section
      aria-labelledby="hapus-judul"
      className="mt-4 flex max-w-[560px] flex-col gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <div className="flex flex-col gap-2">
        <h2
          id="hapus-judul"
          className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]"
        >
          {judul}
        </h2>
        <p className="text-[13px] text-tinta-redup">{keterangan}</p>
      </div>
      <PenegasanHapus {...penegasan} tombol={judul} idGalat="hapus-galat" />
    </section>
  );
}
