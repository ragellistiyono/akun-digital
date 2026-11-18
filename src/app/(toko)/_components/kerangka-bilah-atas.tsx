"use client";

import { useEffect, useState, type ReactNode } from "react";

// Bilah atas ciut begitu halaman digulir lebih dari 24 px (DESIGN.md Layout "Gerak responsif").
const AMBANG_CIUT_PX = 24;

// Satu-satunya bagian bilah atas yang berjalan di klien: membaca posisi gulir lalu memasang
// `data-ciut`. Isi bilah, termasuk sesi Member, tetap dirender di server lewat `children`. Anak bilah
// mengecil lewat varian `group-data-ciut:`.
//
// Bilah dipasang `fixed` di atas pengganjal setinggi bilah utuh (64 px), bukan `sticky`. Dengan begitu
// perubahan tinggi bilah tidak menggeser isi halaman: browser tidak menyesuaikan posisi gulir, sehingga
// bilah tidak berkedip bolak-balik di sekitar ambang, dan isi yang tergulir tampil di 12 px yang dilepas
// bilah.
//
// Di iPhone yang membuka toko dari layar utama, bilah status tembus (layar-pembuka-iphone.ts), jadi bilah
// dan pengganjalnya ditambah env(safe-area-inset-top) supaya isinya tidak tertutup jam dan poni. Di browser
// tanpa poni nilainya 0.
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
        className="group fixed inset-x-0 top-0 z-30 bg-langit pt-[env(safe-area-inset-top)] text-langit-teks transition-shadow duration-250 ease-[cubic-bezier(.16,1,.3,1)] data-ciut:[box-shadow:var(--bayang-bilah)] motion-reduce:transition-none motion-reduce:duration-0"
      >
        {children}
      </header>
      <div
        aria-hidden="true"
        className="h-[calc(4rem+env(safe-area-inset-top))]"
      />
    </>
  );
}
