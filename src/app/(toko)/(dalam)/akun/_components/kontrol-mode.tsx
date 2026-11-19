"use client";

import { Moon, Smartphone, Sun, type LucideIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import {
  bacaMode,
  dengarMode,
  terapkanMode,
  type ModeTampilan,
} from "../../../../_mode/mode-tampilan";

const PILIHAN: { mode: ModeTampilan; label: string; Ikon: LucideIcon }[] = [
  { mode: "perangkat", label: "Perangkat", Ikon: Smartphone },
  { mode: "terang", label: "Terang", Ikon: Sun },
  { mode: "gelap", label: "Gelap", Ikon: Moon },
];

// Server tidak tahu pilihan yang tersimpan di browser, jadi HTML awal menandai Perangkat. Setelah hidrasi,
// pilihan yang tersimpan langsung tampil.
const modeServer = (): ModeTampilan => "perangkat";

/**
 * Bagian "Tampilan" di tab Akun (PRD §11.3 ▶ Keputusan 2026-11-18), berupa kartu dengan kontrol segmen mode
 * (DESIGN.md "Kontrol segmen mode"): wadah `kertas-lama` bertepi pensil 2 px, pilihan aktif menjadi
 * post-it bertepi pensil dengan bayangan coretan kecil. Pilihannya radio bawaan browser dengan nama yang
 * sama, jadi tombol panah memindahkan pilihan seperti radiogroup biasa. Ketiga pilihan sama lebar selama
 * muat. Di ponsel sempit, misalnya 360 px, kolom "Perangkat" melebar seukuran isinya supaya ikon dan teksnya
 * tidak terpotong, dan dua pilihan lain berbagi sisa lebarnya.
 */
export function KontrolMode() {
  const mode = useSyncExternalStore(dengarMode, bacaMode, modeServer);

  return (
    <section aria-labelledby="tampilan-judul" className="kartu p-5">
      <h2 id="tampilan-judul" className="text-[26px]">
        Tampilan
      </h2>
      <div
        role="radiogroup"
        aria-label="Mode tampilan"
        className="mt-4 grid grid-cols-[repeat(3,minmax(max-content,1fr))] gap-1.5 rounded-coret border-2 border-pensil bg-kertas-lama p-1.5"
      >
        {PILIHAN.map(({ mode: nilai, label, Ikon }) => (
          <label
            key={nilai}
            className="relative flex h-11 cursor-pointer items-center justify-center gap-2 rounded-coret border-2 border-transparent text-[17px] text-pensil-redup has-checked:border-pensil has-checked:bg-postit has-checked:text-teks-postit has-checked:shadow-coret-kecil has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-pulpen has-focus-visible:outline-dashed"
          >
            <input
              type="radio"
              name="mode-tampilan"
              value={nilai}
              checked={mode === nilai}
              onChange={() => terapkanMode(nilai)}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0"
            />
            <Ikon
              aria-hidden="true"
              strokeWidth={2.5}
              className="size-[18px] shrink-0"
            />
            {label}
          </label>
        ))}
      </div>
      <p className="mt-3 text-[15px] text-pensil-redup">
        Pilihan ini hanya diingat di perangkat ini.
      </p>
    </section>
  );
}
