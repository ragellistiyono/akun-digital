import { Plus } from "lucide-react";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarKategori } from "@/server/kategori";

// Daftar Kategori di dasbor admin (PRD §3.1), urut menurut nama.
export default async function HalamanDaftarKategori() {
  await wajibSesiAdmin(await headers());
  const semuaKategori = await daftarKategori();

  return (
    <>
      <div className="kepala-halaman">
        <h1>Kategori</h1>
        <Link href="/admin/kategori/baru" className="tombol tombol-kecil">
          <Plus aria-hidden="true" className="size-6" strokeWidth={2.5} />
          Tambah Kategori
        </Link>
      </div>

      {semuaKategori.length === 0 ? (
        <p className="max-w-[65ch] text-pensil-redup">
          Belum ada Kategori. Pilih Tambah Kategori untuk membuat Kategori
          pertama beserta gambar ikonnya.
        </p>
      ) : (
        <div className="kartu relative overflow-x-auto px-4 py-2 sm:px-6">
          <table className="w-full text-left">
            <thead className="font-spidol text-[16px] font-bold text-pensil-redup">
              <tr className="border-b-2 border-dashed border-pensil">
                <th scope="col" className="w-16 py-2">
                  Ikon
                </th>
                <th scope="col" className="py-2">
                  Nama
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {semuaKategori.map((kategori) => (
                <tr
                  key={kategori.id}
                  className="border-b-2 border-dashed border-pensil last:border-b-0"
                >
                  <td className="py-2">
                    <Image
                      unoptimized
                      src={kategori.alamatIkon}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 rounded-coret-bulat border-2 border-pensil bg-kertas-lama p-1.5 object-contain"
                    />
                  </td>
                  <td className="py-2 break-words">{kategori.nama}</td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/kategori/${kategori.id}`}
                      className="tombol tombol-kecil tombol-kedua"
                    >
                      Ubah<span className="sr-only"> {kategori.nama}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
