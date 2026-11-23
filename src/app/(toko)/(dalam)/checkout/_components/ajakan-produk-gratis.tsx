import Link from "next/link";

import { cn } from "@/lib/utils";

import { denganTujuan } from "../../daftar/tujuan";
import { PARAMETER_ALAMAT_KEMBALI } from "../../masuk/alamat-kembali";

/** Panel (DESIGN.md "Cards / Containers"): padding 16 px, dan 24 px di layar lebar yang kolomnya lebih lapang. */
const PANEL = "kartu p-4 lebar:p-6";

/**
 * Tautan di dalam teks: pulpen biru yang digarisbawahi, di atas `permukaan` supaya kontrasnya cukup, sama seperti
 * tautan di form checkout.
 */
const KELAS_TAUTAN = "text-pulpen underline decoration-2 underline-offset-4";

/**
 * Checkout Produk gratis untuk Tamu (PRD §16.3, UAT-P2): nama Produk dan Varian, lalu "Produk gratis khusus Member.
 * Masuk atau Daftar dulu." tanpa form, isian voucher, maupun tombol bayar. Hanya kata "Masuk" dan "Daftar" yang
 * menjadi tautan.
 * - "Masuk" membuka halaman Masuk dengan alamat kembali ke Checkout Varian ini, jadi Member kembali ke sini setelah
 *   login (PRD §7.5).
 * - "Daftar" membuka halaman Daftar dengan tujuan Checkout Varian ini, jadi Member baru kembali ke sini setelah Kode
 *   verifikasi yang benar dimasukkan (PRD §7.3 ▶ Keputusan 2026-11-22).
 *
 * Tata letaknya mengikuti form checkout (DESIGN.md "Tata letak halaman", pola Dua kolom): Produk di kolom kiri, ajakan
 * di kolom kanan.
 */
export function AjakanProdukGratis({
  varianId,
  namaProduk,
  namaVarian,
}: {
  varianId: string;
  namaProduk: string;
  namaVarian: string;
}) {
  const alamatCheckout = `/checkout?${new URLSearchParams({ varianId })}`;
  const alamatMasuk = `/masuk?${new URLSearchParams({ [PARAMETER_ALAMAT_KEMBALI]: alamatCheckout })}`;
  const alamatDaftar = denganTujuan("/daftar", alamatCheckout);

  return (
    <div className="tata-dua-kolom mt-6">
      <p className={cn(PANEL, "-rotate-[0.6deg] [overflow-wrap:anywhere]")}>
        <span className="font-spidol text-[20px] font-bold">{namaProduk}</span>{" "}
        <span className="text-pensil-redup">· {namaVarian}</span>
      </p>
      <p className={cn(PANEL, "text-[18px]")}>
        Produk gratis khusus Member.{" "}
        <Link href={alamatMasuk} className={KELAS_TAUTAN}>
          Masuk
        </Link>{" "}
        atau{" "}
        <Link href={alamatDaftar} className={KELAS_TAUTAN}>
          Daftar
        </Link>{" "}
        dulu.
      </p>
    </div>
  );
}
