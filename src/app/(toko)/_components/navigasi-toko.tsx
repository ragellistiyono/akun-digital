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
import { useEffect, useLayoutEffect, useRef, useState } from "react";

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

// Urutan tab aktif di TAB_TOKO, atau -1 di halaman di luar keempat tab (misalnya Halaman Produk).
function indeksTabAktif(pathname: string) {
  return TAB_TOKO.findIndex(({ href }) => isTabAktif(href, pathname));
}

// Penanda tab aktif berbentuk matahari terbit (DESIGN.md "Penanda tab aktif: matahari terbit"). Satu
// elemen per navigasi yang bergeser ke tab baru dalam 0,45 dtk dengan easing standar (PRD §11.2), dan
// langsung melompat saat gerak dikurangi. Elemennya `aria-hidden`; tab aktif ditandai `aria-current`.
const KELAS_PENANDA =
  "pointer-events-none absolute transition-transform duration-450 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none motion-reduce:duration-0";

// Navigasi bawah bersembunyi saat digulir ke bawah melewati 120 px, dan muncul lagi saat digulir ke atas
// (DESIGN.md Layout "Gerak responsif"). Gerakan 6 px atau kurang diabaikan supaya navigasi tidak berkedip.
const AMBANG_SEMBUNYI_PX = 120;
const GERAK_DIABAIKAN_PX = 6;

// Bersembunyi atau tidaknya navigasi bawah setelah halaman digulir dari `yLalu` ke `y`, atau `null` bila
// gerakannya terlalu kecil untuk mengubah apa pun.
function sembunyiSetelahGulir(y: number, yLalu: number): boolean | null {
  if (y <= AMBANG_SEMBUNYI_PX) return false;
  if (Math.abs(y - yLalu) <= GERAK_DIABAIKAN_PX) return null;
  return y > yLalu;
}

export function NavigasiBawah() {
  const pathname = usePathname();
  const indeksAktif = indeksTabAktif(pathname);
  const [sembunyi, setSembunyi] = useState(false);

  useEffect(() => {
    let yLalu = window.scrollY;
    const perbarui = () => {
      const y = window.scrollY;
      const hasil = sembunyiSetelahGulir(y, yLalu);
      if (hasil === null) return;
      setSembunyi(hasil);
      yLalu = y;
    };
    window.addEventListener("scroll", perbarui, { passive: true });
    return () => window.removeEventListener("scroll", perbarui);
  }, []);

  // `data-sembunyi` menggeser navigasi ke bawah layar, dan bilah lekat ikut turun lewat selektor
  // `body:has([data-navigasi-bawah][data-sembunyi])`. Geserannya 40 px lebih jauh dari tinggi navigasi,
  // supaya matahari penanda dan pendarnya, yang naik di atas garis navigasi, ikut keluar dari layar. Tab
  // yang mendapat fokus, misalnya lewat Tab di papan ketik, memunculkan navigasi lagi supaya terlihat.
  return (
    <nav
      aria-label="Navigasi utama"
      data-navigasi-bawah=""
      data-sembunyi={sembunyi ? "" : undefined}
      onFocus={() => setSembunyi(false)}
      className="fixed inset-x-0 bottom-0 z-40 h-[calc(76px+env(safe-area-inset-bottom))] border-t border-garis bg-permukaan pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] data-sembunyi:translate-y-[calc(100%+40px)] motion-reduce:transition-none motion-reduce:duration-0 lebar:hidden"
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
                  "flex h-full flex-col items-center justify-center gap-1 text-xs font-extrabold",
                  aktif ? "text-tinta" : "text-tinta-redup",
                )}
              >
                <Ikon aria-hidden="true" className="size-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* Penanda selebar satu tab, digeser satu lebar tab per langkah. Matahari 28×14 px duduk di garis
          atas navigasi, di tengah tab aktif. */}
      {indeksAktif >= 0 && (
        <span
          data-penanda-tab=""
          aria-hidden="true"
          className={cn(KELAS_PENANDA, "top-0 left-0 w-1/4")}
          style={{ transform: `translateX(${indeksAktif * 100}%)` }}
        >
          <span className="absolute -top-3.5 left-1/2 h-3.5 w-7 -translate-x-1/2 rounded-t-full bg-matahari shadow-[0_-2px_14px_3px_color-mix(in_srgb,var(--matahari)_55%,transparent)]" />
        </span>
      )}
    </nav>
  );
}

// Posisi penanda navbar atas dalam piksel, relatif terhadap <nav>: titik tengah tautan aktif dan tepi
// atas penanda, 2 px di bawah tautan.
type PosisiPenanda = { pusat: number; atas: number };

export function NavbarAtas() {
  const pathname = usePathname();
  const indeksAktif = indeksTabAktif(pathname);
  const daftarRef = useRef<HTMLUListElement>(null);
  const [posisi, setPosisi] = useState<PosisiPenanda | null>(null);

  // Lebar tautan berbeda-beda, jadi posisi penanda diukur dari tautan aktif. Ukuran tautan bisa berubah
  // setelah huruf termuat atau saat layar melebar melewati 900 px, jadi pengukuran diulang lewat
  // ResizeObserver. Pengukuran berjalan sebelum browser melukis, sehingga penanda langsung bergeser dari
  // posisi lama ke posisi baru.
  useLayoutEffect(() => {
    const daftar = daftarRef.current;
    if (!daftar || indeksAktif < 0) {
      setPosisi(null);
      return;
    }
    const semuaTautan = Array.from(daftar.querySelectorAll("a"));
    const tautan = semuaTautan[indeksAktif];
    const ukur = () =>
      setPosisi({
        pusat: tautan.offsetLeft + tautan.offsetWidth / 2,
        atas: tautan.offsetTop + tautan.offsetHeight + 2,
      });
    ukur();
    const pengamat = new ResizeObserver(ukur);
    for (const el of semuaTautan) pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [indeksAktif]);

  return (
    <nav
      aria-label="Navigasi utama"
      className="relative ml-6 hidden lebar:block"
    >
      <ul ref={daftarRef} className="flex gap-1">
        {TAB_TOKO.map(({ href, label }) => {
          const aktif = isTabAktif(href, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-md px-4 text-[15px] font-bold hover:bg-langit-2",
                  aktif
                    ? "text-teks-di-aksi"
                    : "text-langit-redup hover:text-langit-teks",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* Matahari 20×10 px di tepi bawah bilah langit, di bawah tautan aktif. */}
      {indeksAktif >= 0 && posisi && (
        <span
          data-penanda-tab=""
          aria-hidden="true"
          className={cn(
            KELAS_PENANDA,
            "left-0 -ml-2.5 h-2.5 w-5 rounded-t-full bg-matahari shadow-[0_-2px_12px_2px_color-mix(in_srgb,var(--matahari)_60%,transparent)]",
          )}
          style={{
            top: posisi.atas,
            transform: `translateX(${posisi.pusat}px)`,
          }}
        />
      )}
    </nav>
  );
}
