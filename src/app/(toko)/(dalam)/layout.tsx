import type { ReactNode } from "react";

import { PemandanganSenja } from "../_components/pemandangan-senja";

// Halaman dalam toko: strip tepi pemandangan di bawah bilah, lalu isi halaman.
export default function HalamanDalamLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {/* Strip tepi (DESIGN.md): cakrawala pendek dengan waktu senja yang sama seperti pita Beranda, dilukis
          di atas kertas halaman tanpa latar sendiri. */}
      <div className="relative h-11 overflow-hidden lebar:h-14">
        <PemandanganSenja jenis="tepi" t={{ terang: 0.16, gelap: 0.82 }} />
      </div>
      {/* Wadah isi: maksimal 1120 px di tengah, padding samping 16 px (32 px mulai 900 px), selaras dengan
          bilah atas dan footer. Lebar kolom isi dipilih tiap halaman (`tata-fokus`, `tata-baca`,
          `tata-dua-kolom`, atau grid katalog). Setiap halaman membuka isinya dengan judul `mt-4`, jadi isi
          mulai 24 px di bawah strip tepi, dan 32 px mulai 900 px. Jarak ke footer diatur footer. */}
      <main className="mx-auto max-w-[1184px] px-4 pt-2 lebar:px-8 lebar:pt-4">
        {children}
      </main>
    </>
  );
}
