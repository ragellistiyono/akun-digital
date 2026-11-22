"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";

import { Keterangan } from "./keterangan-isian";
import { ModalPenegasan } from "./modal-penegasan";

type KeadaanHapus = { galat?: string };

/** Tombol kecil 40 px (DESIGN.md Buttons). Hover-nya terisi merah `aksi`, jadi cocok untuk tombol hapus. */
const KELAS_TOMBOL_KECIL = "tombol tombol-kecil";

/**
 * Tombol hapus yang membuka Modal penegasan (PRD §9.10), seperti hapus Varian di halaman Ubah Produk. Modal itu
 * berjudul `judul`, misalnya "Hapus Varian?", dengan rincian "Hapus `nama`? `akibat`", lalu tombol "Ya, hapus
 * `nama`" dan Batal. Tombol "Ya, …" mengirim `isian` sebagai isian tersembunyi ke `aksi`. Setelah aksi selesai,
 * modal tertutup. Bila server menolak, misalnya karena aturan PRD §3.1 atau §3.7, pesannya tampil di bawah tombol.
 */
export function PenegasanHapus({
  aksi,
  isian,
  judul,
  nama,
  akibat,
  tombol,
  idGalat,
}: {
  aksi: (sebelumnya: KeadaanHapus, formData: FormData) => Promise<KeadaanHapus>;
  isian: Record<string, string>;
  judul: string;
  nama: string;
  akibat: string;
  tombol: ReactNode;
  idGalat: string;
}) {
  const [menegaskan, setMenegaskan] = useState(false);
  const pemicu = useRef<HTMLButtonElement>(null);
  const [keadaan, kirim, sedangMenghapus] = useActionState<
    KeadaanHapus,
    FormData
  >(async (sebelumnya, formData) => {
    const hasil = await aksi(sebelumnya, formData);
    setMenegaskan(false);
    return hasil;
  }, {});

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          ref={pemicu}
          type="button"
          onClick={() => setMenegaskan(true)}
          className={KELAS_TOMBOL_KECIL}
        >
          {tombol}
        </button>
      </div>
      {menegaskan && (
        <ModalPenegasan
          pemicu={pemicu}
          judul={judul}
          rincian={`Hapus ${nama}? ${akibat}`}
          labelYa={`Ya, hapus ${nama}`}
          labelProses="Menghapus…"
          aksi={kirim}
          isian={isian}
          sedangMemproses={sedangMenghapus}
          onBatal={() => setMenegaskan(false)}
        />
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
 * Panel "Hapus …" di bawah halaman ubah Kategori, Produk, Voucher, atau Biaya operasional: judul, keterangan kapan
 * penghapusan diterima beserta akibatnya, dan PenegasanHapus dengan tombol berlabel sama dengan judulnya. Modal
 * penegasannya berjudul sama dengan tanda tanya, misalnya "Hapus Voucher?". Panel ini tidak
 * membawa lebar maupun margin luar sendiri: ia selebar kolom pemakainya, dan jaraknya diatur halaman pemakainya
 * (DESIGN.md Tata letak halaman, Dasbor admin).
 */
export function PanelHapus({
  judul,
  keterangan,
  ...penegasan
}: Omit<
  Parameters<typeof PenegasanHapus>[0],
  "judul" | "tombol" | "idGalat"
> & {
  judul: string;
  keterangan: string;
}) {
  return (
    <section
      aria-labelledby="hapus-judul"
      className="kartu flex flex-col gap-4 border-aksi p-4 sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 id="hapus-judul" className="text-[26px]">
          {judul}
        </h2>
        <p className="text-[15px] text-pensil-redup">{keterangan}</p>
      </div>
      <PenegasanHapus
        {...penegasan}
        judul={`${judul}?`}
        tombol={judul}
        idGalat="hapus-galat"
      />
    </section>
  );
}
