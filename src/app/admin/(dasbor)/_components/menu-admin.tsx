"use client";

import {
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  TicketPercent,
  TriangleAlert,
  Users,
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
  { href: "/admin/pesanan", label: "Pesanan", ikon: ReceiptText },
  { href: "/admin/member", label: "Member", ikon: Users },
  { href: "/admin/kategori", label: "Kategori", ikon: LayoutGrid },
  { href: "/admin/produk", label: "Produk", ikon: Package },
  { href: "/admin/voucher", label: "Voucher", ikon: TicketPercent },
  { href: "/admin/pengaturan", label: "Pengaturan toko", ikon: Settings },
];

/**
 * Jumlah Pesanan Bermasalah di samping menu Pesanan (PRD §5.9), sebagai pil dengan ikon, angka, dan label
 * untuk pembaca layar, supaya tidak tampil hanya sebagai warna (DESIGN.md Status Pesanan).
 */
function JumlahBermasalah({ jumlah }: { jumlah: number }) {
  return (
    <span className="ml-auto inline-flex h-7 items-center gap-1 rounded-coret border-2 border-current bg-st-masalah-bg pr-2.5 pl-2 font-spidol text-[15px] leading-none font-bold text-st-masalah">
      <TriangleAlert aria-hidden="true" className="size-4" strokeWidth={2.5} />
      {jumlah}
      <span className="sr-only"> Pesanan Bermasalah</span>
    </span>
  );
}

// Kerangka menu dasbor admin (PRD §11.1, DESIGN.md Navigation): menu lipat di bawah 900 px,
// menu samping mulai 900 px. Dasbor admin tidak memakai navigasi bawah toko. Menu Pesanan menampilkan
// jumlah Pesanan Bermasalah bila ada (PRD §5.9). Ruang env(safe-area-inset-top) menjaga isinya dari jam dan
// poni iPhone; bilah status iPhone memakai gaya bawaan (PRD §11.4 ▶ Keputusan 2026-11-20), jadi ruang itu ikut
// berwarna `kertas` seperti bilah dan menu sampingnya. Di layar lebar menu samping setinggi layar: daftar
// tautannya bergulir sendiri bila layar pendek, dan Keluar dipisah garis putus-putus di dasar menu supaya tidak
// menempel pada tautan terakhir.
export function MenuAdmin({
  jumlahPesananBermasalah,
}: {
  jumlahPesananBermasalah: number;
}) {
  const pathname = usePathname();
  const [terbuka, setTerbuka] = useState(false);

  return (
    <div className="sticky top-0 z-30 bg-kertas pt-[env(safe-area-inset-top)] lebar:flex lebar:h-dvh lebar:w-60 lebar:shrink-0 lebar:flex-col lebar:border-r-2 lebar:border-dashed lebar:border-pensil">
      <div className="flex h-16 items-center justify-between gap-4 border-b-2 border-dashed border-pensil px-4 lebar:border-b-0">
        <MerekAdmin />
        <button
          type="button"
          aria-expanded={terbuka}
          aria-controls="menu-admin"
          onClick={() => setTerbuka((sebelumnya) => !sebelumnya)}
          className="tombol tombol-kecil tombol-kedua lebar:hidden"
        >
          {terbuka ? (
            <X aria-hidden="true" className="size-6" strokeWidth={2.5} />
          ) : (
            <Menu aria-hidden="true" className="size-6" strokeWidth={2.5} />
          )}
          Menu
        </button>
      </div>

      <nav
        id="menu-admin"
        aria-label="Menu admin"
        className={cn(
          "flex-col gap-4 border-b-2 border-dashed border-pensil px-4 pt-4 pb-6 lebar:flex lebar:min-h-0 lebar:flex-1 lebar:overflow-y-auto lebar:border-b-0 lebar:pt-2",
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
                    "flex h-10 items-center gap-2 rounded-coret border-2 px-3 text-[18px] leading-none",
                    aktif
                      ? "border-pensil bg-postit text-teks-postit shadow-coret-kecil"
                      : "border-transparent text-pensil hover:border-dashed hover:border-pensil",
                  )}
                >
                  <Ikon
                    aria-hidden="true"
                    className="size-6"
                    strokeWidth={2.5}
                  />
                  {label}
                  {href === "/admin/pesanan" && jumlahPesananBermasalah > 0 && (
                    <JumlahBermasalah jumlah={jumlahPesananBermasalah} />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <form
          action={aksiKeluarAdmin}
          className="border-t-2 border-dashed border-pensil pt-4 lebar:mt-auto"
        >
          <button type="submit" className="tombol tombol-kecil tombol-kedua">
            <LogOut aria-hidden="true" className="size-6" strokeWidth={2.5} />
            Keluar
          </button>
        </form>
      </nav>
    </div>
  );
}
