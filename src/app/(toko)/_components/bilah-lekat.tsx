import type { ReactNode } from "react";

/**
 * Bilah lekat (DESIGN.md Navigation): aksi utama yang menempel di atas navigasi bawah di layar ponsel,
 * berlatar `kertas` pekat dengan garis atas pensil putus-putus 2 px, tanpa bayangan lembut. Tombolnya
 * mengisi lebar bilah. Mulai 900 px bilah ini menjadi blok biasa di kolomnya. Footer toko memberi ruang
 * bawah tambahan selama bilah ini ada, supaya isi terakhir tidak tertutup. `pesan`, misalnya pesan galat
 * aksi di bilah ini, tampil di atas tombolnya, sehingga tetap terlihat di ponsel walaupun halaman belum
 * digulir sampai bawah.
 *
 * Saat navigasi bawah bersembunyi (`data-sembunyi`, PRD §11.2), bilah turun ke dasar layar dengan padding
 * bawah 12 px ditambah `safe-area-inset-bottom`, lalu kembali ke atas navigasi saat navigasi muncul.
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
      className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 border-t-2 border-dashed border-pensil bg-kertas px-4 pt-3 pb-[26px] transition-[bottom,padding-bottom] duration-300 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none motion-reduce:duration-0 max-lebar:[body:has([data-navigasi-bawah][data-sembunyi])_&]:bottom-0 max-lebar:[body:has([data-navigasi-bawah][data-sembunyi])_&]:pb-[calc(12px+env(safe-area-inset-bottom))] lebar:static lebar:mt-6 lebar:border-0 lebar:bg-transparent lebar:p-0"
    >
      {pesan && <div className="mx-auto mb-3 max-w-[1120px]">{pesan}</div>}
      <div className="mx-auto flex max-w-[1120px] items-center gap-3 *:flex-1">
        {children}
      </div>
    </div>
  );
}
