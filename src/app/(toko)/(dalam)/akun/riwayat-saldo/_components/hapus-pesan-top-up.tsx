"use client";

import { useEffect } from "react";

import { PESAN_TOP_UP } from "../pesan-top-up";

/**
 * Menghapus cookie pesan Top up begitu Riwayat saldo tampil (PRD §15.3 ▶ Keputusan 2026-11-21, issue 240). Pesan yang
 * sudah tampil tetap ada, tetapi tidak tampil lagi saat Riwayat saldo dimuat ulang atau dibuka lagi. Tidak menampilkan
 * apa pun.
 */
export function HapusPesanTopUp() {
  useEffect(() => {
    document.cookie = `${PESAN_TOP_UP.nama}=; path=${PESAN_TOP_UP.path}; max-age=0; samesite=lax`;
  }, []);

  return null;
}
