"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { JenisCakupan, JenisPotongan } from "@/domain/isian-voucher";
import { cn } from "@/lib/utils";

import {
  IsianTeks,
  KELAS_ISIAN,
  KELAS_TOMBOL_GARIS,
  KotakCentang,
} from "../../_components/isian-form";
import { Keterangan } from "../../_components/keterangan-isian";
import {
  aksiBuatVoucher,
  aksiUbahVoucher,
  type KeadaanFormVoucher,
} from "../aksi";

const PILIHAN_JENIS: { nilai: JenisPotongan; label: string }[] = [
  { nilai: "nominal", label: "Nominal tetap" },
  { nilai: "persen", label: "Persen" },
];

const PILIHAN_CAKUPAN: { nilai: JenisCakupan; label: string }[] = [
  { nilai: "semua", label: "Semua Produk" },
  { nilai: "produk", label: "Produk tertentu" },
  { nilai: "kategori", label: "Kategori tertentu" },
];

/** Produk yang bisa dipilih di Cakupan voucher, beserta nama Kategori-nya sebagai pembeda. */
type PilihanProduk = { id: string; nama: string; namaKategori: string };

/** Kategori yang bisa dipilih di Cakupan voucher. */
type PilihanKategori = { id: string; nama: string };

/**
 * Daftar kotak centang Produk atau Kategori untuk Cakupan voucher. Setiap pilihan terkirim dengan `nama` yang
 * sama, satu kali untuk setiap kotak yang dicentang.
 */
