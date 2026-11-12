import { Download } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PilStatusPesanan } from "@/components/pil-status-pesanan";
import { rupiah } from "@/lib/rupiah";
import { cekStatusPembayaran } from "@/server/kabar-pembayaran";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { bacaPesananLewatTautan, TautanPesanan } from "@/server/pesanan";

import {
  BilahLekat,
  KELAS_TOMBOL_UTAMA,
} from "../../../_components/bilah-lekat";
import { RincianNominal } from "../../../_components/rincian-nominal";
import { TombolWhatsApp } from "../../../_components/tombol-whatsapp";
import { BlokItemStok } from "./_components/blok-item-stok";
import { FormBatalkan } from "./_components/form-batalkan";
import { HapusTandaSudahDibayar } from "./_components/hapus-tanda-sudah-dibayar";
import { KartuSenja } from "./_components/kartu-senja";
import { PantauStatusPesanan } from "./_components/pantau-status";
import { TANDA_SUDAH_DIBAYAR } from "./_components/tanda-sudah-dibayar";

const PANEL = "rounded-[20px] bg-permukaan p-4 shadow-bayang";

// Tautan Pesanan bersifat rahasia (PRD §6.2): alamatnya tidak dikirim ke situs lain lewat Referer, dan
// halamannya tidak diindeks mesin pencari.
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type PesananDibaca = NonNullable<
  Awaited<ReturnType<typeof bacaPesananLewatTautan>>
>;

/** Rincian nominal yang dicatat di Pesanan (PRD §5.5). */
function PanelRincian({ rincian }: { rincian: PesananDibaca["rincian"] }) {
  return (
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
  );
}

/** Nama Produk dan Varian Pesanan itu. */
function ProdukDanVarian({ pesanan }: { pesanan: PesananDibaca }) {
  return (
    <p className="mt-2 [overflow-wrap:anywhere]">
      <span className="font-extrabold">{pesanan.namaProduk}</span>{" "}
      <span className="text-tinta-redup">· {pesanan.namaVarian}</span>
    </p>
  );
}

// Halaman bayar (PRD §5.6) selama Pesanan Menunggu Pembayaran: kartu senja dengan hitung mundur QRIS dan
// Total bayar, gambar QR, lalu Nomor Pesanan dalam huruf mono dengan pil status, rincian nominal yang
// dicatat di Pesanan (PRD §5.5), dan tombol "Batalkan" (PRD §5.8) serta "Simpan gambar QR" di bilah lekat.
// Di layar lebar keduanya menjadi dua kolom sama lebar (DESIGN.md Layout). Halaman bayar menanyakan status
// ke server toko secara berkala, dan begitu statusnya berubah, halaman dibuat ulang tanpa dimuat ulang
// menjadi Halaman Pesanan.
function HalamanBayar({
  pesanan,
  tautan,
}: {
  pesanan: PesananDibaca;
  tautan: string;
}) {
  return (
    <>
      <h1 className="mt-4">Pembayaran</h1>
      <div className="mt-6 grid gap-6 lebar:grid-cols-2 lebar:items-start lebar:gap-8">
        <div className="flex min-w-0 flex-col gap-4">
          <KartuSenja
            kedaluwarsaPada={pesanan.kedaluwarsaPada.getTime()}
            sekarang={pesanan.dibacaPada.getTime()}
            totalBayar={rupiah(pesanan.rincian.totalBayar)}
          />
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
          <PantauStatusPesanan tautan={tautan} status={pesanan.status} />
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
              <PilStatusPesanan status={pesanan.status} />
            </div>
            <ProdukDanVarian pesanan={pesanan} />
          </section>
          <PanelRincian rincian={pesanan.rincian} />
          <FormBatalkan tautan={tautan}>
            {/* Gambar QR Pesanan ini diunduh sebagai PNG, supaya Pembeli di ponsel bisa membukanya dari
                aplikasi e-wallet (PRD §5.6). */}
            <a
              href={pesanan.gambarQr}
              download={`QRIS-${pesanan.nomorPesanan}.png`}
              className={`${KELAS_TOMBOL_UTAMA} whitespace-nowrap`}
            >
              <Download aria-hidden="true" className="size-6 shrink-0" />
              Simpan gambar QR
            </a>
          </FormBatalkan>
        </div>
      </div>
    </>
  );
}

