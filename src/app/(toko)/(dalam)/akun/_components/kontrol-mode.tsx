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
 * Bagian "Tampilan" di tab Akun (PRD §11.3 ▶ Keputusan 2026-11-18) dengan kontrol segmen mode
 * (DESIGN.md "Kontrol segmen mode"): wadah `permukaan-2` radius 14 px, pilihan aktif berlatar `permukaan`
 * dengan Bayang. Pilihannya radio bawaan browser dengan nama yang sama, jadi tombol panah memindahkan
 * pilihan seperti radiogroup biasa.
 */
export function KontrolMode({ className }: { className?: string }) {
  const mode = useSyncExternalStore(dengarMode, bacaMode, modeServer);

  return (
    <section aria-labelledby="tampilan-judul" className={className}>
      <h2 id="tampilan-judul" className="text-lg font-extrabold">
        Tampilan
      </h2>
      <div
        role="radiogroup"
        aria-label="Mode tampilan"
        className="mt-4 grid grid-cols-3 gap-1 rounded-[14px] bg-permukaan-2 p-1"
      >
        {PILIHAN.map(({ mode: nilai, label, Ikon }) => (
          <label
            key={nilai}
            className="relative flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] text-sm font-bold text-tinta-redup has-checked:bg-permukaan has-checked:text-tinta has-checked:shadow-bayang has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-monogram"
          >
            <input
              type="radio"
              name="mode-tampilan"
              value={nilai}
              checked={mode === nilai}
              onChange={() => terapkanMode(nilai)}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0"
            />
            <Ikon aria-hidden="true" className="size-[18px] shrink-0" />
            {label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-tinta-redup">
        Pilihan ini hanya diingat di perangkat ini.
      </p>
    </section>
  );
}
