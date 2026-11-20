"use client";

import { useState } from "react";

import { ALAMAT_ITEM_STOK } from "../alamat";

type PilihanProduk = {
  id: string;
  nama: string;
  aktif: boolean;
  varian: { id: string; nama: string; aktif: boolean }[];
};

const KELAS_ISIAN = "isian h-10 min-h-10 w-full min-w-0";
const KELAS_KOLOM = "flex min-w-0 flex-col gap-2";
const KELAS_LABEL = "text-[17px] leading-tight";

const labelPilihan = ({ nama, aktif }: { nama: string; aktif: boolean }) =>
  aktif ? nama : `${nama} (nonaktif)`;

/**
 * Pilihan Varian menu Item stok (PRD §4.2 ▶ Keputusan 2026-11-20): Produk, lalu Variannya, termasuk Produk dan
 * Varian nonaktif dengan tanda "(nonaktif)", seperti saringan Produk Laporan keuangan. Dikirim sebagai GET ke
 * alamat menu Item stok. Memilih Produk lain mengganti pilihan Varian ke Varian Produk itu.
 */
export function PilihanVarian({
  semuaProduk,
  produkId,
  varianId,
}: {
  semuaProduk: readonly PilihanProduk[];
  produkId: string | undefined;
  varianId: string | undefined;
}) {
  const [produk, setProduk] = useState(produkId ?? "");
  const [varian, setVarian] = useState(varianId ?? "");
  const pilihanVarian = semuaProduk.find((p) => p.id === produk)?.varian ?? [];

  return (
    <form
      action={ALAMAT_ITEM_STOK}
      aria-label="Pilih Varian"
      className="grid items-end gap-4 min-[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
    >
      <div className={KELAS_KOLOM}>
        <label htmlFor="pilih-produk" className={KELAS_LABEL}>
          Produk
        </label>
        <select
          id="pilih-produk"
          value={produk}
          onChange={(e) => {
            setProduk(e.target.value);
            setVarian("");
          }}
          className={KELAS_ISIAN}
        >
          <option value="">Pilih Produk</option>
          {semuaProduk.map((p) => (
            <option key={p.id} value={p.id}>
              {labelPilihan(p)}
            </option>
          ))}
        </select>
      </div>
      <div className={KELAS_KOLOM}>
        <label htmlFor="pilih-varian" className={KELAS_LABEL}>
          Varian
        </label>
        <select
          id="pilih-varian"
          name="varian"
          required
          value={varian}
          onChange={(e) => setVarian(e.target.value)}
          disabled={pilihanVarian.length === 0}
          className={KELAS_ISIAN}
        >
          <option value="">Pilih Varian</option>
          {pilihanVarian.map((v) => (
            <option key={v.id} value={v.id}>
              {labelPilihan(v)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={varian === ""}
        className="tombol tombol-kecil"
      >
        Pilih
      </button>
    </form>
  );
}
