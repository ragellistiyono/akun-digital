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
// ubah dan hapus untuk Item stok Tersedia (PRD §4.4, §9.7).
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
    <>
      <Link
        href={`/admin/produk/${varian.produkId}`}
        className="inline-flex h-10 max-w-full items-center gap-1 rounded-[12px] pr-3 text-sm font-bold text-aksi-teks hover:bg-permukaan-2"
      >
        <ChevronLeft aria-hidden="true" className="size-6 shrink-0" />
        <span className="truncate">Produk {varian.namaProduk}</span>
      </Link>
      <h1 className="mt-2 break-words">Varian {varian.nama}</h1>

      <section
        aria-labelledby="stok-varian-judul"
        className="mt-6 flex max-w-[560px] flex-col gap-2 rounded-[20px] bg-permukaan p-4 shadow-bayang"
      >
        <h2
          id="stok-varian-judul"
          className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]"
        >
          Stok Varian
        </h2>
        <p className="text-[28px] leading-none font-extrabold tracking-[-0.02em]">
          {stok.stokVarian}
        </p>
        <p className="text-[13px] text-tinta-redup">
          Jumlah Item stok yang Tersedia. Item stok Ditahan (
          {stok.jumlahPerStatus.Ditahan}) dan Terkirim (
          {stok.jumlahPerStatus.Terkirim}) tidak dihitung.
        </p>
      </section>

      <TempelItemStok {...varianDipilih} kolom={varian.formatItemStok} />
      <FormItemStok {...varianDipilih} kolom={varian.formatItemStok} />
      <DaftarItemStok
        {...varianDipilih}
        saringan={saringan}
        jumlahPerStatus={stok.jumlahPerStatus}
        itemStok={itemStok}
      />
    </>
  );
}
