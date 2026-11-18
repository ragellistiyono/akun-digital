import { z } from "zod";

/**
 * Mode tampilan pilihan Pembeli (PRD §11.3 ▶ Keputusan 2026-11-18). "terang" dan "gelap" memasang
 * `data-mode` pada `<html>`, yang mengalahkan skema warna perangkat di globals.css. "perangkat" menghapus
 * atribut itu. Pilihan disimpan di localStorage, jadi hanya diingat di browser itu, dan berlaku untuk toko
 * maupun dasbor admin karena keduanya memakai root layout yang sama.
 */
const ModeTampilan = z.enum(["perangkat", "terang", "gelap"]);
export type ModeTampilan = z.infer<typeof ModeTampilan>;

// Nama kunci sama dengan prototipe docs/design/prototipe/index.html.
const KUNCI = "miwe-mode";

/**
 * Script yang ditanam di `<head>` root layout dan berjalan sebelum isi halaman dilukis, supaya halaman
 * langsung tampil dengan mode pilihan tanpa sempat tampil dengan mode lain. Isinya harus JavaScript
 * biasa, karena berjalan sebelum script aplikasi dimuat.
 */
export const SKRIP_MODE_AWAL = `try{var m=localStorage.getItem(${JSON.stringify(KUNCI)});if(m==="terang"||m==="gelap")document.documentElement.setAttribute("data-mode",m)}catch(e){}`;

const pendengar = new Set<() => void>();

/** Mode yang tersimpan di browser ini. Nilai yang tidak dikenal atau tidak terbaca dianggap "perangkat". */
export function bacaMode(): ModeTampilan {
  try {
    return ModeTampilan.catch("perangkat").parse(localStorage.getItem(KUNCI));
  } catch {
    // localStorage bisa ditolak browser, misalnya saat penyimpanan situs diblokir.
    return "perangkat";
  }
}

/** Memasang mode di `<html>` saat itu juga, lalu menyimpannya di browser ini. */
export function terapkanMode(mode: ModeTampilan) {
  if (mode === "perangkat") {
    document.documentElement.removeAttribute("data-mode");
  } else {
    document.documentElement.setAttribute("data-mode", mode);
  }
  try {
    localStorage.setItem(KUNCI, mode);
  } catch {
    // Tanpa localStorage, mode tetap berlaku di halaman ini, hanya tidak diingat.
  }
  pendengar.forEach((dengar) => dengar());
}

/** Untuk useSyncExternalStore: memberi tahu komponen setiap kali terapkanMode() dipanggil. */
export function dengarMode(dengar: () => void) {
  pendengar.add(dengar);
  return () => {
    pendengar.delete(dengar);
  };
}
