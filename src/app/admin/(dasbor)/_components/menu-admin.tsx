"use client";

import {
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { aksiKeluarAdmin } from "../../aksi";
import { MerekAdmin } from "../../_components/merek-admin";

type TautanMenu = { href: string; label: string; ikon: LucideIcon };

// Isi menu bertambah bersama halaman dasbor admin di tiket berikutnya (PRD §9).
const TAUTAN_MENU: TautanMenu[] = [
  { href: "/admin/ringkasan", label: "Ringkasan", ikon: LayoutDashboard },
  { href: "/admin/kategori", label: "Kategori", ikon: LayoutGrid },
  { href: "/admin/produk", label: "Produk", ikon: Package },
];

// Kerangka menu dasbor admin (PRD §11.1, DESIGN.md Navigation): menu lipat di bawah 900 px,
// menu samping mulai 900 px. Dasbor admin tidak memakai navigasi bawah toko.
export function MenuAdmin() {
  const pathname = usePathname();
  const [terbuka, setTerbuka] = useState(false);

  return (
    <div className="sticky top-0 z-30 bg-langit text-langit-teks lebar:flex lebar:h-dvh lebar:w-60 lebar:shrink-0 lebar:flex-col">
      <div className="flex h-16 items-center justify-between gap-4 px-4">
        <MerekAdmin />
        <button
          type="button"
          aria-expanded={terbuka}
          aria-controls="menu-admin"
          onClick={() => setTerbuka((sebelumnya) => !sebelumnya)}
          className="inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-langit-garis px-4 text-sm font-bold hover:bg-langit-2 lebar:hidden"
        >
          {terbuka ? (
            <X aria-hidden="true" className="size-6" />
          ) : (
            <Menu aria-hidden="true" className="size-6" />
          )}
          Menu
        </button>
      </div>

      <nav
        id="menu-admin"
        aria-label="Menu admin"
        className={cn(
          "flex-col gap-4 border-t border-langit-garis px-4 pt-4 pb-6 lebar:flex lebar:flex-1 lebar:border-t-0 lebar:pt-2",
          terbuka ? "flex" : "hidden",
        )}
      >
        <ul className="flex flex-col gap-2">
          {TAUTAN_MENU.map(({ href, label, ikon: Ikon }) => {
            const aktif = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={aktif ? "page" : undefined}
                  onClick={() => setTerbuka(false)}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-md px-3 text-[15px] font-bold",
                    aktif
                      ? "bg-langit-2 text-teks-di-aksi"
                      : "text-langit-redup hover:bg-langit-2 hover:text-langit-teks",
                  )}
                >
                  <Ikon aria-hidden="true" className="size-6" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <form action={aksiKeluarAdmin} className="lebar:mt-auto">
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-langit-garis px-4 text-sm font-bold hover:bg-langit-2"
          >
            <LogOut aria-hidden="true" className="size-6" />
            Keluar
          </button>
        </form>
      </nav>
    </div>
  );
}
