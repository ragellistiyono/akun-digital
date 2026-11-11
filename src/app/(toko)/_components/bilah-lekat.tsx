import type { ReactNode } from "react";

/**
 * Tombol utama 52 px (DESIGN.md Buttons): latar `aksi` dan `aksi-tekan` saat hover, mengecil ke 0,98 saat
 * ditekan, dan berlatar `permukaan-2` dengan teks `tinta-redup` saat nonaktif.
 */
export const KELAS_TOMBOL_UTAMA =
  "inline-flex h-[52px] min-w-0 items-center justify-center gap-2 rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi transition-[background-color,scale] duration-150 hover:bg-aksi-tekan active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-permukaan-2 disabled:text-tinta-redup disabled:active:scale-100 motion-reduce:transition-none";

/**
 * Bilah lekat (DESIGN.md Navigation): aksi utama yang menempel di atas navigasi bawah di layar ponsel,
 * berlatar `tanah` dengan garis atas dan Bayang lekat. Tombolnya mengisi lebar bilah. Mulai 900 px bilah
 * ini menjadi blok biasa di kolomnya. Footer toko memberi ruang bawah tambahan selama bilah ini ada,
 * supaya isi terakhir tidak tertutup. `pesan`, misalnya pesan galat aksi di bilah ini, tampil di atas
 * tombolnya, sehingga tetap terlihat di ponsel walaupun halaman belum digulir sampai bawah.
 */
export function BilahLekat({
  children,
  pesan,
}: {
  children: ReactNode;
  pesan?: ReactNode;
}) {
  return (
    <div
      data-bilah-lekat=""
      className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 border-t border-garis bg-tanah px-4 pt-3 pb-[26px] shadow-bayang-lekat lebar:static lebar:mt-6 lebar:border-0 lebar:bg-transparent lebar:p-0 lebar:shadow-none"
    >
      {pesan && <div className="mx-auto mb-3 max-w-[1120px]">{pesan}</div>}
      <div className="mx-auto flex max-w-[1120px] items-center gap-3 *:flex-1">
        {children}
      </div>
    </div>
  );
}
