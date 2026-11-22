import Link from "next/link";

import { penegasanHapusSemuaItemStokTersedia } from "@/domain/hapus-semua-item-stok";
import { STATUS_ITEM_STOK, type StatusItemStok } from "@/domain/item-stok";
import type { daftarItemStokVarian } from "@/server/item-stok";
import { waktuWib } from "@/server/zona-waktu-toko";

import { BarisItemStok } from "./baris-item-stok";
import { HapusSemuaItemStokTersedia } from "./hapus-semua-item-stok";

/**
 * Daftar Item stok sebuah Varian di halaman Varian dasbor admin (PRD §9.7): saringan menurut status lewat
 * `?status=` di alamat, tombol "Hapus semua Item stok Tersedia" (PRD §4.4 ▶ Keputusan 2026-11-22), lalu setiap
 * Item stok beserta statusnya, Nomor Pesanan-nya, Pembeli-nya, dan isi lengkapnya. Item stok Tersedia bisa diubah
 * atau dihapus (PRD §4.4). Jumlah Item stok per status di setiap chip adalah bahan hitung Stok Varian dari
 * bacaStokVarian, dan juga bahan teks penegasan hapus semua.
 */
export function DaftarItemStok({
  produkId,
  varianId,
  namaProduk,
  namaVarian,
  saringan,
  jumlahPerStatus,
  itemStok,
}: {
  produkId: string;
  varianId: string;
  namaProduk: string;
  namaVarian: string;
  saringan: StatusItemStok | undefined;
  jumlahPerStatus: Record<StatusItemStok, number>;
  itemStok: Awaited<ReturnType<typeof daftarItemStokVarian>>;
}) {
  const alamat = `/admin/produk/${produkId}/varian/${varianId}`;
  const hapusSemua = penegasanHapusSemuaItemStokTersedia({
    produk: namaProduk,
    varian: namaVarian,
    jumlahPerStatus,
  });
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
      className="kartu flex flex-col gap-4 p-4 sm:p-6"
    >
      <h2 id="daftar-item-stok-judul" className="text-[26px]">
        Daftar Item stok
      </h2>

      <nav aria-label="Saring Item stok menurut status">
        <ul className="flex flex-wrap gap-2">
          {pilihan.map(({ label, status, jumlah }) => (
            <li key={label}>
              {/* Alamat berganti tanpa menggulir halaman ke atas, karena daftar ini ada di bawah form. Chip
                  yang terpilih (aria-current) menjadi catatan post-it lewat kelas `chip` di globals.css. */}
              <Link
                href={
                  status === undefined ? alamat : `${alamat}?status=${status}`
                }
                scroll={false}
                aria-current={status === saringan ? "true" : undefined}
                className="chip"
              >
                {label} ({jumlah})
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <HapusSemuaItemStokTersedia
        produkId={produkId}
        varianId={varianId}
        teksPenegasan={
          hapusSemua.tombolTampil ? hapusSemua.teksPenegasan : null
        }
      />

      {itemStok.length === 0 ? (
        <p className="text-pensil-redup">
          {saringan === undefined
            ? "Belum ada Item stok. Isi Item stok lewat form di atas."
            : `Tidak ada Item stok berstatus ${saringan}. Pilih Semua untuk melihat Item stok lainnya.`}
        </p>
      ) : (
        <ul
          aria-labelledby="daftar-item-stok-judul"
          className="flex flex-col divide-y-2 divide-dashed divide-pensil"
        >
          {itemStok.map((satu, indeks) => (
            <BarisItemStok
              key={satu.id}
              produkId={produkId}
              varianId={varianId}
              itemStok={{
                ...satu,
                // Waktu Pembeli ditulis dalam WIB (PRD §9.1), misalnya "22 Nov 2026 10.00".
                pembeli: satu.pembeli && {
                  email: satu.pembeli.email,
                  waktu: satu.pembeli.waktu && waktuWib(satu.pembeli.waktu),
                },
              }}
              nomor={indeks + 1}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
