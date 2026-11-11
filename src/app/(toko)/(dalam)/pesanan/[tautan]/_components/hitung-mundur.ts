import { kedaluwarsaPesanan } from "@/domain/kedaluwarsa-pesanan";

/** Rentang hitung mundur yang menggerakkan waktu senja: masa berlaku QRIS 15 menit (PRD §5.8). */
const RENTANG_SENJA_MS = 15 * 60 * 1000;

const duaAngka = (n: number) => String(n).padStart(2, "0");

/**
 * Hitung mundur QRIS di kartu senja Halaman bayar (PRD §5.6, DESIGN.md "Pemandangan senja"), dari waktu
 * kedaluwarsa yang tersimpan di Pesanan dan waktu "sekarang", keduanya dalam milidetik.
 *
 * - `teks`: sisa waktu "mm:ss". Detik yang tidak bulat dibulatkan ke atas, jadi "00:00" hanya tampil saat
 *   QRIS sudah kedaluwarsa (`habis`), yaitu begitu waktu kedaluwarsa tercapai menurut kedaluwarsaPesanan.
 * - `sisaMenit`: sisa menit yang dibulatkan ke atas, untuk pembaca layar.
 * - `t`: waktu senja pemandangan, 0 saat sisa waktu 15:00 sampai 1 saat sisa waktu 00:00.
 */
export function hitungMundur({
  kedaluwarsaPada,
  sekarang,
}: {
  kedaluwarsaPada: number;
  sekarang: number;
}) {
  const sisaMs = Math.max(0, kedaluwarsaPada - sekarang);
  const sisaDetik = Math.ceil(sisaMs / 1000);
  return {
    teks: `${duaAngka(Math.floor(sisaDetik / 60))}:${duaAngka(sisaDetik % 60)}`,
    sisaMenit: Math.ceil(sisaMs / 60_000),
    habis: kedaluwarsaPesanan({
      kedaluwarsaPada: new Date(kedaluwarsaPada),
      sekarang: new Date(sekarang),
    }).kedaluwarsa,
    t: Math.min(1, Math.max(0, 1 - sisaMs / RENTANG_SENJA_MS)),
  };
}