function DaftarCentang({
  nama,
  legenda,
  pilihan,
  terpilih,
  kosong,
}: {
  nama: "produkId" | "kategoriId";
  legenda: string;
  pilihan: { id: string; nama: string; keterangan?: string }[];
  terpilih: string[];
  kosong: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[17px] leading-tight">{legenda}</legend>
      {pilihan.length === 0 ? (
        <p className="text-pensil-redup">{kosong}</p>
      ) : (
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {pilihan.map((satu) => (
            <label key={satu.id} className="flex min-h-10 items-center gap-3">
              <input
                type="checkbox"
                name={nama}
                value={satu.id}
                defaultChecked={terpilih.includes(satu.id)}
                className="size-6 shrink-0 accent-pulpen"
              />
              <span className="min-w-0 break-words">
                {satu.nama}
                {satu.keterangan && (
                  <span className="text-[15px] text-pensil-redup">
                    {" "}
                    · {satu.keterangan}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** Isian tanggal dan jam sampai menit, yang dibaca server sebagai WIB (PRD §8.4, §9.1). */
function IsianWaktu({
  nama,
  label,
  nilaiAwal,
  galat,
  bantuan,
}: {
  nama: "mulai" | "berakhir";
  label: string;
  nilaiAwal: string;
  galat?: string;
  bantuan: string;
}) {
  const idKeterangan = `${nama}-keterangan`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={nama} className="text-[17px] leading-tight">
        {label}
      </label>
      <input
        id={nama}
        name={nama}
        type="datetime-local"
        step={60}
        defaultValue={nilaiAwal}
        aria-invalid={galat ? true : undefined}
        aria-describedby={idKeterangan}
        className={cn(KELAS_ISIAN, "h-[52px]")}
      />
      <Keterangan id={idKeterangan} galat={galat} bantuan={bantuan} />
    </div>
  );
}

/**
 * Form Voucher untuk membuat (tanpa `idVoucher`) atau mengubah Voucher yang sudah ada (PRD §8.2, §8.4
 * ▶ Keputusan 2026-11-17). Kode hanya bisa diisi saat Voucher dibuat; di form ubah, kode hanya ditampilkan.
 * Batas maksimum hanya tampil untuk jenis persen. Cakupan voucher berupa semua Produk, Produk tertentu, atau
 * Kategori tertentu; hanya daftar centang untuk cakupan terpilih yang tampil, jadi Produk dan Kategori tidak
 * dicampur.
 */
export function FormVoucher({
  idVoucher,
  awal,
  pilihanProduk,
  pilihanKategori,
}: {
  idVoucher?: string;
  awal: KeadaanFormVoucher;
  pilihanProduk: PilihanProduk[];
  pilihanKategori: PilihanKategori[];
}) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState(
    idVoucher ? aksiUbahVoucher : aksiBuatVoucher,
    awal,
  );
  const { isian, galat } = keadaan;
  const [jenis, setJenis] = useState(isian.jenisPotongan);
  const [cakupan, setCakupan] = useState(isian.cakupan);

  return (
    <form
      action={aksi}
      noValidate
      className="kartu flex flex-col gap-6 p-4 sm:p-6"
    >
      {idVoucher ? (
        <>
          <input type="hidden" name="id" value={idVoucher} />
          <div className="flex flex-col gap-2">
            <p className="text-[17px] leading-tight">Kode</p>
            <p className="font-spidol text-[24px] leading-tight font-bold break-all">
              {isian.kode}
            </p>
            <p className="text-[15px] text-pensil-redup">
              Kode tidak bisa diubah setelah Voucher dibuat.
            </p>
          </div>
        </>
      ) : (
        <IsianTeks
          nama="kode"
          label="Kode"
          nilaiAwal={isian.kode}
          galat={galat?.kode}
          bantuan="3 sampai 20 huruf A–Z atau angka 0–9, misalnya HEMAT5. Kode disimpan dalam huruf besar dan tidak bisa diubah setelah Voucher dibuat."
        />
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[17px] leading-tight">
          Jenis potongan
        </legend>
        <div className="flex flex-wrap gap-6">
          {PILIHAN_JENIS.map((pilihan) => (
            <label
              key={pilihan.nilai}
              className="flex min-h-10 items-center gap-3"
            >
              <input
                type="radio"
                name="jenisPotongan"
                value={pilihan.nilai}
                defaultChecked={isian.jenisPotongan === pilihan.nilai}
                onChange={() => setJenis(pilihan.nilai)}
                className="size-6 shrink-0 accent-pulpen"
              />
              {pilihan.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Isian angka yang pendek berdampingan dua per baris di layar lebar, dengan urutan tetap. */}
      <div className="grid items-start gap-6 sm:grid-cols-2">
        <IsianTeks
          nama="nilai"
          label="Nilai potongan"
          nilaiAwal={isian.nilai}
          galat={galat?.nilai}
          bantuan={
            jenis === "persen"
              ? "Persen dari Harga jual, bilangan bulat 1 sampai 100, misalnya 10. Hasilnya dibulatkan ke bawah ke rupiah."
              : "Potongan dalam rupiah bulat, minimal Rp 1, misalnya 5.000."
          }
          inputMode="numeric"
        />

        {jenis === "persen" && (
          <IsianTeks
            nama="batasMaksimum"
            label="Batas maksimum"
            nilaiAwal={isian.batasMaksimum}
            galat={galat?.batasMaksimum}
            bantuan="Potongan terbesar dalam rupiah, misalnya 10.000. Kosongkan bila tanpa batas."
            inputMode="numeric"
          />
        )}
      </div>

      <div className="grid items-start gap-6 sm:grid-cols-2">
        <IsianWaktu
          nama="mulai"
          label="Waktu mulai (WIB)"
          nilaiAwal={isian.mulai}
          galat={galat?.mulai}
          bantuan="Kosongkan bila Voucher langsung berlaku."
        />
        <IsianWaktu
          nama="berakhir"
          label="Waktu berakhir (WIB)"
          nilaiAwal={isian.berakhir}
          galat={galat?.berakhir}
          bantuan="Voucher berlaku sampai akhir menit ini. Kosongkan bila tidak berakhir."
        />
      </div>

      <div className="grid items-start gap-6 sm:grid-cols-2">
        <IsianTeks
          nama="kuotaVoucher"
          label="Kuota voucher"
          nilaiAwal={isian.kuotaVoucher}
          galat={galat?.kuotaVoucher}
          bantuan="Berapa kali Voucher boleh dipakai oleh semua Pembeli. Kosongkan bila tanpa batas."
          inputMode="numeric"
        />
        <IsianTeks
          nama="batasPerEmail"
          label="Batas per email"
          nilaiAwal={isian.batasPerEmail}
          galat={galat?.batasPerEmail}
          bantuan="Berapa kali Voucher boleh dipakai oleh satu email. Kosongkan bila tanpa batas."
          inputMode="numeric"
        />
        <IsianTeks
          nama="minimalHargaJual"
          label="Minimal Harga jual"
          nilaiAwal={isian.minimalHargaJual}
          galat={galat?.minimalHargaJual}
          bantuan="Voucher hanya berlaku untuk Varian dengan Harga jual minimal ini, misalnya 50.000. Kosongkan bila tanpa syarat."
          inputMode="numeric"
        />
      </div>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby="cakupan-keterangan"
      >
        <legend className="mb-2 text-[17px] leading-tight">
          Cakupan voucher
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {PILIHAN_CAKUPAN.map((pilihan) => (
            <label
              key={pilihan.nilai}
              className="flex min-h-10 items-center gap-3"
            >
              <input
                type="radio"
                name="cakupan"
                value={pilihan.nilai}
                defaultChecked={isian.cakupan === pilihan.nilai}
                onChange={() => setCakupan(pilihan.nilai)}
                className="size-6 shrink-0 accent-pulpen"
              />
              {pilihan.label}
            </label>
          ))}
        </div>
        <Keterangan
          id="cakupan-keterangan"
          galat={galat?.cakupan}
          bantuan="Voucher hanya berlaku untuk Produk atau Kategori yang dicentang. Produk dan Kategori tidak bisa dicampur dalam satu Voucher."
        />
      </fieldset>

      {cakupan === "produk" && (
        <DaftarCentang
          nama="produkId"
          legenda="Produk"
          pilihan={pilihanProduk.map((p) => ({
            id: p.id,
            nama: p.nama,
            keterangan: p.namaKategori,
          }))}
          terpilih={isian.produkId}
          kosong="Belum ada Produk. Buat Produk dulu, atau pilih Semua Produk."
        />
      )}
      {cakupan === "kategori" && (
        <DaftarCentang
          nama="kategoriId"
          legenda="Kategori"
          pilihan={pilihanKategori}
          terpilih={isian.kategoriId}
          kosong="Belum ada Kategori. Buat Kategori dulu, atau pilih Semua Produk."
        />
      )}

      <KotakCentang
        nama="khususMember"
        label="Khusus Member"
        bantuan="Pembeli harus login sebagai Member untuk memakai Voucher ini."
        dicentang={isian.khususMember}
      />
      <KotakCentang
        nama="aktif"
        label="Aktif"
        bantuan="Voucher nonaktif ditolak di Checkout seperti kode yang tidak ditemukan."
        dicentang={isian.aktif}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={sedangMenyimpan} className="tombol">
          {sedangMenyimpan ? "Menyimpan…" : "Simpan"}
        </button>
        <Link href="/admin/voucher" className={KELAS_TOMBOL_GARIS}>
          Batal
        </Link>
      </div>
    </form>
  );
}
