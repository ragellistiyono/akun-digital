"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Bilah atas ciut begitu halaman digulir lebih dari 24 px (DESIGN.md Layout "Gerak responsif").
const AMBANG_CIUT_PX = 24;

// Satu ubin 160×8 px garis pensil yang sedikit bergelombang. Ujung kiri dan kanannya sama tinggi dan sama
// arah, jadi ubin-ubinnya bersambung tanpa patahan. Ubin dipakai sebagai topeng, sehingga warnanya tetap
// token `pensil` di mode terang maupun gelap.
const UBIN_GARIS =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='8'%3E%3Cpath d='M0 4C12 3.2 26 2.5 40 2.5S80 5.5 100 5.5S148 4.8 160 4' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E\")";

const GAYA_GARIS: CSSProperties = {
  maskImage: UBIN_GARIS,
  maskSize: "160px 8px",
  maskRepeat: "repeat-x",
};

/**
 * Garis pensil 3 px bergelombang selebar wadahnya (DESIGN.md "Tidak ada garis lurus"), setinggi 8 px. Hiasan
 * ini `aria-hidden` dan tidak menangkap klik. Wadahnya harus punya posisi, dan `className` menentukan letak
 * vertikalnya, misalnya `-bottom-1` supaya garis duduk tepat di tepi bawah wadah.
 */
export function GarisCoretan({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 h-2 bg-pensil",
        className,
      )}
      style={GAYA_GARIS}
    />
  );
}

// Satu-satunya bagian bilah atas yang berjalan di klien: membaca posisi gulir lalu memasang
// `data-ciut`. Isi bilah, termasuk sesi Member, tetap dirender di server lewat `children`. Anak bilah
// mengecil lewat varian `group-data-ciut:`.
//
// Bilah dipasang `fixed` di atas pengganjal setinggi bilah utuh (64 px), bukan `sticky`. Dengan begitu
// perubahan tinggi bilah tidak menggeser isi halaman: browser tidak menyesuaikan posisi gulir, sehingga
// bilah tidak berkedip bolak-balik di sekitar ambang, dan isi yang tergulir tampil di 12 px yang dilepas
// bilah.
//
// Bilah berlatar kertas dengan garis pensil bergelombang di tepi bawahnya. Saat ciut, bilah mendapat
// bayangan potongan kertas 4 px ke bawah tanpa blur (PRD §11.2), yang menebalkan garis itu.
//
// Bilah dan pengganjalnya ditambah env(safe-area-inset-top), supaya isi bilah tidak tertutup jam dan poni
// bila bilah status pernah menimpa halaman. Bilah status iPhone kini bergaya bawaan dan tidak tembus
// (PRD §11.4 ▶ Keputusan 2026-11-20), jadi nilainya biasanya 0. Bila tidak, zona itu ikut berlatar
// kertas seperti bilahnya.
export function KerangkaBilahAtas({ children }: { children: ReactNode }) {
  const [ciut, setCiut] = useState(false);

  useEffect(() => {
    const perbarui = () => setCiut(window.scrollY > AMBANG_CIUT_PX);
    perbarui();
    window.addEventListener("scroll", perbarui, { passive: true });
    return () => window.removeEventListener("scroll", perbarui);
  }, []);

  return (
    <>
      <header
        data-ciut={ciut ? "" : undefined}
        className="group fixed inset-x-0 top-0 z-30 bg-kertas pt-[env(safe-area-inset-top)] text-pensil transition-shadow duration-250 ease-[cubic-bezier(.16,1,.3,1)] data-ciut:[box-shadow:0_4px_0_0_var(--bayang)] motion-reduce:transition-none motion-reduce:duration-0"
      >
        {children}
        <GarisCoretan className="-bottom-1" />
      </header>
      <div
        aria-hidden="true"
        className="h-[calc(4rem+env(safe-area-inset-top))]"
      />
    </>
  );
}
