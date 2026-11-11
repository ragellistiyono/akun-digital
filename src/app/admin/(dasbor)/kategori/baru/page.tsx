import { headers } from "next/headers";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { BATAS_UKURAN_GAMBAR_MB } from "@/server/berkas-unggahan";

import { FormKategori } from "../_components/form-kategori";

// Membuat Kategori baru dengan nama dan gambar ikon (PRD §3.1).
export default async function HalamanTambahKategori() {
  await wajibSesiAdmin(await headers());

  return (
    <>
      <h1>Tambah Kategori</h1>
      <FormKategori batasUkuranMb={BATAS_UKURAN_GAMBAR_MB} />
    </>
  );
}
