"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";

import type { Kategori } from "@/server/kategori";

import { alamatSaringanKategori } from "./alamat-saringan-kategori";

function Chip({
  ditekan,
  onClick,
  children,
}: {
  ditekan: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ditekan}
      onClick={onClick}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border-[1.5px] border-garis bg-permukaan px-4 text-sm font-bold whitespace-nowrap text-tinta transition-colors duration-200 hover:border-monogram motion-reduce:transition-none aria-pressed:border-langit aria-pressed:bg-langit aria-pressed:text-teks-di-aksi"
    >
      {children}
    </button>
  );
}

/**
 * Deret chip Kategori di bawah kotak cari (PRD §3.6, DESIGN.md "Chips"). Chip yang ditekan
 * (`aria-pressed`) menyaring bagian semua Produk lewat `?kategori=`; menekannya lagi, atau menekan
 * "Semua", menghapus saringan. Kata cari tidak ikut terbawa. Deret bisa digeser ke samping sampai tepi
 * layar tanpa membuat halaman ikut bergulir ke samping.
 */
export function DeretKategori({
  kategori,
  terpilihId,
}: {
  kategori: Kategori[];
  terpilihId: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Chip langsung tampil terpilih selagi Beranda dengan saringan baru dimuat.
  const [dipilihId, setDipilihId] = useOptimistic(terpilihId);

  if (kategori.length === 0) return null;

  const pilih = (id: string | null) =>
    startTransition(() => {
      setDipilihId(id);
      router.push(alamatSaringanKategori(id), { scroll: false });
    });

  // Padding 8 px di atas dan bawah memberi ruang bagi cincin fokus chip, karena deret yang bisa
  // digeser memotong apa pun di luar kotaknya.
  return (
    <div
      role="group"
      aria-label="Saring menurut Kategori"
      className="-mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 py-2 [scrollbar-width:none]"
    >
      <Chip ditekan={dipilihId === null} onClick={() => pilih(null)}>
        Semua
      </Chip>
      {kategori.map((k) => (
        <Chip
          key={k.id}
          ditekan={dipilihId === k.id}
          onClick={() => pilih(dipilihId === k.id ? null : k.id)}
        >
          <Image
            unoptimized
            src={k.alamatIkon}
            alt=""
            width={24}
            height={24}
            className="size-6 object-contain"
          />
          {k.nama}
        </Chip>
      ))}
    </div>
  );
}
