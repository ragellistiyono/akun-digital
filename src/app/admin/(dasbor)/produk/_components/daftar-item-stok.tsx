import Link from "next/link";

import { STATUS_ITEM_STOK, type StatusItemStok } from "@/domain/item-stok";
import type { daftarItemStokVarian } from "@/server/item-stok";

import { BarisItemStok } from "./baris-item-stok";

/**
 * Chip saringan 40 px (DESIGN.md Chips). Chip yang terpilih berlatar `langit` dengan teks putih, dan bergaris
 * `langit-garis` supaya tetap terlihat di atas panel pada mode gelap, tempat `langit` hampir sama dengan
 * `permukaan`.
 */
const KELAS_CHIP =
  "inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-garis bg-permukaan px-4 text-sm font-bold whitespace-nowrap text-tinta hover:border-monogram aria-[current=true]:border-langit-garis aria-[current=true]:bg-langit aria-[current=true]:text-teks-di-aksi";

/**
 * Daftar Item stok sebuah Varian di halaman Varian dasbor admin (PRD §9.7): saringan menurut status lewat
 * `?status=` di alamat, lalu setiap Item stok beserta statusnya, Nomor Pesanan-nya, dan isi lengkapnya. Item
 * stok Tersedia bisa diubah atau dihapus (PRD §4.4). Jumlah Item stok per status di setiap chip adalah bahan
 * hitung Stok Varian dari bacaStokVarian.
 */
export function DaftarItemStok({
  produkId,
  varianId,
  saringan,
  jumlahPerStatus,
  itemStok,
}: {
  produkId: string;
  varianId: string;
  saringan: StatusItemStok | undefined;
  jumlahPerStatus: Record<StatusItemStok, number>;
  itemStok: Awaited<ReturnType<typeof daftarItemStokVarian>>;
}) {
  const alamat = `/admin/produk/${produkId}/varian/${varianId}`;
  const pilihan = [
    {
      label: "Semua",
      status: undefined,
      jumlah: STATUS_ITEM_STOK.reduce((n, s) => n + jumlahPerStatus[s], 0),
    },
    ...STATUS_ITEM_STOK.map((status) => ({
      label: status,
      status,
      jumlah: jumlahPerStatus[status],
    })),
  ];

  return (
    <section
      aria-labelledby="daftar-item-stok-judul"
      className="mt-4 flex max-w-[560px] flex-col gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <h2
        id="daftar-item-stok-judul"
        className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]"
      >
        Daftar Item stok
      </h2>

      <nav aria-label="Saring Item stok menurut status">
        <ul className="flex flex-wrap gap-2">
          {pilihan.map(({ label, status, jumlah }) => (
            <li key={label}>
              {/* Alamat berganti tanpa menggulir halaman ke atas, karena daftar ini ada di bawah form. */}
              <Link
                href={
                  status === undefined ? alamat : `${alamat}?status=${status}`
                }
                scroll={false}
                aria-current={status === saringan ? "true" : undefined}
                className={KELAS_CHIP}
              >
                {label} ({jumlah})
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {itemStok.length === 0 ? (
        <p className="text-tinta-redup">
          {saringan === undefined
            ? "Belum ada Item stok. Isi Item stok lewat form di atas."
            : `Tidak ada Item stok berstatus ${saringan}. Pilih Semua untuk melihat Item stok lainnya.`}
        </p>
      ) : (
        <ul
          aria-labelledby="daftar-item-stok-judul"
          className="flex flex-col divide-y divide-garis"
        >
          {itemStok.map((satu, indeks) => (
            <BarisItemStok
              key={satu.id}
              produkId={produkId}
              varianId={varianId}
              itemStok={satu}
              nomor={indeks + 1}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
