import { Ticket } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { PilStatusPesanan } from "@/components/pil-status-pesanan";
import { rupiah } from "@/lib/rupiah";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { riwayatPesanan } from "@/server/riwayat-pesanan";
import { waktuWib } from "@/server/zona-waktu-toko";

// Tab Riwayat (PRD §11.1). Member yang login melihat Riwayat Pesanan-nya (PRD §7.4, T45). Tamu melihat isi
// sebelum M2: hanya penjelasan Tautan Pesanan, tanpa ajakan login (PRD §11.1 ▶ Keputusan 2026-11-11). Ajakan
// login untuk Tamu baru dipasang di T51.
export default async function HalamanRiwayat() {
  const sesiMember = await bacaSesiMember(await headers());

  return (
    <>
      <h1 className="mt-4">Riwayat Pesanan</h1>
      {sesiMember ? (
        <RiwayatPesananMember emailMember={sesiMember.user.email} />
      ) : (
        <PenjelasanTautanPesanan />
      )}
    </>
  );
}

// Kartu Baris Riwayat (DESIGN.md Status Pesanan) yang terangkat 2 px dengan Bayang naik saat di-hover, sama
// seperti kartu Produk. Varian hover Tailwind 4 hanya berlaku di perangkat hover:hover, dan transisinya
// dimatikan saat gerak dikurangi (DESIGN.md Elevation & Depth).
const KELAS_BARIS_RIWAYAT =
  "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-[20px] bg-permukaan p-4 shadow-bayang transition-[translate,box-shadow] duration-200 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5 hover:shadow-bayang-naik motion-reduce:transition-none";

/**
 * Riwayat Pesanan Member (PRD §7.4), terbaru di atas. Setiap baris adalah kartu Baris Riwayat (DESIGN.md
 * Status Pesanan) yang membuka Halaman Pesanan lewat Tautan Pesanan-nya (PRD §7.4 ▶ Keputusan 2026-11-17).
 */
async function RiwayatPesananMember({ emailMember }: { emailMember: string }) {
  const riwayat = await riwayatPesanan(emailMember);

  if (riwayat.length === 0) {
    return (
      <p className="mt-4 text-[15px] leading-[1.6] text-tinta-redup">
        Belum ada Pesanan dengan email ini.
      </p>
    );
  }

  return (
    <ul aria-label="Riwayat Pesanan" className="mt-6 grid max-w-[720px] gap-4">
      {riwayat.map((satu) => (
        <li key={satu.nomorPesanan}>
          <Link
            href={`/pesanan/${satu.tautan}`}
            className={KELAS_BARIS_RIWAYAT}
          >
            <span className="justify-self-start">
              <PilStatusPesanan status={satu.status} />
            </span>
            <span className="text-right font-extrabold tabular-nums">
              {rupiah(satu.totalBayar)}
            </span>
            <span className="col-span-full font-extrabold [overflow-wrap:anywhere]">
              {satu.namaProduk} · {satu.namaVarian}
            </span>
            <span className="col-span-full text-[13px] font-bold text-tinta-redup">
              <span className="font-mono">{satu.nomorPesanan}</span>
              {satu.waktuDibuat && <> · {waktuWib(satu.waktuDibuat)} WIB</>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Isi tab Riwayat untuk Tamu: penjelasan Tautan Pesanan di email "Pesanan selesai". */
function PenjelasanTautanPesanan() {
  return (
    <div className="mt-4 grid gap-6 lebar:grid-cols-2 lebar:gap-8">
      <section className="flex items-start gap-3 rounded-[20px] bg-permukaan p-4 shadow-bayang">
        <Ticket
          aria-hidden="true"
          className="size-6 shrink-0 text-st-selesai"
        />
        <p className="max-w-[65ch] text-[15px] leading-[1.6]">
          Setiap Pesanan Selesai punya Tautan Pesanan di email &quot;Pesanan
          selesai&quot;. Buka tautan itu untuk melihat dan menyalin Item stok
          tanpa login.
        </p>
      </section>
    </div>
  );
}
