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

import { GarisCoretan } from "./kerangka-bilah-atas";

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

// Penanda tab aktif berbentuk matahari terbit (DESIGN.md "Penanda tab aktif: matahari coretan"). Satu
// elemen per navigasi yang bergeser ke tab baru dalam 0,45 dtk dengan easing standar (PRD §11.2), dan
// langsung melompat saat gerak dikurangi. Elemennya `aria-hidden`; tab aktif ditandai `aria-current`.
const KELAS_PENANDA =
  "pointer-events-none absolute transition-transform duration-450 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none motion-reduce:duration-0";

/**
 * Setengah matahari coretan: isi `matahari`, garis pensil 2 px, dan lima sinar pendek, tanpa pendar. Gambar
 * ini mengisi wadahnya yang berbanding 2:1 (alas matahari di tepi bawah wadah), dan sinarnya keluar dari
 * wadah itu, sehingga ukuran tempat penanda tidak berubah. Garisnya tetap 2 px di ukuran berapa pun. Titik
 * asal transformasi SVG ini (`origin-bottom`) adalah pusat alas matahari.
 */
function MatahariCoretan({ className }: { className?: string }) {
  // viewBox memakai satuan wadah 28×14 ditambah 10 satuan di kiri, kanan, dan atas untuk sinar, jadi SVG
  // diletakkan 10/28 lebar ke kiri, 10/14 tinggi ke atas, dan selebar serta setinggi 48/28 = 24/14 wadah.
  return (
    <svg
      aria-hidden="true"
      viewBox="-10 -10 48 24"
      className={cn(
        "absolute top-[-71.429%] left-[-35.714%] h-[171.429%] w-[171.429%] overflow-visible",
        className,
      )}
    >
      <path
        d="M1.5 14C1 6 7 1.2 14.5 1.5C22 1.8 27 7 26.5 14"
        className="fill-matahari stroke-pensil"
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-1 9.5L-5 8M4.6 1.8L2-2.2M14.2-1.5L14.6-6M23.4 1.6L26-2.4M29 9.4L33 7.8"
        fill="none"
        className="stroke-pensil"
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

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
  // supaya matahari penanda dan sinarnya, yang naik di atas garis navigasi, ikut keluar dari layar. Tab
  // yang mendapat fokus, misalnya lewat Tab di papan ketik, memunculkan navigasi lagi supaya terlihat.
  //
  // Navigasi berlatar permukaan dengan garis pensil bergelombang di tepi atasnya, yang menjadi cakrawala
  // tempat matahari penanda terbit. Garis itu dilukis setelah penanda, jadi alas matahari tertutup garis.
  return (
    <nav
      aria-label="Navigasi utama"
      data-navigasi-bawah=""
      data-sembunyi={sembunyi ? "" : undefined}
      onFocus={() => setSembunyi(false)}
      className="fixed inset-x-0 bottom-0 z-40 h-[calc(76px+env(safe-area-inset-bottom))] bg-permukaan pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] data-sembunyi:translate-y-[calc(100%+40px)] motion-reduce:transition-none motion-reduce:duration-0 lebar:hidden"
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
                  "flex h-full flex-col items-center justify-center gap-1 text-[15px] leading-none",
                  aktif ? "text-pensil" : "text-pensil-redup",
                )}
              >
                <Ikon aria-hidden="true" strokeWidth={2.5} className="size-6" />
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
          <span className="absolute -top-3.5 left-1/2 h-3.5 w-7 -translate-x-1/2">
            <MatahariCoretan />
          </span>
        </span>
      )}
      <GarisCoretan className="-top-1" />
    </nav>
  );
}

// Navbar atas (mulai 900 px) berada di zona tengah bilah atas, setinggi bilah itu, dengan jarak 32 px
// antarlabel tab. Tab aktif hanya ditandai matahari di garis bawah bilah, tanpa garis gelombang di bawah
// labelnya, supaya kedua penanda tidak bertabrakan.
export function NavbarAtas() {
  const pathname = usePathname();
  const indeksAktif = indeksTabAktif(pathname);
  const daftarRef = useRef<HTMLUListElement>(null);
  // Titik tengah tautan aktif dalam piksel, relatif terhadap <nav>.
  const [pusat, setPusat] = useState<number | null>(null);

  // Lebar tautan berbeda-beda, jadi posisi penanda diukur dari tautan aktif. Ukuran tautan bisa berubah
  // setelah huruf termuat atau saat layar melebar melewati 900 px, jadi pengukuran diulang lewat
  // ResizeObserver. Pengukuran berjalan sebelum browser melukis, sehingga penanda langsung bergeser dari
  // posisi lama ke posisi baru.
  useLayoutEffect(() => {
    const daftar = daftarRef.current;
    if (!daftar || indeksAktif < 0) {
      setPusat(null);
      return;
    }
    const semuaTautan = Array.from(daftar.querySelectorAll("a"));
    const tautan = semuaTautan[indeksAktif];
    const ukur = () => setPusat(tautan.offsetLeft + tautan.offsetWidth / 2);
    ukur();
    const pengamat = new ResizeObserver(ukur);
    for (const el of semuaTautan) pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [indeksAktif]);

  return (
    <nav
      aria-label="Navigasi utama"
      className="relative hidden self-stretch lebar:block"
    >
      <ul ref={daftarRef} className="flex h-full items-center gap-2">
        {TAB_TOKO.map(({ href, label }) => {
          const aktif = isTabAktif(href, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "goyang inline-flex h-10 items-center rounded-coret px-3 text-[18px]",
                  aktif ? "text-pensil" : "text-pensil-redup hover:text-pensil",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* Matahari 20×10 px yang alasnya duduk di garis bawah bilah atas, di bawah tautan aktif. <nav>
          setinggi bilah, jadi matahari ikut turun saat bilah ciut dari 64 ke 52 px. Saat ciut ia mengecil
          bersama monogram (85%), sehingga sinarnya tetap di bawah huruf tautan. */}
      {indeksAktif >= 0 && pusat !== null && (
        <span
          data-penanda-tab=""
          aria-hidden="true"
          className={cn(KELAS_PENANDA, "bottom-0 left-0 -ml-2.5 h-2.5 w-5")}
          style={{ transform: `translateX(${pusat}px)` }}
        >
          <MatahariCoretan className="origin-bottom transition-[scale] duration-250 ease-[cubic-bezier(.16,1,.3,1)] group-data-ciut:scale-85 motion-reduce:transition-none motion-reduce:duration-0" />
        </span>
      )}
    </nav>
  );
}
