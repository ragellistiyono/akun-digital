import { connection } from "next/server";

import { bacaPengaturanToko } from "@/server/pengaturan-toko";

import { TeksHalamanHukum } from "../../_components/teks-halaman-hukum";

// Halaman Syarat & Ketentuan dengan teks dari Pengaturan toko (PRD §9.8).
export default async function HalamanSyaratKetentuan() {
  // Teks dibaca setiap kali halaman dibuka, supaya perubahan Admin langsung tampil.
  await connection();
  const { syaratKetentuan } = await bacaPengaturanToko();

  return (
    <>
      <h1 className="mt-4">Syarat &amp; Ketentuan</h1>
      <TeksHalamanHukum teks={syaratKetentuan} />
    </>
  );
}
