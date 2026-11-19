import { headers } from "next/headers";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarKategori } from "@/server/kategori";

import { FormProduk } from "../_components/form-produk";

// Membuat Produk baru beserta Format Item stok-nya (PRD §3.2, §3.3, §4.1).
export default async function HalamanTambahProduk() {
  await wajibSesiAdmin(await headers());
  const semuaKategori = await daftarKategori();

  return (
    <div className="tata-baca">
      <div className="mb-6 flex flex-col gap-2">
        <h1>Tambah Produk</h1>
        <p className="text-pensil-redup">
          Varian dan foto Produk ditambahkan setelah Produk disimpan, lewat
          tombol Ubah di daftar Produk.
        </p>
      </div>
      <FormProduk
        semuaKategori={semuaKategori.map(({ id, nama }) => ({ id, nama }))}
      />
    </div>
  );
}
