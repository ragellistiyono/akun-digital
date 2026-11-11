import type { ReactNode } from "react";

import { BilahAtas } from "./_components/bilah-atas";
import { NavigasiBawah } from "./_components/navigasi-toko";

// Kerangka toko: bilah atas, langit di bawahnya beserta isi halaman, dan navigasi bawah di ponsel.
// Beranda memasang pita langit sendiri; halaman dalam memakai strip tepi dari (dalam)/layout.tsx.
// Dasbor admin punya kerangka sendiri.
export default function TokoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BilahAtas />
      {children}
      <NavigasiBawah />
    </>
  );
}
