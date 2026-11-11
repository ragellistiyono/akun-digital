import { ChevronLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { bacaStokVarian } from "@/server/item-stok";
import { bacaVarian } from "@/server/varian";

import {
  FormItemStok,
  TempelItemStok,
} from "../../../_components/item-stok-varian";

// Halaman Varian di dasbor admin: Stok Varian (PRD §5.3) dan mengisi Item stok lewat form satu Item
// stok atau dengan menempel banyak baris (PRD §4.2). Daftar Item stok per status dibuat di T27.
export default async function HalamanVarian({
  params,
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
    </>
  );
}
