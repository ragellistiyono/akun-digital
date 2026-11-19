"use client";

import { useActionState } from "react";

import { Isian, PesanGalat } from "../../../../../_masuk/form-masuk";
import { aksiDaftarLewatPesanan } from "../../../daftar/aksi";
import type { KeadaanFormAjakan } from "../../../daftar/pesan-daftar";

const KEADAAN_AWAL: KeadaanFormAjakan = {};

/**
 * Panel ajakan "Buat akun untuk menyimpan riwayat" di bawah Item stok Halaman Pesanan Selesai (PRD §7.1,
 * DESIGN.md Cards / Containers): catatan post-it berpaku payung dengan bingkai pensil 3 px, berisi email
 * Pesanan yang tidak bisa diubah, isian password, dan tombol "Buat akun". Alur sesudahnya sama dengan form
 * Daftar (PRD §7.2, §7.3).
 *
 * Di mode gelap post-it tetap kuning terang, padahal teks bantuan dan pesan galat isian password memakai warna
 * mode gelap yang dibuat untuk latar gelap dan tidak terbaca di atas kuning. Karena itu di mode gelap panel ini
 * berlatar `permukaan` seperti kartu lain, dan hanya paku payungnya yang menandainya.
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
      // Padding 16 px seperti panel lain (24 px di layar lebar), dengan 24 px di atas untuk paku payung.
      className="kartu kartu-postit paku relative border-[3px] p-4 pt-6 lebar:p-6 dark:bg-permukaan dark:text-pensil"
    >
      <h2 id="judul-buat-akun" className="text-[26px]">
        Buat akun untuk menyimpan riwayat
      </h2>
      <p className="mt-2 text-[17px]">
        Akun memakai email{" "}
        <strong className="font-spidol font-bold [overflow-wrap:anywhere]">
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
        <button type="submit" disabled={sedangMengirim} className="tombol mt-2">
          {sedangMengirim ? "Mengirim…" : "Buat akun"}
        </button>
      </form>
    </section>
  );
}
