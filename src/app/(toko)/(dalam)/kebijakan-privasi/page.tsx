import { connection } from "next/server";

import { bacaPengaturanToko } from "@/server/pengaturan-toko";

import { TeksHalamanHukum } from "../../_components/teks-halaman-hukum";

// Halaman Kebijakan Privasi dengan teks dari Pengaturan toko (PRD §9.8).
export default async function HalamanKebijakanPrivasi() {
  // Teks dibaca setiap kali halaman dibuka, supaya perubahan Admin langsung tampil.
  await connection();
  const { kebijakanPrivasi } = await bacaPengaturanToko();

  // Pola Baca (DESIGN.md "Tata letak halaman"): kolom 720 px di tengah, dengan judul di kolom yang sama.
  return (
    <div className="tata-baca">
      <h1 className="mt-4">Kebijakan Privasi</h1>
      <TeksHalamanHukum teks={kebijakanPrivasi} />
    </div>
  );
}
