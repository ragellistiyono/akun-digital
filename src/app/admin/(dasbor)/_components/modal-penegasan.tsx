"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  type MouseEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

/** Elemen yang bisa difokuskan dengan Tab. Tombol nonaktif tidak termasuk. */
const BISA_DIFOKUS =
  'button:not(:disabled), [href], input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Menjaga Tab dan Shift+Tab tetap berputar di dalam `panel`. Bila semua tombolnya nonaktif, misalnya selama aksi
 * diproses, fokus ditaruh di panel itu sendiri, supaya tidak lepas ke halaman di belakang modal.
 */
function putarFokus(event: KeyboardEvent, panel: HTMLElement) {
  const daftar = Array.from(panel.querySelectorAll<HTMLElement>(BISA_DIFOKUS));
  const pertama = daftar.at(0);
  const terakhir = daftar.at(-1);
  const aktif = document.activeElement;
  if (!pertama || !terakhir) {
    event.preventDefault();
    panel.focus();
  } else if (event.shiftKey && (aktif === pertama || !panel.contains(aktif))) {
    event.preventDefault();
    terakhir.focus();
  } else if (
    !event.shiftKey &&
    (aktif === terakhir || !panel.contains(aktif))
  ) {
    event.preventDefault();
    pertama.focus();
  }
}

/**
 * Modal penegasan untuk aksi dasbor admin yang tidak bisa dibatalkan (PRD §9.10, DESIGN.md Navigation ▶ Keputusan
 * 2026-11-22). Pemakainya memasang modal ini selama penegasan terbuka, lalu melepasnya setelah Batal atau setelah
 * aksinya selesai, termasuk bila server menolak aksinya.
 *
 * Isinya `judul` berupa pertanyaan pendek, `rincian` akibat aksinya (teks penegasan yang sudah ditetapkan), lalu
 * tombol `labelYa` dan Batal. Tombol "Ya, …" mengirim form berisi `isian` sebagai isian tersembunyi ke `aksi`,
 * biasanya pengirim dari `useActionState`. Selama `sedangMemproses`, kedua tombol nonaktif, tombol aksi menampilkan
 * `labelProses`, dan Esc maupun ketukan di latar tidak menutup modal.
 *
 * Saat terbuka, fokus pindah ke Batal, supaya Enter yang tidak disengaja tidak menjalankan aksi, dan Tab berputar di
 * dalam modal. Esc dan ketukan di latar sama dengan Batal. Setelah modal dilepas, fokus kembali ke `pemicu`, yaitu
 * tombol yang membukanya, bila tombol itu masih ada di halaman.
 */
export function ModalPenegasan({
  pemicu,
  judul,
  rincian,
  labelYa,
  labelProses,
  aksi,
  isian,
  sedangMemproses,
  onBatal,
}: {
  pemicu: RefObject<HTMLElement | null>;
  judul: string;
  rincian: string;
  labelYa: string;
  labelProses: string;
  aksi: (formData: FormData) => void;
  isian: Record<string, string>;
  sedangMemproses: boolean;
  onBatal: () => void;
}) {
  const idJudul = useId();
  const idRincian = useId();
  const panel = useRef<HTMLDivElement>(null);
  const tombolBatal = useRef<HTMLButtonElement>(null);

  // Esc dan ketukan di latar sama dengan Batal, kecuali selama aksi diproses: aksi yang sudah dikirim tidak bisa
  // ditarik.
  function batal() {
    if (!sedangMemproses) onBatal();
  }
  const tekanEsc = useEffectEvent(batal);

  useEffect(() => {
    const tombolPemicu = pemicu.current;
    tombolBatal.current?.focus();

    function tekanTombol(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        tekanEsc();
      } else if (event.key === "Tab" && panel.current) {
        putarFokus(event, panel.current);
      }
    }
    document.addEventListener("keydown", tekanTombol);
    return () => {
      document.removeEventListener("keydown", tekanTombol);
      tombolPemicu?.focus();
    };
  }, [pemicu]);

  // Klik kedua dari klik ganda pada tombol pemicu (`detail` 2) jatuh di modal yang baru terbuka. Klik itu
  // diabaikan, supaya tidak langsung menutup modal lewat latar atau Batal, dan tidak menjalankan aksi lewat tombol
  // "Ya, …". Klik pertama sudah cukup untuk ketiganya, dan tombol yang ditekan lewat papan ketik ber-`detail` 0.
  const klikKedua = (event: MouseEvent) => event.detail >= 2;

  // Menekan latar tidak memindahkan fokus dari modal, begitu pula tekanan kedua dari klik ganda di mana pun di
  // dalamnya, supaya fokus tetap di Batal setelah klik ganda pada tombol pemicu.
  function tekanLatar(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget || klikKedua(event)) {
      event.preventDefault();
    }
  }

  function ketukLatar(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !klikKedua(event)) batal();
  }

  function ketukYa(event: MouseEvent<HTMLButtonElement>) {
    if (klikKedua(event)) event.preventDefault();
  }

  function ketukBatal(event: MouseEvent<HTMLButtonElement>) {
    if (!klikKedua(event)) onBatal();
  }

  return createPortal(
    // Lapisan latar menutup seluruh halaman, termasuk menu samping. Panel berada di tengahnya dengan `m-auto`, dan
    // lapisan ini bisa digulir bila rinciannya lebih tinggi dari layar.
    <div
      data-latar-modal=""
      onMouseDown={tekanLatar}
      onClick={ketukLatar}
      className="fixed inset-0 z-50 flex animate-in overflow-y-auto bg-pensil/40 p-4 duration-150 ease-[cubic-bezier(.16,1,.3,1)] fade-in motion-reduce:animate-none"
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idJudul}
        aria-describedby={idRincian}
        className="kartu m-auto flex w-full max-w-[480px] flex-col gap-4 border-aksi p-4 shadow-coret outline-none sm:p-6"
      >
        <h2 id={idJudul} className="text-[26px] [overflow-wrap:anywhere]">
          {judul}
        </h2>
        <p id={idRincian} className="text-[17px] [overflow-wrap:anywhere]">
          {rincian}
        </p>
        <form
          action={aksi}
          className="flex flex-col gap-3 lebar:flex-row lebar:flex-wrap"
        >
          {Object.entries(isian).map(([nama, nilai]) => (
            <input key={nama} type="hidden" name={nama} value={nilai} />
          ))}
          <button
            type="submit"
            disabled={sedangMemproses}
            onClick={ketukYa}
            className="tombol [overflow-wrap:anywhere]"
          >
            {sedangMemproses ? labelProses : labelYa}
          </button>
          <button
            type="button"
            ref={tombolBatal}
            disabled={sedangMemproses}
            onClick={ketukBatal}
            className="tombol tombol-kedua"
          >
            Batal
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
