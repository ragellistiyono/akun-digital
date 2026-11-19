import { Download } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { PilStatusPesanan } from "@/components/pil-status-pesanan";
import type { AjakanHalamanPesanan } from "@/domain/ajakan-halaman-pesanan";
import { labelPotonganVoucher } from "@/domain/label-potongan-voucher";
import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import { bacaAjakanHalamanPesanan } from "@/server/ajakan-halaman-pesanan";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { cekStatusPembayaran } from "@/server/kabar-pembayaran";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { bacaPesananLewatTautan, TautanPesanan } from "@/server/pesanan";

import { BilahLekat } from "../../../_components/bilah-lekat";
import { RincianNominal } from "../../../_components/rincian-nominal";
import { TombolWhatsApp } from "../../../_components/tombol-whatsapp";
import { BlokItemStok } from "./_components/blok-item-stok";
import { FormBatalkan } from "./_components/form-batalkan";
import { HapusTandaSudahDibayar } from "./_components/hapus-tanda-sudah-dibayar";
import { KartuSenja } from "./_components/kartu-senja";
import { PanelBuatAkun } from "./_components/panel-buat-akun";
import { PantauStatusPesanan } from "./_components/pantau-status";
import { TANDA_SUDAH_DIBAYAR } from "./_components/tanda-sudah-dibayar";

/** Panel (DESIGN.md "Cards / Containers"): padding 16 px, dan 24 px di layar lebar yang kolomnya lebih lapang. */
const PANEL = "kartu p-4 lebar:p-6";

/** Label kecil di atas Nomor Pesanan. */
const KELAS_LABEL_NOMOR = "text-[16px] text-pensil-redup";

// Tautan Pesanan bersifat rahasia (PRD §6.2): alamatnya tidak dikirim ke situs lain lewat Referer, dan
// halamannya tidak diindeks mesin pencari.
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type PesananDibaca = NonNullable<
  Awaited<ReturnType<typeof bacaPesananLewatTautan>>
>;

/**
 * Rincian nominal yang dicatat di Pesanan (PRD §5.5). Pesanan yang memakai Voucher menulis kode Voucher-nya di
 * baris potongan, misalnya "Potongan voucher (HEMAT5)"; Pesanan tanpa Voucher menulis "Potongan voucher"
 * (PRD §8.8 ▶ Keputusan 2026-11-17).
 */
