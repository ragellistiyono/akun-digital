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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Kategori</h1>
        <Link
          href="/admin/kategori/baru"
          className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-aksi px-4 text-sm font-bold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98]"
        >
          <Plus aria-hidden="true" className="size-6" />
          Tambah Kategori
        </Link>
      </div>

      {semuaKategori.length === 0 ? (
        <p className="mt-6 max-w-[65ch] text-tinta-redup">
          Belum ada Kategori. Pilih Tambah Kategori untuk membuat Kategori
          pertama beserta gambar ikonnya.
        </p>
      ) : (
        <div className="mt-6 max-w-[720px] rounded-[20px] bg-permukaan px-4 py-2 shadow-bayang">
          <table className="w-full text-left">
            <thead className="text-[13px] font-bold text-tinta-redup">
              <tr className="border-b border-garis">
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
                  className="border-b border-garis last:border-b-0"
                >
                  <td className="py-2">
                    <Image
                      unoptimized
                      src={kategori.alamatIkon}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 rounded-[10px] bg-permukaan-2 object-contain"
                    />
                  </td>
                  <td className="py-2 font-bold break-words">
                    {kategori.nama}
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/kategori/${kategori.id}`}
                      className="inline-flex h-9 items-center rounded-[10px] border-[1.5px] border-garis bg-permukaan px-3 text-sm font-bold hover:border-monogram"
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
