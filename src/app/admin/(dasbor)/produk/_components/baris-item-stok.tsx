"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { itemStokBolehDiubah, type StatusItemStok } from "@/domain/item-stok";
import { cn } from "@/lib/utils";

import { IsianTeks, KELAS_TOMBOL_GARIS } from "../../_components/isian-form";
import { Keterangan } from "../../_components/keterangan-isian";
import { PilStatusItemStok } from "../../_components/pil";
import {
  aksiHapusItemStok,
  aksiUbahItemStok,
  type KeadaanFormItemStok,
  type KeadaanHapusItemStok,
} from "../aksi-item-stok";

/** Satu Item stok di daftar Item stok Varian (PRD §9.7), seperti yang dibaca daftarItemStokVarian. */
type ItemStok = {
  id: string;
  status: StatusItemStok;
  nomorPesanan: string | null;
  kolom: { nama: string; nilai: string }[];
};

type ItemStokDipilih = { produkId: string; varianId: string; id: string };

const KELAS_TOMBOL_SIMPAN = `${KELAS_TOMBOL_GARIS} disabled:bg-permukaan-2 disabled:text-tinta-redup`;

/** Tombol kecil 36 px di baris Item stok (DESIGN.md Buttons). */
const KELAS_TOMBOL_KECIL =
  "inline-flex h-9 items-center rounded-[10px] border-[1.5px] border-garis bg-permukaan px-3 text-sm font-bold text-tinta hover:border-monogram disabled:bg-permukaan-2 disabled:text-tinta-redup";

function IdItemStok({ produkId, varianId, id }: ItemStokDipilih) {
  return (
    <>
      <input type="hidden" name="produkId" value={produkId} />
      <input type="hidden" name="varianId" value={varianId} />
      <input type="hidden" name="itemStokId" value={id} />
    </>
  );
}

/**
 * Form ubah Item stok Tersedia, dengan satu isian untuk setiap kolom Format Item stok yang terisi isinya
 * sekarang. Setelah tersimpan, atau saat Admin memilih Batal, form ditutup lewat `onSelesai`, dan daftar yang
 * sudah diperbarui menjadi tandanya (DESIGN.md Navigation, keputusan 2026-11-11 #53).
 */
