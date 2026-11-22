import { ChevronLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { STATUS_ITEM_STOK } from "@/domain/item-stok";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { bacaStokVarian, daftarItemStokVarian } from "@/server/item-stok";
import { bacaVarian } from "@/server/varian";

import { DaftarItemStok } from "../../../_components/daftar-item-stok";
import {
  FormItemStok,
  TempelItemStok,
} from "../../../_components/item-stok-varian";

// Saringan status dari alamat. Nilai yang tidak sah diabaikan, jadi semua Item stok tampil.
const SaringanAlamat = z.object({
  status: z.enum(STATUS_ITEM_STOK).optional().catch(undefined),
});

// Halaman Varian di dasbor admin: Stok Varian (PRD §5.3), mengisi Item stok lewat form satu Item stok atau
// dengan menempel banyak baris (PRD §4.2), dan daftar Item stok yang bisa disaring menurut status, dengan
// Pembeli Item stok Ditahan dan Terkirim, ubah dan hapus untuk Item stok Tersedia, dan hapus semua Item stok
// Tersedia (PRD §4.4, §9.7).
//
// Tata letak (DESIGN.md Tata letak halaman, dasbor admin): di bawah 1200 px semua panel satu kolom 720 px di
// tengah. Mulai 1200 px Stok Varian dan kedua form Item stok di kolom kiri, Daftar Item stok di kolom kanan.
// Urutan DOM tetap, jadi urutan baca di ponsel dan urutan Tab tidak berubah.
export default async function HalamanVarian({
  params,
  searchParams,
}: PageProps<"/admin/produk/[id]/varian/[varianId]">) {
  await wajibSesiAdmin(await headers());

  const id = z.object({ produkId: z.uuid(), varianId: z.uuid() }).safeParse({
    produkId: (await params).id,
    varianId: (await params).varianId,
  });
  const varian = id.success
    ? await bacaVarian({ id: id.data.varianId, produkId: id.data.produkId })
    : null;
  if (!varian) notFound();
  const stok = await bacaStokVarian(varian.id);
  const varianDipilih = { produkId: varian.produkId, varianId: varian.id };
  const { status: saringan } = SaringanAlamat.parse(await searchParams);
  const itemStok = await daftarItemStokVarian({
    varianId: varian.id,
    status: saringan,
  });

  return (
    <div className="tata-baca min-[1200px]:max-w-none">
      <Link
        href={`/admin/produk/${varian.produkId}`}
        className="inline-flex h-10 max-w-full items-center gap-1 pr-3 text-[17px] text-pulpen decoration-2 underline-offset-4 hover:underline"
      >
        <ChevronLeft
          aria-hidden="true"
          className="size-6 shrink-0"
          strokeWidth={2.5}
        />
        <span className="truncate">Produk {varian.namaProduk}</span>
      </Link>
      <h1 className="mt-2 mb-6 break-words">Varian {varian.nama}</h1>

      <div className="flex flex-col gap-6 min-[1200px]:grid min-[1200px]:grid-cols-2 min-[1200px]:items-start min-[1200px]:gap-8">
        <div className="min-w-0 space-y-6">
          <section
            aria-labelledby="stok-varian-judul"
            className="kartu flex flex-col gap-2 p-4 sm:p-6"
          >
            <h2 id="stok-varian-judul" className="text-[26px]">
              Stok Varian
            </h2>
            <p className="font-spidol text-[40px] leading-none font-bold">
              {stok.stokVarian}
            </p>
            <p className="text-base text-pensil-redup">
              Jumlah Item stok yang Tersedia. Item stok Ditahan (
              {stok.jumlahPerStatus.Ditahan}) dan Terkirim (
              {stok.jumlahPerStatus.Terkirim}) tidak dihitung.
            </p>
          </section>

          <TempelItemStok {...varianDipilih} kolom={varian.formatItemStok} />
          <FormItemStok {...varianDipilih} kolom={varian.formatItemStok} />
        </div>
        <div className="min-w-0">
          <DaftarItemStok
            {...varianDipilih}
            namaProduk={varian.namaProduk}
            namaVarian={varian.nama}
            saringan={saringan}
            jumlahPerStatus={stok.jumlahPerStatus}
            itemStok={itemStok}
          />
        </div>
      </div>
    </div>
  );
}
