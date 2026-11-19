import { Plus, Star } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarProduk } from "@/server/produk";

import { Pil, PilAktif } from "../_components/pil";

// Daftar Produk di dasbor admin (PRD §3.2, §3.6, §3.7), urut menurut nama.
export default async function HalamanDaftarProduk() {
  await wajibSesiAdmin(await headers());
  const semuaProduk = await daftarProduk();

  return (
    <>
      <div className="kepala-halaman">
        <h1>Produk</h1>
        <Link href="/admin/produk/baru" className="tombol tombol-kecil">
          <Plus aria-hidden="true" className="size-6" strokeWidth={2.5} />
          Tambah Produk
        </Link>
      </div>

      {semuaProduk.length === 0 ? (
        <p className="max-w-[65ch] text-pensil-redup">
          Belum ada Produk. Pilih Tambah Produk untuk membuat Produk pertama
          beserta Format Item stok-nya.
        </p>
      ) : (
        <div className="kartu px-4 py-2 sm:px-6">
          <table className="w-full text-left">
            <thead className="font-spidol text-base font-bold text-pensil-redup">
              <tr className="border-b-2 border-dashed border-pensil">
                <th scope="col" className="py-2 pr-2">
                  Produk
                </th>
                <th scope="col" className="py-2 pr-2">
                  Keadaan
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {semuaProduk.map((produk) => (
                <tr
                  key={produk.id}
                  className="border-b-2 border-dashed border-pensil last:border-b-0"
                >
                  <th scope="row" className="py-2 pr-2 font-normal">
                    <span className="block font-spidol font-bold break-words">
                      {produk.nama}
                    </span>
                    <span className="block text-[15px] break-words text-pensil-redup">
                      {produk.namaKategori}
                    </span>
                  </th>
                  <td className="py-2 pr-2">
                    <div className="flex flex-wrap gap-2">
                      <PilAktif aktif={produk.aktif} />
                      {produk.unggulan && (
                        <Pil
                          ikon={Star}
                          label="Unggulan"
                          className="bg-postit text-teks-postit"
                        />
                      )}
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/produk/${produk.id}`}
                      className="tombol tombol-kedua tombol-kecil"
                    >
                      Ubah<span className="sr-only"> {produk.nama}</span>
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