function FormUbahItemStok({
  dipilih,
  nomor,
  kolom,
  onSelesai,
}: {
  dipilih: ItemStokDipilih;
  nomor: number;
  kolom: ItemStok["kolom"];
  onSelesai: () => void;
}) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState<
    KeadaanFormItemStok,
    FormData
  >(
    async (sebelumnya, formData) => {
      const hasil = await aksiUbahItemStok(sebelumnya, formData);
      if (hasil.tersimpan) onSelesai();
      return hasil;
    },
    { nilai: kolom.map(({ nilai }) => nilai) },
  );
  const galat = keadaan.galat;
  // Halaman bisa memuat beberapa form ubah sekaligus, jadi setiap isian diberi id sendiri.
  const awalan = `item-stok-${dipilih.id}`;

  return (
    <form
      action={aksi}
      noValidate
      aria-label={`Ubah Item stok ${nomor}`}
      className="flex flex-col gap-6"
    >
      <IdItemStok {...dipilih} />
      {kolom.map(({ nama }, i) => (
        <IsianTeks
          key={`${i}-${nama}`}
          nama="nilai"
          id={`${awalan}-kolom-${i + 1}`}
          label={nama}
          nilaiAwal={keadaan.nilai[i] ?? ""}
          galat={galat?.kolom?.[i] ?? undefined}
          autoFocus={i === 0}
          mono
        />
      ))}
      {galat?.umum && (
        <div role="alert">
          <Keterangan id={`${awalan}-galat`} galat={galat.umum} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={sedangMenyimpan}
          className={KELAS_TOMBOL_SIMPAN}
        >
          {sedangMenyimpan ? "Menyimpan…" : "Simpan Item stok"}
        </button>
        <button
          type="button"
          onClick={onSelesai}
          className={KELAS_TOMBOL_GARIS}
        >
          Batal
        </button>
      </div>
    </form>
  );
}

/**
 * Tombol Ubah dan Hapus untuk Item stok Tersedia. Hapus meminta penegasan lebih dulu, karena isi Item stok
 * yang terhapus tidak bisa dikembalikan. Bila server menolak, misalnya karena Item stok itu baru saja ditahan
 * checkout, pesannya tampil di bawah tombol.
 */
function AksiItemStok({
  dipilih,
  nomor,
  onUbah,
}: {
  dipilih: ItemStokDipilih;
  nomor: number;
  onUbah: () => void;
}) {
  const [menegaskan, setMenegaskan] = useState(false);
  const [keadaan, aksi, sedangMenghapus] = useActionState<
    KeadaanHapusItemStok,
    FormData
  >(aksiHapusItemStok, {});
  const nama = `Item stok ${nomor}`;

  return (
    <div className="flex flex-col gap-2">
      {menegaskan ? (
        <form action={aksi} className="flex flex-col gap-2">
          <IdItemStok {...dipilih} />
          <p className="text-sm font-bold">
            Hapus {nama}? Isinya tidak bisa dikembalikan.
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
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onUbah} className={KELAS_TOMBOL_KECIL}>
            Ubah<span className="sr-only"> {nama}</span>
          </button>
          <button
            type="button"
            onClick={() => setMenegaskan(true)}
            className={KELAS_TOMBOL_KECIL}
          >
            Hapus<span className="sr-only"> {nama}</span>
          </button>
        </div>
      )}
      {keadaan.galat && (
        <div role="alert">
          <Keterangan
            id={`item-stok-${dipilih.id}-galat-hapus`}
            galat={keadaan.galat}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Satu Item stok di daftar Item stok Varian (PRD §9.7): nomor urutnya di daftar, pil statusnya, Nomor Pesanan
 * yang menahannya (Ditahan) atau menerimanya (Terkirim), dan isi lengkapnya per kolom. Item stok Tersedia
 * bisa diubah atau dihapus (PRD §4.4); tombolnya tidak tampil untuk status lain, dan server tetap menolaknya.
 */
export function BarisItemStok({
  produkId,
  varianId,
  itemStok,
  nomor,
}: {
  produkId: string;
  varianId: string;
  itemStok: ItemStok;
  nomor: number;
}) {
  const [diubah, setDiubah] = useState(false);
  const dipilih = { produkId, varianId, id: itemStok.id };

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="font-extrabold">Item stok {nomor}</h3>
        <PilStatusItemStok status={itemStok.status} />
        {itemStok.nomorPesanan !== null && (
          <span className="text-[13px] text-tinta-redup">
            {itemStok.status === "Terkirim" ? "ke" : "untuk"} Pesanan{" "}
            {/* Nomor Pesanan membuka detail Pesanan (PRD §9.5). */}
            <Link
              href={`/admin/pesanan/${itemStok.nomorPesanan}`}
              className="inline-flex min-h-6 items-center font-mono font-bold text-aksi-teks underline-offset-2 hover:underline"
            >
              {itemStok.nomorPesanan}
            </Link>
          </span>
        )}
      </div>

      {diubah ? (
        <FormUbahItemStok
          dipilih={dipilih}
          nomor={nomor}
          kolom={itemStok.kolom}
          onSelesai={() => setDiubah(false)}
        />
      ) : (
        <>
          <dl className="flex flex-col gap-2">
            {itemStok.kolom.map(({ nama, nilai }, urutan) => (
              <div key={urutan}>
                <dt className="text-[13px] font-bold text-tinta-redup">
                  {nama}
                </dt>
                <dd className="font-mono text-[15px] font-medium [overflow-wrap:anywhere]">
                  {nilai}
                </dd>
              </div>
            ))}
          </dl>
          {itemStokBolehDiubah(itemStok.status) && (
            <AksiItemStok
              dipilih={dipilih}
              nomor={nomor}
              onUbah={() => setDiubah(true)}
            />
          )}
        </>
      )}
    </li>
  );
}
