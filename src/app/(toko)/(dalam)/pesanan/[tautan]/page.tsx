import { Clock } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { rupiah } from "@/lib/rupiah";
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

/** Pil status Menunggu Pembayaran (DESIGN.md Status Pesanan): warna, ikon Clock, dan label sekaligus. */
function PilMenungguPembayaran() {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-st-tunggu-bg pr-3 pl-2 text-[13px] font-bold whitespace-nowrap text-st-tunggu">
      <Clock aria-hidden="true" className="size-4" strokeWidth={2.4} />
      Menunggu Pembayaran
    </span>
  );
}

// Halaman bayar (PRD §5.6) di Tautan Pesanan, selama Pesanan Menunggu Pembayaran: gambar QR, lalu Nomor
// Pesanan dalam huruf mono dengan pil status, dan rincian nominal yang dicatat di Pesanan (PRD §5.5). Di
// layar lebar keduanya menjadi dua kolom sama lebar (DESIGN.md Layout). Tautan Pesanan yang tidak dikenal
// menampilkan halaman tidak ditemukan.
export default async function HalamanBayar({
  params,
}: PageProps<"/pesanan/[tautan]">) {
  // Status Pesanan dibaca setiap kali halaman dibuka, bukan sekali saat build.
  await connection();
  const tautan = TautanPesanan.safeParse((await params).tautan);
  if (!tautan.success) notFound();

  const pesanan = await bacaPesananLewatTautan(tautan.data);
  // Halaman Pesanan untuk status lain dibangun di tiket berikutnya; saat ini Pesanan hanya bisa
  // Menunggu Pembayaran.
  if (!pesanan || pesanan.status !== "Menunggu Pembayaran") notFound();
  const { rincian } = pesanan;

  return (
    <>
      <h1 className="mt-4">Pembayaran</h1>
      <div className="mt-6 grid gap-6 lebar:grid-cols-2 lebar:items-start lebar:gap-8">
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
              <PilMenungguPembayaran />
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
