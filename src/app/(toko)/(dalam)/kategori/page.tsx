import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import { cn } from "@/lib/utils";
import { daftarKategoriToko } from "@/server/katalog";

import { alamatSaringanKategori } from "../../_components/alamat-saringan-kategori";

// Kartu Kategori dimiringkan bergantian seperti catatan yang ditempel di dinding, paling banyak ±1°,
// karena kartunya bisa selebar setengah isi halaman dan kemiringan 2° tampak terlalu condong.
const ROTASI_KARTU = [
  "-rotate-1",
  "rotate-1",
  "-rotate-[0.5deg]",
  "rotate-[0.5deg]",
];

// Tab Kategori (PRD §11.1): Kategori yang tampil di toko (PRD §3.1) dengan nama dan ikonnya, sama dengan
// deret Kategori di Beranda. Setiap Kategori membuka Beranda yang disaring menurut Kategori itu.
export default async function HalamanKategori() {
  // Kategori dibaca setiap kali tab ini dibuka, bukan sekali saat build.
  await connection();
  const kategori = await daftarKategoriToko();

  return (
    <>
      <h1 className="mt-4">Kategori</h1>
      {kategori.length === 0 ? (
        <p className="kartu mt-6 p-6 text-center text-pensil-redup">
          Belum ada Kategori yang berisi Produk saat ini.
        </p>
      ) : (
        // Pola Katalog (DESIGN.md "Tata letak halaman"): grid yang mengisi lebar isi. Setiap kolom minimal
        // 240 px, jadi satu kolom di ponsel 360 px dan sampai empat kolom di 1120 px. Kolom kosong dilipat
        // (`auto-fit`), sehingga Kategori yang sedikit tetap mengisi lebar, tanpa ruang kosong di kanan.
        <ul className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 lebar:gap-6">
          {kategori.map((k, urutan) => (
            <li key={k.id}>
              {/* Kartu terangkat 2 px dengan bayangan lebih jauh saat hover, tanpa transisi bila gerak
                  dikurangi. */}
              <Link
                href={alamatSaringanKategori(k.id)}
                className={cn(
                  "kartu kartu-tegas flex items-center gap-4 p-4 transition-[translate,box-shadow] duration-100 ease-out hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-coret-sedang motion-reduce:transition-none",
                  ROTASI_KARTU[urutan % ROTASI_KARTU.length],
                )}
              >
                <Image
                  unoptimized
                  src={k.alamatIkon}
                  alt=""
                  width={40}
                  height={40}
                  className="size-12 shrink-0 rounded-coret-bulat border-2 border-pensil bg-kertas-lama object-contain p-1.5"
                />
                <span className="min-w-0 font-spidol text-[22px] leading-tight font-bold [overflow-wrap:anywhere]">
                  {k.nama}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
