import { Ticket } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { PilStatusPesanan } from "@/components/pil-status-pesanan";
import { rupiah } from "@/lib/rupiah";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { riwayatPesanan } from "@/server/riwayat-pesanan";
import { waktuWib } from "@/server/zona-waktu-toko";

import { TombolMasukDaftar } from "../../_components/tombol-masuk-daftar";

// Tab Riwayat (PRD §11.1). Member yang login melihat Riwayat Pesanan-nya (PRD §7.4, T45). Tamu melihat ajakan
// login beserta penjelasan Tautan Pesanan (PRD §11.1 ▶ Keputusan 2026-11-17). Tata letaknya (DESIGN.md Tata
// letak halaman): daftar Riwayat Pesanan Member memakai pola Baca, kolom 720 px di tengah; Tamu memakai pola
// Fokus, kolom 560 px di tengah.
export default async function HalamanRiwayat() {
  const sesiMember = await bacaSesiMember(await headers());

  if (!sesiMember) return <RiwayatTamu />;

  return (
    <div className="tata-baca">
      <h1 className="mt-4">Riwayat Pesanan</h1>
      <RiwayatPesananMember emailMember={sesiMember.user.email} />
    </div>
  );
}

// Kartu Baris Riwayat (DESIGN.md Status Pesanan) yang terangkat 2 px dengan bayangan tegas 4 px saat di-hover.
// Varian hover Tailwind 4 hanya berlaku di perangkat hover:hover, dan transisinya dimatikan saat gerak
// dikurangi (DESIGN.md Elevation & Depth). Pil status dan Total bayar berbagi baris pertama; bila keduanya
// tidak muat, misalnya "Menunggu Pembayaran" dengan Total bayar jutaan di lebar 360 px, Total bayar turun ke
// baris berikutnya dan tetap rata kanan.
const KELAS_BARIS_RIWAYAT =
  "kartu flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 transition-[translate,box-shadow] duration-100 ease-out hover:-translate-y-0.5 hover:shadow-coret motion-reduce:transition-none";

/**
 * Riwayat Pesanan Member (PRD §7.4), terbaru di atas. Setiap baris adalah kartu Baris Riwayat (DESIGN.md
 * Status Pesanan) yang membuka Halaman Pesanan lewat Tautan Pesanan-nya (PRD §7.4 ▶ Keputusan 2026-11-17).
 */
async function RiwayatPesananMember({ emailMember }: { emailMember: string }) {
  const riwayat = await riwayatPesanan(emailMember);

  if (riwayat.length === 0) {
    return (
      <p className="mt-6 text-pensil-redup">
        Belum ada Pesanan dengan email ini.
      </p>
    );
  }

  return (
    <ul aria-label="Riwayat Pesanan" className="mt-6 grid gap-4">
      {riwayat.map((satu) => (
        // Baris Riwayat selalu tegak (DESIGN.md Layout, Rotasi), jadi tepinya sejajar dengan judul.
        <li key={satu.nomorPesanan}>
          <Link
            href={`/pesanan/${satu.tautan}`}
            className={KELAS_BARIS_RIWAYAT}
          >
            <span>
              <PilStatusPesanan status={satu.status} />
            </span>
            <span className="ml-auto text-right font-spidol text-[20px] font-bold tabular-nums">
              {rupiah(satu.totalBayar)}
            </span>
            <span className="min-w-0 basis-full leading-snug [overflow-wrap:anywhere]">
              {satu.namaProduk} · {satu.namaVarian}
            </span>
            <span className="min-w-0 basis-full text-[15px] font-bold text-pensil-redup">
              <span className="font-mono text-[13px]">{satu.nomorPesanan}</span>
              {satu.waktuDibuat && <> · {waktuWib(satu.waktuDibuat)} WIB</>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Tab Riwayat untuk Tamu (PRD §11.1 ▶ Keputusan 2026-11-17): judul, ajakan login, tombol "Masuk" dan
 * "Daftar", lalu panel penjelasan Tautan Pesanan di email "Pesanan selesai". Semuanya satu kolom Fokus di
 * tengah, juga di layar lebar (DESIGN.md Tata letak halaman ▶ Keputusan 2026-11-20, yang menggantikan susunan
 * dua kolom ▶ Keputusan 2026-11-11).
 */
function RiwayatTamu() {
  return (
    <div className="tata-fokus">
      <h1 className="mt-4">Riwayat Pesanan</h1>
      <p className="mt-2 text-pensil-redup">
        Masuk sebagai Member untuk melihat semua Pesanan Anda, termasuk yang
        dibuat sebelum mendaftar.
      </p>
      <TombolMasukDaftar className="mt-6" />
      <section
        aria-label="Tautan Pesanan"
        className="kartu mt-6 flex items-start gap-4 p-5"
      >
        {/* Ikon dalam lingkaran coretan (DESIGN.md Iconography). */}
        <span
          aria-hidden="true"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-coret-bulat border-2 border-pensil"
        >
          <Ticket strokeWidth={2.5} className="size-6 text-st-selesai" />
        </span>
        <p className="max-w-[65ch] text-[17px] leading-normal">
          Setiap Pesanan Selesai punya Tautan Pesanan di email &quot;Pesanan
          selesai&quot;. Buka tautan itu untuk melihat dan menyalin Item stok
          tanpa login.
        </p>
      </section>
    </div>
  );
}
