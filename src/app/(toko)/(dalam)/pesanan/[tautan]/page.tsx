import {
  Check,
  CircleX,
  Clock,
  Hourglass,
  type LucideIcon,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import type { StatusPesanan } from "@/domain/status-pesanan";
import { rupiah } from "@/lib/rupiah";
import { cekStatusPembayaran } from "@/server/kabar-pembayaran";
import { bacaPesananLewatTautan } from "@/server/pesanan";

import { RincianNominal } from "../../../_components/rincian-nominal";

const PANEL = "rounded-[20px] bg-permukaan p-4 shadow-bayang";

/** Tautan Pesanan berupa 32 byte acak dalam base64url (src/server/pesanan.ts). */
const TautanPesanan = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

// Tautan Pesanan bersifat rahasia (PRD §6.2): alamatnya tidak dikirim ke situs lain lewat Referer, dan
// halamannya tidak diindeks mesin pencari.
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/** Ikon dan warna pil setiap status Pesanan (DESIGN.md Status Pesanan). */
const PIL_STATUS: Record<StatusPesanan, { Ikon: LucideIcon; warna: string }> = {
  "Menunggu Pembayaran": {
    Ikon: Clock,
    warna: "bg-st-tunggu-bg text-st-tunggu",
  },
  Selesai: { Ikon: Check, warna: "bg-st-selesai-bg text-st-selesai" },
  Kedaluwarsa: {
    Ikon: Hourglass,
    warna: "bg-st-kedaluwarsa-bg text-st-kedaluwarsa",
  },
  Dibatalkan: { Ikon: CircleX, warna: "bg-st-batal-bg text-st-batal" },
  Bermasalah: {
    Ikon: TriangleAlert,
    warna: "bg-st-masalah-bg text-st-masalah",
  },
  "Dana Dikembalikan": {
    Ikon: RotateCcw,
    warna: "bg-st-kembali-bg text-st-kembali",
  },
};

/** Pil status Pesanan (DESIGN.md Status Pesanan): warna, ikon, dan label sekaligus. */
function PilStatusPesanan({ status }: { status: StatusPesanan }) {
  const { Ikon, warna } = PIL_STATUS[status];
  return (
    <span
      className={`inline-flex h-7 items-center gap-1 rounded-full pr-3 pl-2 text-[13px] font-bold whitespace-nowrap ${warna}`}
    >
      <Ikon aria-hidden="true" className="size-4" strokeWidth={2.4} />
      {status}
    </span>
  );
}

// Halaman di Tautan Pesanan. Selama Pesanan Menunggu Pembayaran, halaman ini adalah Halaman bayar (PRD
// §5.6): gambar QR, lalu Nomor Pesanan dalam huruf mono dengan pil status, dan rincian nominal yang
// dicatat di Pesanan (PRD §5.5). Di layar lebar keduanya menjadi dua kolom sama lebar (DESIGN.md Layout).
// Untuk status lain, pil menampilkan status terkini tanpa gambar QR; tampilan lengkapnya dibangun di
// tiket Halaman Pesanan. Tautan Pesanan yang tidak dikenal menampilkan halaman tidak ditemukan.
export default async function HalamanTautanPesanan({
  params,
}: PageProps<"/pesanan/[tautan]">) {
  // Status Pesanan dibaca setiap kali halaman dibuka, bukan sekali saat build.
  await connection();
  const tautan = TautanPesanan.safeParse((await params).tautan);
  if (!tautan.success) notFound();

  // Jalur cek status (ADR-0004): kabar pembayaran dari Qrispy diproses sebelum Pesanan dibaca.
  await cekStatusPembayaran(tautan.data);
  const pesanan = await bacaPesananLewatTautan(tautan.data);
  if (!pesanan) notFound();
  const { rincian } = pesanan;
  const menunggu = pesanan.status === "Menunggu Pembayaran";

  return (
    <>
      <h1 className="mt-4">{menunggu ? "Pembayaran" : "Pesanan"}</h1>
      <div className="mt-6 grid gap-6 lebar:grid-cols-2 lebar:items-start lebar:gap-8">
        {menunggu && (
          <div className="w-fit rounded-[16px] bg-permukaan p-3 shadow-bayang">
            <Image
              unoptimized
              src={pesanan.gambarQr}
              alt={`QRIS Pesanan ${pesanan.nomorPesanan}`}
              width={128}
              height={128}
              className="block size-32"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Pesanan" className={PANEL}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-tinta-redup">
                  Nomor Pesanan
                </p>
                <p className="font-mono text-xl font-bold tracking-[0.01em]">
                  {pesanan.nomorPesanan}
                </p>
              </div>
              <PilStatusPesanan status={pesanan.status} />
            </div>
            <p className="mt-2 [overflow-wrap:anywhere]">
              <span className="font-extrabold">{pesanan.namaProduk}</span>{" "}
              <span className="text-tinta-redup">· {pesanan.namaVarian}</span>
            </p>
          </section>
          <section aria-label="Rincian pembayaran" className={PANEL}>
            <RincianNominal
              baris={[
                { label: "Harga jual", nilai: rupiah(rincian.hargaJual) },
                {
                  label: "Potongan voucher",
                  nilai:
                    rincian.potonganVoucher === 0
                      ? rupiah(0)
                      : `− ${rupiah(rincian.potonganVoucher)}`,
                },
                { label: "Kode unik", nilai: rupiah(rincian.kodeUnik) },
              ]}
              total={{
                label: "Total bayar",
                nilai: rupiah(rincian.totalBayar),
              }}
            />
          </section>
        </div>
      </div>
    </>
  );
}