function PanelRincian({
  rincian,
  className,
}: {
  rincian: PesananDibaca["rincian"];
  className?: string;
}) {
  return (
    <section aria-label="Rincian pembayaran" className={cn(PANEL, className)}>
      <RincianNominal
        baris={[
          { label: "Harga jual", nilai: rupiah(rincian.hargaJual) },
          {
            label: labelPotonganVoucher(rincian.kodeVoucher),
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
      <span className="font-spidol text-[20px] font-bold">
        {pesanan.namaProduk}
      </span>{" "}
      <span className="text-pensil-redup">· {pesanan.namaVarian}</span>
    </p>
  );
}

/**
 * Yang tampil di bawah Item stok Halaman Pesanan Selesai menurut ajakannya (PRD §7.1 ▶ Keputusan
 * 2026-11-17): panel ajakan buat akun, tautan "Login untuk melihat riwayat" ke halaman Masuk, tautan
 * "Lihat Riwayat Pesanan" ke tab Riwayat, atau tidak ada apa pun.
 */
function AjakanDiBawahItemStok({
  ajakan,
  emailPesanan,
  tautan,
}: {
  ajakan: AjakanHalamanPesanan;
  emailPesanan: string;
  tautan: string;
}) {
  if (ajakan === "buat-akun") {
    return <PanelBuatAkun tautan={tautan} emailPesanan={emailPesanan} />;
  }
  if (ajakan === "login") {
    return (
      <Link href="/masuk" className="tombol tombol-kedua">
        Login untuk melihat riwayat
      </Link>
    );
  }
  if (ajakan === "lihat-riwayat") {
    return (
      <Link href="/riwayat" className="tombol tombol-kedua">
        Lihat Riwayat Pesanan
      </Link>
    );
  }
  return null;
}

// Halaman bayar (PRD §5.6) selama Pesanan Menunggu Pembayaran: kartu senja dengan hitung mundur QRIS dan
// Total bayar, gambar QR, lalu Nomor Pesanan dalam huruf mono dengan pil status, rincian nominal yang
// dicatat di Pesanan (PRD §5.5), dan tombol "Batalkan" (PRD §5.8) serta "Simpan gambar QR" di bilah lekat.
// Gambar QR adalah benda utama halaman ini, jadi ia tampil besar di tengah kartunya (DESIGN.md "Tata letak
// halaman", Halaman bayar): 240 px di ponsel dan 288 px di layar lebar. Di layar lebar halaman menjadi dua
// kolom: kartu QR lekat di kiri, lalu kartu senja dan ringkasan Pesanan bertumpuk di kanan. Urutan
// isinya di halaman tetap kartu senja, QR, lalu ringkasan, jadi di ponsel dan bagi pembaca layar urutannya
// sama. Halaman bayar menanyakan status ke server toko secara berkala, dan begitu statusnya berubah,
// halaman dibuat ulang tanpa dimuat ulang menjadi Halaman Pesanan.
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
      <div className="mt-6 grid items-start gap-8 lebar:grid-cols-2 lebar:gap-x-12 lebar:gap-y-6 lebar:[grid-template-areas:'qr_senja'_'qr_ringkasan']">
        <div className="min-w-0 lebar:[grid-area:senja]">
          <KartuSenja
            kedaluwarsaPada={pesanan.kedaluwarsaPada.getTime()}
            sekarang={pesanan.dibacaPada.getTime()}
            totalBayar={rupiah(pesanan.rincian.totalBayar)}
          />
        </div>

        {/* Kartu QR berselotip, selebar kolom, dengan QR di tengahnya. Gambar QR-nya sendiri tidak diberi tepi
            coretan maupun diputar, dan selalu duduk di alas putih, juga di mode gelap, supaya pola dan zona
            tenangnya tetap terbaca pemindai. Jarak 32 px di ponsel memberi ruang bagi selotip yang menonjol
            12 px di atas kartu. Di layar lebar kartu ini lekat di bawah bilah atas, sejajar dengan kartu senja,
            jadi QR tetap terlihat saat ringkasan di kanan digulir. */}
        <div className="min-w-0 lebar:sticky lebar:top-24 lebar:[grid-area:qr]">
          <div className="kartu kartu-tegas selotip relative flex items-center justify-center p-6 lebar:p-8">
            <div className="bg-white p-3">
              <Image
                unoptimized
                src={pesanan.gambarQr}
                alt={`QRIS Pesanan ${pesanan.nomorPesanan}`}
                width={288}
                height={288}
                className="block aspect-square w-60 max-w-full [image-rendering:pixelated] lebar:w-72"
              />
            </div>
          </div>
          <PantauStatusPesanan tautan={tautan} status={pesanan.status} />
        </div>

        {/* Ringkasan Pesanan: antarpanel 16 px, dan tombolnya 24 px di bawah rincian (bilah lekat menjadi blok
            biasa dengan jarak atas 24 px di layar lebar). */}
        <div className="min-w-0 lebar:[grid-area:ringkasan]">
          <section aria-label="Pesanan" className={PANEL}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={KELAS_LABEL_NOMOR}>Nomor Pesanan</p>
                <p className="font-mono text-xl font-bold tracking-[0.01em]">
                  {pesanan.nomorPesanan}
                </p>
              </div>
              <PilStatusPesanan status={pesanan.status} />
            </div>
            <ProdukDanVarian pesanan={pesanan} />
          </section>
          <PanelRincian rincian={pesanan.rincian} className="mt-4" />
          <FormBatalkan tautan={tautan}>
            {/* Gambar QR Pesanan ini diunduh sebagai PNG, supaya Pembeli di ponsel bisa membukanya dari
                aplikasi e-wallet (PRD §5.6). */}
            <a
              href={pesanan.gambarQr}
              download={`QRIS-${pesanan.nomorPesanan}.png`}
              // Padding samping 16 px dan, di layar sempit, huruf 18 px, supaya "Batalkan" dan tombol ini muat
              // berdampingan di lebar 360 px tanpa terpotong.
              className="tombol px-4 whitespace-nowrap max-[399px]:text-lg"
            >
              <Download
                aria-hidden="true"
                strokeWidth={2.5}
                className="size-5 shrink-0"
              />
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
// dibayar, atau yang mendapati Pesanan sudah Selesai, Halaman Pesanan Selesai menjelaskan kenapa Pesanan
// tidak dibatalkan (PRD §5.8, ▶ Keputusan 2026-11-12 #87 dan #99), di panel tepat di bawah Produk dan
// Varian. Di bawah Item stok Pesanan Selesai tampil ajakan menurut siapa yang membukanya (PRD §7.1).
//
// Tata letak (DESIGN.md "Tata letak halaman", pola Dua kolom). Bila Pesanan punya isi sendiri, yaitu Item
// stok, ajakan, atau panel keterangan, kepala Pesanan berada di atas kedua kolom, sehingga isi itu di kolom
// kiri dan rincian di kolom kanan mulai sejajar. Bila tidak, misalnya Pesanan Kedaluwarsa, kepala Pesanan
// sendiri menjadi kolom kiri di samping rinciannya. Urutan isinya di halaman tetap sama, dan di ponsel
// semuanya satu kolom. Di layar lebar kolom rincian lekat di bawah bilah atas.
function HalamanPesanan({
  pesanan,
  tautan,
  ajakan,
  nomorWhatsapp,
  setelahPembatalanSudahDibayar,
}: {
  pesanan: PesananDibaca;
  tautan: string;
  ajakan: { ajakan: AjakanHalamanPesanan; emailPesanan: string } | null;
  nomorWhatsapp: string | null;
  setelahPembatalanSudahDibayar: boolean;
}) {
  const { status } = pesanan;
  const panelSudahDibayar =
    status === "Selesai" && setelahPembatalanSudahDibayar;
  const adaIsiPesanan =
    panelSudahDibayar ||
    Boolean(pesanan.itemStok) ||
    (ajakan !== null && ajakan.ajakan !== "tidak-ada") ||
    status === "Bermasalah";

  // Di layar lebar pil status berada di samping Nomor Pesanan, supaya kepalanya ringkas.
  const kepala = (
    <div className="min-w-0">
      <p className={KELAS_LABEL_NOMOR}>Nomor Pesanan</p>
      <div className="mt-2 lebar:flex lebar:flex-wrap lebar:items-center lebar:gap-x-4 lebar:gap-y-3">
        <p className="min-w-0 font-mono text-[30px] leading-[1.1] font-bold tracking-[0.01em] [overflow-wrap:anywhere]">
          {pesanan.nomorPesanan}
        </p>
        <div className="mt-3 lebar:mt-0">
          <PilStatusPesanan status={status} />
        </div>
      </div>
      <ProdukDanVarian pesanan={pesanan} />
    </div>
  );

  const isiPesanan = (
    <div className="flex min-w-0 flex-col gap-6">
      {panelSudahDibayar && (
        <div role="status" className={PANEL}>
          <p className="max-w-[65ch]">
            Pembayaran Anda sudah masuk, jadi Pesanan tidak dibatalkan.
          </p>
        </div>
      )}
      {pesanan.itemStok && <BlokItemStok kolom={pesanan.itemStok} />}
      {ajakan && (
        <AjakanDiBawahItemStok
          ajakan={ajakan.ajakan}
          emailPesanan={ajakan.emailPesanan}
          tautan={tautan}
        />
      )}
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
  );

  return (
    <>
      <h1 className="mt-4">Pesanan</h1>
      {adaIsiPesanan && <div className="mt-6">{kepala}</div>}
      <div className={cn("tata-dua-kolom mt-6", adaIsiPesanan && "lebar:mt-8")}>
        {adaIsiPesanan ? isiPesanan : kepala}

        <div className="min-w-0 lebar:sticky lebar:top-24">
          <PanelRincian rincian={pesanan.rincian} />
          {(status === "Kedaluwarsa" || status === "Dibatalkan") && (
            <BilahLekat>
              <Link href={`/produk/${pesanan.produkId}`} className="tombol">
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
// sudah dibayar di alamat hanya dipasang tombol "Batalkan" (issue T20-b dan T20-c), dan dihapus dari
// alamat begitu halamannya tampil.
export default async function HalamanTautanPesanan({
  params,
  searchParams,
}: PageProps<"/pesanan/[tautan]">) {
  // Status Pesanan dibaca setiap kali halaman dibuka, bukan sekali saat build.
  await connection();
  const tautan = TautanPesanan.safeParse((await params).tautan);
  if (!tautan.success) notFound();
  const setelahPembatalanSudahDibayar = z
    .literal(TANDA_SUDAH_DIBAYAR.nilai)
    .safeParse((await searchParams)[TANDA_SUDAH_DIBAYAR.nama]).success;

  // Jalur cek status (ADR-0004): kabar pembayaran dari Qrispy diproses sebelum Pesanan dibaca.
  await cekStatusPembayaran(tautan.data);
  const pesanan = await bacaPesananLewatTautan(tautan.data);
  if (!pesanan) notFound();

  // Nomor WhatsApp hanya dibutuhkan Pesanan Bermasalah, dan dibaca setiap kali halaman dibuka.
  const nomorWhatsapp =
    pesanan.status === "Bermasalah"
      ? (await bacaPengaturanToko()).nomorWhatsapp
      : null;
  // Ajakan buat akun atau login hanya dibaca untuk Halaman Pesanan (PRD §7.1), bukan Halaman bayar.
  const ajakan =
    pesanan.status === "Menunggu Pembayaran"
      ? null
      : await bacaAjakanHalamanPesanan({
          tautan: tautan.data,
          emailMemberLogin:
            (await bacaSesiMember(await headers()))?.user.email ?? null,
        });
  return (
    <>
      {setelahPembatalanSudahDibayar && <HapusTandaSudahDibayar />}
      {pesanan.status === "Menunggu Pembayaran" ? (
        <HalamanBayar pesanan={pesanan} tautan={tautan.data} />
      ) : (
        <HalamanPesanan
          pesanan={pesanan}
          tautan={tautan.data}
          ajakan={ajakan}
          nomorWhatsapp={nomorWhatsapp}
          setelahPembatalanSudahDibayar={setelahPembatalanSudahDibayar}
        />
      )}
    </>
  );
}
