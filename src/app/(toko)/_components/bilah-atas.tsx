import Link from "next/link";

import { NavbarAtas } from "./navigasi-toko";

export function BilahAtas() {
  return (
    <header className="sticky top-0 z-30 bg-langit text-langit-teks">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4">
        <Link
          href="/"
          aria-label="MIWE Digital Store, beranda"
          className="text-[28px] leading-none font-extrabold tracking-[-0.045em] text-monogram"
        >
          MDS
          <span className="ml-2 hidden text-[13px] font-bold tracking-normal text-langit-redup lebar:inline">
            MIWE Digital Store
          </span>
        </Link>
        <NavbarAtas />
      </div>
    </header>
  );
}
