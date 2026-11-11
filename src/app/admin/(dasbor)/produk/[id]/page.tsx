import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { BATAS_FOTO_PRODUK } from "@/domain/foto-produk";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { BATAS_UKURAN_GAMBAR_MB } from "@/server/berkas-unggahan";
import { fotoUntukTampilan } from "@/server/foto-produk";
import { daftarKategori } from "@/server/kategori";
import { bacaProduk } from "@/server/produk";
import { daftarVarian } from "@/server/varian";

import { FormProduk } from "../_components/form-produk";
import { FotoProduk } from "../_components/foto-produk";
import { VarianProduk } from "../_components/varian-produk";

// Mengubah Produk, termasuk menonaktifkan dan mengaktifkannya kembali (PRD §3.2, §3.7), serta mengelola
// Varian (PRD §3.2, §3.5, §3.7) dan foto Produk (PRD §3.3). Format Item stok hanya ditampilkan; aturan
// mengubahnya dibuat di T28.
export default async function HalamanUbahProduk({
  params,
}: PageProps<"/admin/produk/[id]">) {
  await wajibSesiAdmin(await headers());

  const id = z.uuid().safeParse((await params).id);
  const produk = id.success ? await bacaProduk(id.data) : null;
  if (!produk) notFound();
  const [semuaKategori, varian] = await Promise.all([
    daftarKategori(),
    daftarVarian(produk.id),
  ]);

  return (
    <>
      <h1>Ubah Produk</h1>
      <FormProduk
        produk={produk}
        semuaKategori={semuaKategori.map(({ id, nama }) => ({ id, nama }))}
      />
      <VarianProduk produkId={produk.id} varian={varian} />
      <FotoProduk
        produkId={produk.id}
        foto={fotoUntukTampilan(produk.foto)}
        batas={BATAS_FOTO_PRODUK}
        batasUkuranMb={BATAS_UKURAN_GAMBAR_MB}
      />
    </>
  );
}
