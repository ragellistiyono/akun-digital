import { User } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { labelMember } from "@/domain/label-member";
import { bacaSesiMember } from "@/server/auth/sesi-member";

import { NavbarAtas } from "./navigasi-toko";

// Tombol langit (DESIGN.md Buttons): pil 40 px dengan garis langit-garis di atas langit, hover langit-2.
const KELAS_TOMBOL_LANGIT =
  "ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-full border-[1.5px] border-langit-garis px-4 text-sm font-bold whitespace-nowrap text-langit-teks hover:bg-langit-2";

export async function BilahAtas() {
  const sesiMember = await bacaSesiMember(await headers());

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
        {/* PRD §11.1 ▶ Keputusan 2026-11-17: Tamu melihat "Masuk", Member melihat label Member yang
            membuka tab Akun. */}
        {sesiMember ? (
          <Link
            href="/akun"
            aria-label={`Akun ${labelMember(sesiMember.user.email)}`}
            className={KELAS_TOMBOL_LANGIT}
          >
            <User aria-hidden="true" className="size-6 shrink-0" />
            {labelMember(sesiMember.user.email)}
          </Link>
        ) : (
          <Link href="/masuk" className={KELAS_TOMBOL_LANGIT}>
            Masuk
          </Link>
        )}
      </div>
    </header>
  );
}
