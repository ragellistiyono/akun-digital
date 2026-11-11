import { connection } from "next/server";

import { bacaPengaturanToko } from "@/server/pengaturan-toko";

import { TautanHalamanHukum } from "../../_components/tautan-halaman-hukum";
import { TombolWhatsApp } from "../../_components/tombol-whatsapp";

// Isi tab Akun sebelum M2: tombol WhatsApp serta tautan Syarat & Ketentuan dan Kebijakan Privasi
// (PRD §11.1 ▶ Keputusan 2026-11-11). Login, Daftar, dan dasbor Member menyusul di M2.
export default async function HalamanAkun() {
  // Nomor WhatsApp dibaca setiap kali halaman dibuka, supaya perubahan Admin langsung tampil.
  await connection();
  const { nomorWhatsapp } = await bacaPengaturanToko();

  return (
    <>
      <h1 className="mt-4">Akun</h1>
      <div className="mt-6 flex flex-col items-start gap-6">
        <TombolWhatsApp nomor={nomorWhatsapp}>
          Hubungi kami di WhatsApp
        </TombolWhatsApp>
        <TautanHalamanHukum />
      </div>
    </>
  );
}
