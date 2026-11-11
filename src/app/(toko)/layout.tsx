import type { ReactNode } from "react";

import { BilahAtas } from "./_components/bilah-atas";
import { FooterToko } from "./_components/footer-toko";
import { NavigasiBawah } from "./_components/navigasi-toko";

// Kerangka toko: bilah atas, langit di bawahnya beserta isi halaman, footer, dan navigasi bawah di
// ponsel. Beranda memasang pita langit sendiri; halaman dalam memakai strip tepi dari
// (dalam)/layout.tsx. Dasbor admin punya kerangka sendiri.
// Di DOM, footer berada setelah navigasi bawah supaya tab navigasi tetap dicapai dengan Tab tepat
// setelah isi halaman. Navigasi bawah menempel di dasar layar, jadi footer tetap tampil di akhir isi.
export default function TokoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BilahAtas />
      {children}
      <NavigasiBawah />
      <FooterToko />
    </>
  );
}