// Halaman Pesanan untuk setiap status selain Menunggu Pembayaran (PRD §5.7, §6.1, DESIGN.md "Blok Item
// stok dan tombol Salin"): dikepalai label "Nomor Pesanan" dan Nomor Pesanan dalam huruf mono 30 px, lalu
// pil status. Pesanan Selesai menampilkan Item stok dengan tombol Salin di setiap kolom. Pesanan Bermasalah
// menampilkan keterangan dan tombol WhatsApp (PRD §5.9). Pesanan Kedaluwarsa dan Dibatalkan punya tautan
// ke Halaman Produk untuk checkout lagi (PRD §5.8) di bilah lekat. Rincian nominal ada di kolom kedua.
// Tidak ada tombol kirim ulang email (PRD §6.4). Tepat setelah pembatalan yang diproses sebagai sudah
// dibayar, Halaman Pesanan Selesai menjelaskan kenapa Pesanan tidak dibatalkan (PRD §5.8, ▶ Keputusan
// 2026-11-12), di panel tepat di bawah Produk dan Varian.
function HalamanPesanan({
  pesanan,
  nomorWhatsapp,
  setelahPembatalanSudahDibayar,
}: {
  pesanan: PesananDibaca;
  nomorWhatsapp: string | null;
  setelahPembatalanSudahDibayar: boolean;
}) {
  const { status } = pesanan;
  return (
    <>
      <h1 className="mt-4">Pesanan</h1>
      <div className="mt-6 grid gap-6 lebar:grid-cols-2 lebar:items-start lebar:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="min-w-0">
            <p className="text-sm font-bold text-tinta-redup">Nomor Pesanan</p>
            <p className="mt-2 font-mono text-[30px] leading-[1.1] font-bold tracking-[0.01em] [overflow-wrap:anywhere]">
              {pesanan.nomorPesanan}
            </p>
            <div className="mt-3">
              <PilStatusPesanan status={status} />
            </div>
            <ProdukDanVarian pesanan={pesanan} />
          </div>
          {status === "Selesai" && setelahPembatalanSudahDibayar && (
            <div role="status" className={PANEL}>
              <p className="max-w-[65ch]">
                Pembayaran Anda sudah masuk, jadi Pesanan tidak dibatalkan.
              </p>
            </div>
          )}
          {pesanan.itemStok && <BlokItemStok kolom={pesanan.itemStok} />}
          {status === "Bermasalah" && (
            <div className={`flex flex-col items-start gap-4 ${PANEL}`}>
              <p className="max-w-[65ch]">
                Pembayaran Anda sudah kami terima, tetapi Item stok belum bisa
                dikirim. Hubungi kami lewat WhatsApp.
              </p>
              <TombolWhatsApp nomor={nomorWhatsapp}>
                Hubungi kami di WhatsApp
              </TombolWhatsApp>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <PanelRincian rincian={pesanan.rincian} />
          {(status === "Kedaluwarsa" || status === "Dibatalkan") && (
            <BilahLekat>
              <Link
                href={`/produk/${pesanan.produkId}`}
                className={KELAS_TOMBOL_UTAMA}
              >
                Checkout lagi
              </Link>
            </BilahLekat>
          )}
        </div>
      </div>
    </>
  );
}

// Halaman di Tautan Pesanan (PRD §6.2): siapa pun yang memegang Tautan Pesanan bisa membukanya tanpa
// login, dari browser mana pun. Selama Pesanan Menunggu Pembayaran halaman ini adalah Halaman bayar, dan
// untuk status lain halaman ini adalah Halaman Pesanan. Tautan Pesanan yang tidak dikenal, termasuk alamat
// yang bukan berbentuk Tautan Pesanan, menampilkan halaman tidak ditemukan yang sama. Tanda pembatalan
// sudah dibayar di alamat hanya dipasang tombol "Batalkan" (issue T20-b), dan dihapus dari alamat begitu
// halamannya tampil.
export default async function HalamanTautanPesanan({
  params,
  searchParams,
}: PageProps<"/pesanan/[tautan]">) {
  // Status Pesanan dibaca setiap kali halaman dibuka, bukan sekali saat build.
  await connection();
  const tautan = TautanPesanan.safeParse((await params).tautan);
  if (!tautan.success) notFound();
  const setelahPembatalanSudahDibayar =
    (await searchParams)[TANDA_SUDAH_DIBAYAR.nama] ===
    TANDA_SUDAH_DIBAYAR.nilai;

  // Jalur cek status (ADR-0004): kabar pembayaran dari Qrispy diproses sebelum Pesanan dibaca.
  await cekStatusPembayaran(tautan.data);
  const pesanan = await bacaPesananLewatTautan(tautan.data);
  if (!pesanan) notFound();

  // Nomor WhatsApp hanya dibutuhkan Pesanan Bermasalah, dan dibaca setiap kali halaman dibuka.
  const nomorWhatsapp =
    pesanan.status === "Bermasalah"
      ? (await bacaPengaturanToko()).nomorWhatsapp
      : null;
  return (
    <>
      {setelahPembatalanSudahDibayar && <HapusTandaSudahDibayar />}
      {pesanan.status === "Menunggu Pembayaran" ? (
        <HalamanBayar pesanan={pesanan} tautan={tautan.data} />
      ) : (
        <HalamanPesanan
          pesanan={pesanan}
          nomorWhatsapp={nomorWhatsapp}
          setelahPembatalanSudahDibayar={setelahPembatalanSudahDibayar}
        />
      )}
    </>
  );
}
