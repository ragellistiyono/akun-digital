"use client";

import { useEffect } from "react";

import { TANDA_SUDAH_DIBAYAR } from "./tanda-sudah-dibayar";

/**
 * Menghapus tanda pembatalan sudah dibayar dari alamat begitu halaman tampil (issue T20-b). Alamatnya
 * diganti lewat history.replaceState, sehingga halaman tidak dibuat ulang dan pesan penjelas yang sudah
 * tampil tetap ada, tetapi tidak tampil lagi saat halaman dimuat ulang. Tidak menampilkan apa pun.
 */
export function HapusTandaSudahDibayar() {
  useEffect(() => {
    const alamat = new URL(window.location.href);
    alamat.searchParams.delete(TANDA_SUDAH_DIBAYAR.nama);
    window.history.replaceState(null, "", alamat);
  }, []);

  return null;
}
