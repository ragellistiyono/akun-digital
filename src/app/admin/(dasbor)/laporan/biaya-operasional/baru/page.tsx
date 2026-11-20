import { headers } from "next/headers";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { tanggalIsianWib } from "@/server/zona-waktu-toko";

import { FormBiayaOperasional } from "../_components/form-biaya-operasional";

// Mencatat Biaya operasional baru (PRD §14.4). Saat form dibuka, tanggalnya sudah terisi hari ini menurut zona
// waktu toko (PRD §9.1).
export default async function HalamanTambahBiayaOperasional() {
  await wajibSesiAdmin(await headers());
  const hariIni = tanggalIsianWib(new Date());

  return (
    <div className="tata-baca">
      <h1 className="mb-6">Tambah Biaya operasional</h1>
      <FormBiayaOperasional
        awal={{ isian: { tanggal: hariIni, keterangan: "", nominal: "" } }}
        hariIni={hariIni}
        bulanBatal={hariIni.slice(0, 7)}
      />
    </div>
  );
}
