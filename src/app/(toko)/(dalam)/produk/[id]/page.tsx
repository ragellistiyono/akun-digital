import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { rupiah } from "@/lib/rupiah";
import type { HalamanProduk as IsiHalamanProduk } from "@/server/katalog";
import { bacaHalamanProduk } from "@/server/katalog";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";

import { alamatSaringanKategori } from "../../../_components/alamat-saringan-kategori";
import {
  HargaNormal,
  LabelHabis,
  LabelHemat,
} from "../../../_components/kartu-produk";
import { PilihanVarian } from "../../../_components/pilihan-varian";
import { TombolWhatsApp } from "../../../_components/tombol-whatsapp";

// Panel (DESIGN.md "Cards / Containers") dengan teks panjang (Typography): 15 px, tinggi baris 1,6,
// lebar maksimal 65ch. Baris baru yang ditulis Admin tetap tampil sebagai baris baru.
const PANEL = "rounded-[20px] bg-permukaan p-4 shadow-bayang";
const TEKS_PANJANG =
  "max-w-[65ch] text-[15px] leading-[1.6] whitespace-pre-line [overflow-wrap:anywhere]";

/**
 * Foto Produk menurut urutannya, paling banyak 5 (PRD §3.3): foto pertama besar dengan radius 24 px,
 * lalu foto lainnya berderet di bawahnya. Produk tanpa foto mendapat petak pengganti berisi huruf awal
 * namanya (DESIGN.md "Foto Produk").
 */
function FotoProduk({ nama, foto }: { nama: string; foto: string[] }) {
  const [pertama, ...lainnya] = foto;
  const alt = (i: number) => `${nama}, foto ${i + 1} dari ${foto.length}`;

  return (
    <div className="min-w-0">
      <div className="relative h-[220px] overflow-hidden rounded-[24px] bg-permukaan-2 lebar:h-[420px]">
        {pertama ? (
          <Image
            unoptimized
            loading="eager"
            src={pertama}
            alt={alt(0)}
            width={560}
            height={420}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute bottom-4 left-4 text-[72px] leading-none font-extrabold tracking-[-0.04em] text-tinta-redup"
          >
            {nama.slice(0, 1)}
          </span>
        )}
      </div>
      {lainnya.length > 0 && (
        <ul className="mt-2 grid grid-cols-4 gap-2">
          {lainnya.map((alamat, i) => (
            <li
              key={alamat}
              className="relative aspect-square overflow-hidden rounded-[16px] bg-permukaan-2"
            >
              <Image
                unoptimized
                src={alamat}
                alt={alt(i + 1)}
                width={140}
                height={140}
                className="absolute inset-0 size-full object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Harga Produk dengan satu Varian aktif, yang tidak menampilkan pilihan Varian (PRD §3.2, DESIGN.md
 * "Pilihan Varian"): Harga jual 28 px beserta Harga normal yang dicoret dan label Hemat, lalu "Stok N"
 * atau label Habis (PRD §3.4, §3.5).
 */
function HargaSatuVarian({
  varian,
}: {
  varian: IsiHalamanProduk["varian"][number];
}) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] whitespace-nowrap">
          {rupiah(varian.hargaJual)}
        </p>
        {varian.hargaNormal !== null && (
          <HargaNormal nilai={varian.hargaNormal} />
        )}
        {varian.persenHemat !== null && (
          <LabelHemat persen={varian.persenHemat} />
        )}
      </div>
      <p className="mt-2 text-[13px] font-bold text-tinta-redup">
        {varian.habis ? <LabelHabis /> : `Stok ${varian.stokVarian}`}
      </p>
    </div>
  );
}

// Halaman Produk (PRD §3.3): nama dan Kategori, foto, Varian, deskripsi, lalu ketentuan garansi beserta
// tombol WhatsApp. Di layar lebar foto dan isinya menjadi dua kolom sama lebar (DESIGN.md Layout).
// Produk yang tidak tampil di toko menampilkan halaman tidak ditemukan.
export default async function HalamanProduk({
  params,
}: PageProps<"/produk/[id]">) {
  // Stok Varian dan nomor WhatsApp dibaca setiap kali halaman dibuka, bukan sekali saat build.
  await connection();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [produk, { nomorWhatsapp }] = await Promise.all([
    bacaHalamanProduk(id.data),
    bacaPengaturanToko(),
  ]);
  if (!produk) notFound();

  return (
    <div className="mt-4 grid gap-6 lebar:grid-cols-2 lebar:items-start lebar:gap-8">
      <FotoProduk nama={produk.nama} foto={produk.foto} />

      <div className="min-w-0">
        <h1 className="[overflow-wrap:anywhere]">{produk.nama}</h1>
        <p className="mt-2 flex">
          <Link
            href={alamatSaringanKategori(produk.kategori.id)}
            className="min-w-0 rounded-full bg-permukaan-2 px-3 py-1 text-[13px] font-extrabold [overflow-wrap:anywhere] text-aksi-teks"
          >
            {produk.kategori.nama}
          </Link>
        </p>

        {produk.pilihanVarian ? (
          <>
            <h2
              id="judul-pilih-varian"
              className="mt-6 mb-4 text-lg leading-[1.2] font-extrabold"
            >
              Pilih Varian
            </h2>
            <PilihanVarian
              varian={produk.varian}
              labelledBy="judul-pilih-varian"
            />
          </>
        ) : (
          <HargaSatuVarian varian={produk.varian[0]} />
        )}

        <section aria-label="Deskripsi" className={`mt-6 ${PANEL}`}>
          <p className={TEKS_PANJANG}>{produk.deskripsi}</p>
        </section>
        <section
          aria-label="Ketentuan garansi"
          className={`mt-4 flex flex-col items-start gap-4 ${PANEL}`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <ShieldCheck
              aria-hidden="true"
              className="size-6 shrink-0 text-st-selesai"
            />
            <p className={`min-w-0 ${TEKS_PANJANG}`}>
              {produk.ketentuanGaransi}
            </p>
          </div>
          <TombolWhatsApp nomor={nomorWhatsapp}>
            Tanya lewat WhatsApp
          </TombolWhatsApp>
        </section>
      </div>
    </div>
  );
}
