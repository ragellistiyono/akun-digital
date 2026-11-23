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

import { PanelHapus } from "../../_components/penegasan-hapus";
import { FormatItemStokProduk } from "../_components/format-item-stok-produk";
import { FormProduk } from "../_components/form-produk";
import { FotoProduk } from "../_components/foto-produk";
import { VarianProduk } from "../_components/varian-produk";
import { aksiHapusProduk } from "../aksi";

// Mengubah Produk, termasuk menonaktifkan dan mengaktifkannya kembali (PRD §3.2, §3.7), serta mengubah
// Format Item stok (PRD §4.1), mengelola Varian (PRD §3.2, §3.5, §3.7) dan foto Produk (PRD §3.3), dan
// menghapus Produk yang belum pernah dipesan (PRD §3.7).
//
// Tata letak (DESIGN.md Tata letak halaman, dasbor admin): di bawah 1200 px semua panel satu kolom 720 px di
// tengah. Mulai 1200 px halaman memakai dua kolom: form Produk dan Format Item stok di kiri, Varian, Foto, dan
// Hapus Produk di kanan. Urutan DOM tetap, jadi urutan baca di ponsel dan urutan Tab tidak berubah. Kolom
// memakai jarak margin (space-y), supaya margin bawaan PanelHapus menyatu dengan jarak antarpanel.
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
    <div className="tata-baca min-[1200px]:max-w-none">
      <h1 className="mb-6">Ubah Produk</h1>
      <div className="flex flex-col gap-6 min-[1200px]:grid min-[1200px]:grid-cols-2 min-[1200px]:items-start min-[1200px]:gap-8">
        <div className="min-w-0 space-y-6">
          <FormProduk
            produk={produk}
            semuaKategori={semuaKategori.map(({ id, nama }) => ({ id, nama }))}
          />
          <FormatItemStokProduk
            produkId={produk.id}
            kolom={produk.formatItemStok}
          />
        </div>
        <div className="min-w-0 space-y-6">
          <VarianProduk
            produkId={produk.id}
            gratis={produk.gratis}
            varian={varian}
          />
          <FotoProduk
            produkId={produk.id}
            foto={fotoUntukTampilan(produk.foto)}
            batas={BATAS_FOTO_PRODUK}
            batasUkuranMb={BATAS_UKURAN_GAMBAR_MB}
          />
          <PanelHapus
            judul="Hapus Produk"
            keterangan="Produk hanya bisa dihapus bila belum pernah dipesan, di Pesanan berstatus apa pun. Varian, Item stok, dan foto miliknya ikut terhapus. Produk yang sudah pernah dipesan bisa dinonaktifkan di form Produk."
            aksi={aksiHapusProduk}
            isian={{ id: produk.id }}
            nama={`Produk ${produk.nama}`}
            akibat="Varian, Item stok, dan foto miliknya ikut terhapus dan tidak bisa dikembalikan."
          />
        </div>
      </div>
    </div>
  );
}
