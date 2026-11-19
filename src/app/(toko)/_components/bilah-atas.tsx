import { User } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { labelMember } from "@/domain/label-member";
import { bacaSesiMember } from "@/server/auth/sesi-member";

import { KerangkaBilahAtas } from "./kerangka-bilah-atas";
import { NavbarAtas } from "./navigasi-toko";

// Gerak bilah ciut (DESIGN.md Layout "Gerak responsif"): easing standar, tanpa transisi di bawah
// prefers-reduced-motion.
const KELAS_GERAK =
  "duration-250 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none motion-reduce:duration-0";

// Tombol bilah atas (DESIGN.md Buttons): tombol kecil 40 px bergaris pensil, rata kanan di zonanya.
const KELAS_TOMBOL_BILAH =
  "tombol tombol-kecil h-10 shrink-0 justify-self-end whitespace-nowrap";

export async function BilahAtas() {
  const sesiMember = await bacaSesiMember(await headers());

  return (
    <KerangkaBilahAtas>
      {/* Selebar wadah isi halaman: isi maksimal 1120 px di tengah, padding samping 16 px (32 px mulai 900
          px). Di ponsel monogram di kiri dan tombol di kanan. Mulai 900 px bilah terbagi tiga zona
          (DESIGN.md Layout): merek di kiri, empat tab tepat di tengah bilah, dan tombol di kanan. Kolom
          `1fr auto 1fr` menjaga tab tetap di tengah walau lebar merek dan tombol berbeda. */}
      <div
        className={`mx-auto flex h-16 max-w-[1184px] items-center justify-between gap-4 px-4 transition-[height] group-data-ciut:h-[52px] lebar:grid lebar:grid-cols-[1fr_auto_1fr] lebar:gap-8 lebar:px-8 ${KELAS_GERAK}`}
      >
        <Link
          href="/"
          aria-label="MIWE Digital Store, beranda"
          className={`justify-self-start font-spidol text-[28px] leading-none font-bold whitespace-nowrap text-pensil transition-[font-size] group-data-ciut:text-[24px] ${KELAS_GERAK}`}
        >
          {/* Monogram spidol dengan lingkaran coretan merah di sekelilingnya. Lingkarannya diukur dalam em,
              jadi ikut mengecil bersama monogram saat bilah ciut. */}
          <span className="relative inline-block">
            MDS
            <svg
              aria-hidden="true"
              viewBox="0 0 120 60"
              preserveAspectRatio="none"
              fill="none"
              className="pointer-events-none absolute top-[-0.24em] left-[-0.32em] h-[calc(100%+0.48em)] w-[calc(100%+0.64em)] -rotate-2 overflow-visible text-spidol"
            >
              <path
                d="M104 13C90 3 30 2 12 16C-2 28 10 52 56 55C98 58 121 42 112 21C106 9 82 4 60 7"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </span>
          <span className="ml-3 hidden font-tangan text-[16px] font-normal text-pensil-redup lebar:inline">
            MIWE Digital Store
          </span>
        </Link>
        <NavbarAtas />
        {/* PRD §11.1 ▶ Keputusan 2026-11-17: Tamu melihat "Masuk", Member melihat label Member yang
            membuka tab Akun. */}
        {sesiMember ? (
          <Link
            href="/akun"
            aria-label={`Akun ${labelMember(sesiMember.user.email)}`}
            className={KELAS_TOMBOL_BILAH}
          >
            <User
              aria-hidden="true"
              strokeWidth={2.5}
              className="size-5 shrink-0"
            />
            {labelMember(sesiMember.user.email)}
          </Link>
        ) : (
          <Link href="/masuk" className={KELAS_TOMBOL_BILAH}>
            Masuk
          </Link>
        )}
      </div>
    </KerangkaBilahAtas>
  );
}
