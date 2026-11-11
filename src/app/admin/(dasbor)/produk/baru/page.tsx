import { headers } from "next/headers";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarKategori } from "@/server/kategori";

import { FormProduk } from "../_components/form-produk";

// Membuat Produk baru beserta Format Item stok-nya (PRD §3.2, §3.3, §4.1).
export default async function HalamanTambahProduk() {
  await wajibSesiAdmin(await headers());
  const semuaKategori = await daftarKategori();

  return (
    <>
      <h1>Tambah Produk</h1>
      <p className="mt-2 max-w-[65ch] text-tinta-redup">
        Foto Produk diunggah setelah Produk disimpan, lewat tombol Ubah di
        daftar Produk.
      </p>
      <FormProduk
        semuaKategori={semuaKategori.map(({ id, nama }) => ({ id, nama }))}
      />
    </>
  );
}
