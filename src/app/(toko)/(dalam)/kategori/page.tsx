import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import { daftarKategoriToko } from "@/server/katalog";

import { alamatSaringanKategori } from "../../_components/alamat-saringan-kategori";

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
        <p className="mt-6 rounded-[20px] bg-permukaan p-6 text-center text-tinta-redup shadow-bayang">
          Belum ada Kategori yang berisi Produk saat ini.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 lebar:grid-cols-3 lebar:gap-6">
          {kategori.map((k) => (
            <li key={k.id}>
              <Link
                href={alamatSaringanKategori(k.id)}
                className="flex items-center gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang transition-[translate,box-shadow] duration-200 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5 hover:shadow-bayang-naik motion-reduce:transition-none"
              >
                <Image
                  unoptimized
                  src={k.alamatIkon}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-[10px] bg-permukaan-2 object-contain"
                />
                <span className="min-w-0 text-lg font-extrabold [overflow-wrap:anywhere]">
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
