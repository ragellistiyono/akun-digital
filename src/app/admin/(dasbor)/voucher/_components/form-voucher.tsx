"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { JenisPotongan } from "@/domain/isian-voucher";
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
      <label htmlFor={nama} className="text-sm font-bold">
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
 * Batas maksimum hanya tampil untuk jenis persen. Cakupan voucher untuk sementara selalu semua Produk.
 */
export function FormVoucher({
  idVoucher,
  awal,
}: {
  idVoucher?: string;
  awal: KeadaanFormVoucher;
}) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState(
    idVoucher ? aksiUbahVoucher : aksiBuatVoucher,
    awal,
  );
  const { isian, galat } = keadaan;
  const [jenis, setJenis] = useState(isian.jenisPotongan);

  return (
    <form
      action={aksi}
      noValidate
      className="mt-6 flex max-w-[720px] flex-col gap-6 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      {idVoucher ? (
        <>
          <input type="hidden" name="id" value={idVoucher} />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">Kode</p>
            <p className="text-lg font-extrabold break-all">{isian.kode}</p>
            <p className="text-[13px] text-tinta-redup">
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
        <legend className="mb-2 text-sm font-bold">Jenis potongan</legend>
        <div className="flex flex-wrap gap-6">
          {PILIHAN_JENIS.map((pilihan) => (
            <label
              key={pilihan.nilai}
              className="flex min-h-10 items-center gap-3 text-base"
            >
              <input
                type="radio"
                name="jenisPotongan"
                value={pilihan.nilai}
                defaultChecked={isian.jenisPotongan === pilihan.nilai}
                onChange={() => setJenis(pilihan.nilai)}
                className="size-6 shrink-0 accent-aksi"
              />
              {pilihan.label}
            </label>
          ))}
        </div>
      </fieldset>

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

      <div className="grid gap-6 sm:grid-cols-2">
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

      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold">Cakupan voucher</p>
        <p>Semua Produk</p>
      </div>

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
        <button
          type="submit"
          disabled={sedangMenyimpan}
          className="inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98] disabled:bg-permukaan-2 disabled:text-tinta-redup"
        >
          {sedangMenyimpan ? "Menyimpan…" : "Simpan"}
        </button>
        <Link href="/admin/voucher" className={KELAS_TOMBOL_GARIS}>
          Batal
        </Link>
      </div>
    </form>
  );
}
