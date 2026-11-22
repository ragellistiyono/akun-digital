"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import { itemStokBolehDiubah, type StatusItemStok } from "@/domain/item-stok";

import { IsianTeks } from "../../_components/isian-form";
import { Keterangan } from "../../_components/keterangan-isian";
import { ModalPenegasan } from "../../_components/modal-penegasan";
import { PilStatusItemStok } from "../../_components/pil";
import {
  aksiHapusItemStok,
  aksiUbahItemStok,
  type KeadaanFormItemStok,
  type KeadaanHapusItemStok,
} from "../aksi-item-stok";

/**
 * Satu Item stok di daftar Item stok Varian (PRD §9.7), seperti yang dibaca daftarItemStokVarian. Waktu Pembeli-nya
 * sudah ditulis dalam WIB, atau null bila tidak tercatat.
 */
type ItemStok = {
  id: string;
  status: StatusItemStok;
  nomorPesanan: string | null;
  pembeli: { email: string; waktu: string | null } | null;
  kolom: { nama: string; nilai: string }[];
};

type ItemStokDipilih = { produkId: string; varianId: string; id: string };

/** Tombol kecil 40 px untuk aksi kedua di baris Item stok (kelas `tombol-kecil` di globals.css). */
const KELAS_TOMBOL_KECIL = "tombol tombol-kedua tombol-kecil";

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
        <button type="submit" disabled={sedangMenyimpan} className="tombol">
          {sedangMenyimpan ? "Menyimpan…" : "Simpan Item stok"}
        </button>
        <button
          type="button"
          onClick={onSelesai}
          className="tombol tombol-kedua"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

/**
 * Tombol Ubah dan Hapus untuk Item stok Tersedia. Hapus membuka Modal penegasan lebih dulu (PRD §9.10), karena isi
 * Item stok yang terhapus tidak bisa dikembalikan. Setelah aksi selesai, modal tertutup. Bila server menolak,
 * misalnya karena Item stok itu baru saja ditahan checkout, pesannya tampil di bawah tombol.
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
  const pemicu = useRef<HTMLButtonElement>(null);
  const [keadaan, aksi, sedangMenghapus] = useActionState<
    KeadaanHapusItemStok,
    FormData
  >(async (sebelumnya, formData) => {
    const hasil = await aksiHapusItemStok(sebelumnya, formData);
    setMenegaskan(false);
    return hasil;
  }, {});
  const nama = `Item stok ${nomor}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onUbah} className={KELAS_TOMBOL_KECIL}>
          Ubah<span className="sr-only"> {nama}</span>
        </button>
        <button
          ref={pemicu}
          type="button"
          onClick={() => setMenegaskan(true)}
          className={KELAS_TOMBOL_KECIL}
        >
          Hapus<span className="sr-only"> {nama}</span>
        </button>
      </div>
      {menegaskan && (
        <ModalPenegasan
          pemicu={pemicu}
          judul="Hapus Item stok?"
          rincian={`Hapus ${nama}? Isinya tidak bisa dikembalikan.`}
          labelYa={`Ya, hapus ${nama}`}
          labelProses="Menghapus…"
          aksi={aksi}
          isian={{
            produkId: dipilih.produkId,
            varianId: dipilih.varianId,
            itemStokId: dipilih.id,
          }}
          sedangMemproses={sedangMenghapus}
          onBatal={() => setMenegaskan(false)}
        />
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
 * yang menahannya (Ditahan) atau menerimanya (Terkirim), Pembeli-nya, dan isi lengkapnya per kolom. Pembeli Item
 * stok (PRD §9.7 ▶ Keputusan 2026-11-22) adalah email Pesanan itu beserta waktu Pesanan dibuat (Ditahan) atau
 * waktu bayarnya (Terkirim). Item stok Tersedia bisa diubah atau dihapus (PRD §4.4); tombolnya tidak tampil untuk
 * status lain, dan server tetap menolaknya.
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
        <h3 className="text-xl">Item stok {nomor}</h3>
        <PilStatusItemStok status={itemStok.status} />
        {itemStok.nomorPesanan !== null && (
          <span className="text-[15px] text-pensil-redup">
            {itemStok.status === "Terkirim" ? "ke" : "untuk"} Pesanan{" "}
            {/* Nomor Pesanan membuka detail Pesanan (PRD §9.5). */}
            <Link
              href={`/admin/pesanan/${itemStok.nomorPesanan}`}
              className="inline-flex min-h-6 items-center font-mono font-bold text-pulpen underline-offset-4 hover:underline"
            >
              {itemStok.nomorPesanan}
            </Link>
          </span>
        )}
      </div>
      {itemStok.pembeli && (
        <p className="flex flex-wrap gap-x-3 text-[15px] text-pensil-redup">
          <span className="[overflow-wrap:anywhere]">
            {itemStok.pembeli.email}
          </span>
          {itemStok.pembeli.waktu && (
            <span>
              {itemStok.status === "Terkirim" ? "Dibayar" : "Pesanan dibuat"}{" "}
              {itemStok.pembeli.waktu}
            </span>
          )}
        </p>
      )}

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
                <dt className="text-[15px] text-pensil-redup">{nama}</dt>
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
