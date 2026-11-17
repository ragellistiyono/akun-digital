"use client";

import { useActionState } from "react";

import { Isian, PesanGalat } from "../../../../../_masuk/form-masuk";
import { aksiDaftarLewatPesanan } from "../../../daftar/aksi";
import type { KeadaanFormAjakan } from "../../../daftar/pesan-daftar";

const KEADAAN_AWAL: KeadaanFormAjakan = {};

/**
 * Panel ajakan "Buat akun untuk menyimpan riwayat" di bawah Item stok Halaman Pesanan Selesai (PRD §7.1,
 * DESIGN.md Cards / Containers): panel dengan bingkai 2 px `monogram`, berisi email Pesanan yang tidak bisa
 * diubah, isian password, dan tombol "Buat akun". Alur sesudahnya sama dengan form Daftar (PRD §7.2, §7.3).
 */
export function PanelBuatAkun({
  tautan,
  emailPesanan,
}: {
  tautan: string;
  emailPesanan: string;
}) {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    aksiDaftarLewatPesanan,
    KEADAAN_AWAL,
  );

  return (
    <section
      aria-labelledby="judul-buat-akun"
      className="rounded-[20px] border-2 border-monogram bg-permukaan p-4 shadow-bayang"
    >
      <h2
        id="judul-buat-akun"
        className="text-xl leading-[1.2] font-extrabold tracking-[-0.02em]"
      >
        Buat akun untuk menyimpan riwayat
      </h2>
      <p className="mt-2 text-sm text-tinta-redup">
        Akun memakai email{" "}
        <strong className="font-extrabold text-tinta [overflow-wrap:anywhere]">
          {emailPesanan}
        </strong>
        . Kami kirim Kode verifikasi ke email itu.
      </p>
      <form action={aksi} noValidate className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="tautan" value={tautan} />
        <Isian
          nama="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          bantuan="Minimal 8 karakter."
          galat={keadaan.galat?.password}
        />
        {keadaan.galat?.umum && (
          <PesanGalat id="buat-akun-galat" peran="alert">
            {keadaan.galat.umum}
          </PesanGalat>
        )}
        <button
          type="submit"
          disabled={sedangMengirim}
          className="inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98] disabled:bg-permukaan-2 disabled:text-tinta-redup"
        >
          {sedangMengirim ? "Mengirim…" : "Buat akun"}
        </button>
      </form>
    </section>
  );
}
