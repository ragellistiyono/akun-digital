import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { BATAS_FOTO_PRODUK } from "@/domain/foto-produk";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { BATAS_UKURAN_GAMBAR_MB } from "@/server/berkas-unggahan";
import { fotoUntukTampilan } from "@/server/foto-produk";
import { daftarKategori } from "@/server/kategori";
import { bacaProduk } from "@/server/produk";

import { FormProduk } from "../_components/form-produk";
import { FotoProduk } from "../_components/foto-produk";

// Mengubah Produk, termasuk menonaktifkan dan mengaktifkannya kembali (PRD §3.2, §3.7), dan mengelola
// foto Produk (PRD §3.3). Format Item stok hanya ditampilkan; aturan mengubahnya dibuat di T28.
export default async function HalamanUbahProduk({
  params,
}: PageProps<"/admin/produk/[id]">) {
  await wajibSesiAdmin(await headers());

  const id = z.uuid().safeParse((await params).id);
  const produk = id.success ? await bacaProduk(id.data) : null;
  if (!produk) notFound();
  const semuaKategori = await daftarKategori();

  return (
    <>
      <h1>Ubah Produk</h1>
      <FormProduk
        produk={produk}
        semuaKategori={semuaKategori.map(({ id, nama }) => ({ id, nama }))}
      />
      <FotoProduk
        produkId={produk.id}
        foto={fotoUntukTampilan(produk.foto)}
        batas={BATAS_FOTO_PRODUK}
        batasUkuranMb={BATAS_UKURAN_GAMBAR_MB}
      />
    </>
  );
}
