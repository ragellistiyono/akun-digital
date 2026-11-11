import { Eye, EyeOff, Plus, Star, type LucideIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarProduk } from "@/server/produk";

/** Pil keadaan Produk dengan warna, ikon, dan label sekaligus (DESIGN.md Status Pesanan). */
function Pil({
  ikon: Ikon,
  label,
  className,
}: {
  ikon: LucideIcon;
  label: string;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full pr-3 pl-2 text-[13px] font-extrabold whitespace-nowrap",
        className,
      )}
    >
      <Ikon aria-hidden="true" className="size-4" strokeWidth={2.4} />
      {label}
    </span>
  );
}

// Daftar Produk di dasbor admin (PRD §3.2, §3.6, §3.7), urut menurut nama.
export default async function HalamanDaftarProduk() {
  await wajibSesiAdmin(await headers());
  const semuaProduk = await daftarProduk();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Produk</h1>
        <Link
          href="/admin/produk/baru"
          className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-aksi px-4 text-sm font-bold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98]"
        >
          <Plus aria-hidden="true" className="size-6" />
          Tambah Produk
        </Link>
      </div>

      {semuaProduk.length === 0 ? (
        <p className="mt-6 max-w-[65ch] text-tinta-redup">
          Belum ada Produk. Pilih Tambah Produk untuk membuat Produk pertama
          beserta Format Item stok-nya.
        </p>
      ) : (
        <div className="mt-6 max-w-[720px] rounded-[20px] bg-permukaan px-4 py-2 shadow-bayang">
          <table className="w-full text-left">
            <thead className="text-[13px] font-bold text-tinta-redup">
              <tr className="border-b border-garis">
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
                  className="border-b border-garis last:border-b-0"
                >
                  <th scope="row" className="py-2 pr-2 font-normal">
                    <span className="block font-bold break-words">
                      {produk.nama}
                    </span>
                    <span className="block text-[13px] break-words text-tinta-redup">
                      {produk.namaKategori}
                    </span>
                  </th>
                  <td className="py-2 pr-2">
                    <div className="flex flex-wrap gap-2">
                      {produk.aktif ? (
                        <Pil
                          ikon={Eye}
                          label="Aktif"
                          className="bg-st-selesai-bg text-st-selesai"
                        />
                      ) : (
                        <Pil
                          ikon={EyeOff}
                          label="Nonaktif"
                          className="bg-st-batal-bg text-st-batal"
                        />
                      )}
                      {produk.unggulan && (
                        <Pil
                          ikon={Star}
                          label="Unggulan"
                          className="bg-permukaan-2 text-tinta"
                        />
                      )}
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/admin/produk/${produk.id}`}
                      className="inline-flex h-9 items-center rounded-[10px] border-[1.5px] border-garis bg-permukaan px-3 text-sm font-bold hover:border-monogram"
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
