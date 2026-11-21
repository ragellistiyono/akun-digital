"use client";

import { useState } from "react";

import { METODE } from "@/domain/bayar-saldo";

import { ALAMAT_LAPORAN } from "../alamat";

type PilihanKategori = { id: string; nama: string };
type PilihanProduk = {
  id: string;
  nama: string;
  kategoriId: string;
  aktif: boolean;
};

/** Isian 40 px untuk saringan, dengan kepadatan Operate dasbor admin (DESIGN.md Navigation). */
const KELAS_ISIAN = "isian h-10 min-h-10 w-full min-w-0";
const KELAS_KOLOM = "flex min-w-0 flex-col gap-2";
const KELAS_LABEL = "text-[17px] leading-tight";

/**
 * Form saringan rentang tanggal, Kategori, Produk, dan Metode Laporan keuangan (PRD §14.6), dikirim sebagai GET ke
 * alamat Laporan keuangan. Metode bisa Semua (awal), QRIS, atau Saldo (§14.6 ▶ Keputusan 2026-11-20). Memilih Kategori langsung membatasi pilihan Produk ke Kategori itu, dan Produk yang tidak ada
 * di Kategori itu dilepas. Produk boleh dipilih tanpa Kategori, dan Produk nonaktif ikut tampil dengan tanda
 * "(nonaktif)". Periode dan kata cari ikut dikirim apa adanya.
 *
 * Susunan: di ponsel setiap isian sebaris penuh, mulai 640 px dua kolom, dan mulai 1200 px kelima isian sebaris
 * bersama tombolnya. Varian `min-[…px]` dipakai, bukan `sm:`, supaya urutannya di CSS tetap menaik bersama
 * `lebar:` (px).
 */
export function FormSaringanLaporan({
  periode,
  dari,
  sampai,
  kategoriId,
  produkId,
  metode,
  cari,
  semuaKategori,
  semuaProduk,
}: {
  periode: string;
  dari: string;
  sampai: string;
  kategoriId: string | undefined;
  produkId: string | undefined;
  metode: string | undefined;
  cari: string | undefined;
  semuaKategori: readonly PilihanKategori[];
  semuaProduk: readonly PilihanProduk[];
}) {
  const [kategori, setKategori] = useState(kategoriId ?? "");
  const [produk, setProduk] = useState(produkId ?? "");
  const pilihanProduk =
    kategori === ""
      ? semuaProduk
      : semuaProduk.filter((p) => p.kategoriId === kategori);

  return (
    <form
      action={ALAMAT_LAPORAN}
      role="search"
      aria-label="Saring Laporan keuangan"
      className="kartu grid items-end gap-4 p-4 min-[640px]:grid-cols-2 min-[1200px]:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
    >
      <input type="hidden" name="periode" value={periode} />
      {cari !== undefined && <input type="hidden" name="cari" value={cari} />}
      <div className={KELAS_KOLOM}>
        <label htmlFor="dari" className={KELAS_LABEL}>
          Tanggal mulai
        </label>
        <input
          id="dari"
          name="dari"
          type="date"
          required
          defaultValue={dari}
          className={KELAS_ISIAN}
        />
      </div>
      <div className={KELAS_KOLOM}>
        <label htmlFor="sampai" className={KELAS_LABEL}>
          Tanggal akhir
        </label>
        <input
          id="sampai"
          name="sampai"
          type="date"
          required
          defaultValue={sampai}
          className={KELAS_ISIAN}
        />
      </div>
      <div className={KELAS_KOLOM}>
        <label htmlFor="kategori" className={KELAS_LABEL}>
          Kategori
        </label>
        <select
          id="kategori"
          name="kategori"
          value={kategori}
          onChange={(e) => {
            const baru = e.target.value;
            setKategori(baru);
            if (
              baru !== "" &&
              !semuaProduk.some((p) => p.id === produk && p.kategoriId === baru)
            ) {
              setProduk("");
            }
          }}
          className={KELAS_ISIAN}
        >
          <option value="">Semua</option>
          {semuaKategori.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama}
            </option>
          ))}
        </select>
      </div>
      <div className={KELAS_KOLOM}>
        <label htmlFor="produk" className={KELAS_LABEL}>
          Produk
        </label>
        <select
          id="produk"
          name="produk"
          value={produk}
          onChange={(e) => setProduk(e.target.value)}
          className={KELAS_ISIAN}
        >
          <option value="">Semua</option>
          {pilihanProduk.map((p) => (
            <option key={p.id} value={p.id}>
              {p.aktif ? p.nama : `${p.nama} (nonaktif)`}
            </option>
          ))}
        </select>
      </div>
      <div className={KELAS_KOLOM}>
        <label htmlFor="metode" className={KELAS_LABEL}>
          Metode
        </label>
        <select
          id="metode"
          name="metode"
          defaultValue={metode ?? ""}
          className={KELAS_ISIAN}
        >
          <option value="">Semua</option>
          {METODE.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="tombol tombol-kecil">
        Tampilkan
      </button>
    </form>
  );
}
