"use client";

import {
  History,
  House,
  LayoutGrid,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type TabToko = { href: string; label: string; ikon: LucideIcon };

// Empat tab toko (PRD §11.1), sama di navigasi bawah dan navbar atas.
const TAB_TOKO: TabToko[] = [
  { href: "/", label: "Beranda", ikon: House },
  { href: "/kategori", label: "Kategori", ikon: LayoutGrid },
  { href: "/riwayat", label: "Riwayat", ikon: History },
  { href: "/akun", label: "Akun", ikon: User },
];

function isTabAktif(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Penanda tab aktif berbentuk matahari terbit (DESIGN.md). Masih diam; pergeserannya milik M3.
function PenandaMatahari({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-t-full bg-matahari",
        className,
      )}
    />
  );
}

export function NavigasiBawah() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 h-[calc(76px+env(safe-area-inset-bottom))] border-t border-garis bg-permukaan pb-[env(safe-area-inset-bottom)] lebar:hidden"
    >
      <ul className="grid h-full grid-cols-4">
        {TAB_TOKO.map(({ href, label, ikon: Ikon }) => {
          const aktif = isTabAktif(href, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-xs font-extrabold",
                  aktif ? "text-tinta" : "text-tinta-redup",
                )}
              >
                {aktif && (
                  <PenandaMatahari className="-top-3.5 h-3.5 w-7 shadow-[0_-2px_14px_3px_color-mix(in_srgb,var(--matahari)_55%,transparent)]" />
                )}
                <Ikon aria-hidden="true" className="size-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function NavbarAtas() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama" className="ml-6 hidden lebar:block">
      <ul className="flex gap-1">
        {TAB_TOKO.map(({ href, label }) => {
          const aktif = isTabAktif(href, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center rounded-md px-4 text-[15px] font-bold hover:bg-langit-2",
                  aktif
                    ? "text-teks-di-aksi"
                    : "text-langit-redup hover:text-langit-teks",
                )}
              >
                {label}
                {aktif && (
                  <PenandaMatahari className="-bottom-3 h-2.5 w-5 shadow-[0_-2px_12px_2px_color-mix(in_srgb,var(--matahari)_60%,transparent)]" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
