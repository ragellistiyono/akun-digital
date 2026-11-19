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
      className="chip shrink-0"
    >
      {children}
    </button>
  );
}

/**
 * Deret chip Kategori di bawah kotak cari (PRD §3.6, DESIGN.md "Chips"). Chip yang ditekan
 * (`aria-pressed`) tampil sebagai catatan post-it lewat kelas `chip`, dan menyaring bagian semua Produk
 * lewat `?kategori=`; menekannya lagi, atau menekan
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

  // Padding 8 px di atas dan bawah memberi ruang bagi cincin fokus, bayangan chip terpilih, dan chip yang
  // miring saat hover, karena deret yang bisa digeser memotong apa pun di luar kotaknya. Deret menjorok
  // selebar padding samping halaman (16 px, 32 px mulai 900 px), jadi di ponsel ia bisa digeser sampai
  // tepi layar sementara chip pertama tetap sejajar dengan isi. Mulai 900 px chip yang tidak muat turun
  // ke baris berikutnya, supaya semua Kategori terlihat tanpa digeser.
  return (
    <div
      role="group"
      aria-label="Saring menurut Kategori"
      className="-mx-4 flex gap-3 overflow-x-auto overscroll-x-contain px-4 py-2 [scrollbar-width:none] lebar:-mx-8 lebar:flex-wrap lebar:px-8"
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
