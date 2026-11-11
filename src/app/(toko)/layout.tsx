import type { ReactNode } from "react";

import { BilahAtas } from "./_components/bilah-atas";
import { NavigasiBawah } from "./_components/navigasi-toko";

// Kerangka toko: bilah atas, isi, dan navigasi bawah di ponsel. Dasbor admin punya kerangka sendiri.
export default function TokoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BilahAtas />
      <main className="mx-auto max-w-[1120px] px-4 pt-2 pb-28 lebar:pb-16">
        {children}
      </main>
      <NavigasiBawah />
    </>
  );
}
