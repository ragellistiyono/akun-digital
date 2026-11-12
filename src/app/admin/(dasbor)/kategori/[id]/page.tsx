import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { BATAS_UKURAN_GAMBAR_MB } from "@/server/berkas-unggahan";
import { bacaKategori } from "@/server/kategori";

import { PanelHapus } from "../../_components/penegasan-hapus";
import { FormKategori } from "../_components/form-kategori";
import { aksiHapusKategori } from "../aksi";

// Mengubah nama dan gambar ikon sebuah Kategori, dan menghapus Kategori yang tidak berisi Produk (PRD §3.1).
export default async function HalamanUbahKategori({
  params,
}: PageProps<"/admin/kategori/[id]">) {
  await wajibSesiAdmin(await headers());

  const id = z.uuid().safeParse((await params).id);
  const kategori = id.success ? await bacaKategori(id.data) : null;
  if (!kategori) notFound();

  return (
    <>
      <h1>Ubah Kategori</h1>
      <FormKategori
        kategori={kategori}
        batasUkuranMb={BATAS_UKURAN_GAMBAR_MB}
      />
      <PanelHapus
        judul="Hapus Kategori"
        keterangan="Kategori hanya bisa dihapus bila tidak berisi Produk, termasuk Produk nonaktif. Gambar ikonnya ikut terhapus."
        aksi={aksiHapusKategori}
        isian={{ id: kategori.id }}
        nama={`Kategori ${kategori.nama}`}
        akibat="Kategori dan gambar ikonnya tidak bisa dikembalikan."
      />
    </>
  );
}
