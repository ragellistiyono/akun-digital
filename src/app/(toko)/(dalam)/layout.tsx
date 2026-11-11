import type { ReactNode } from "react";

import { PemandanganSenja } from "../_components/pemandangan-senja";

// Halaman dalam toko: strip tepi langit di bawah bilah, lalu isi halaman.
export default function HalamanDalamLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {/* Strip tepi (DESIGN.md): cakrawala pendek dengan waktu senja yang sama seperti pita Beranda. */}
      <div className="relative h-11 overflow-hidden bg-langit lebar:h-14">
        <PemandanganSenja jenis="tepi" t={{ terang: 0.16, gelap: 0.82 }} />
      </div>
      <main className="mx-auto max-w-[1120px] px-4 pt-2 pb-28 lebar:pb-16">
        {children}
      </main>
    </>
  );
}
