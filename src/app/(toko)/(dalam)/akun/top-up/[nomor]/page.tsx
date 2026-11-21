import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { PilStatusPesanan } from "@/components/pil-status-pesanan";
import { nomorTopUpSah } from "@/domain/nomor-top-up";
import { STATUS_TOP_UP } from "@/domain/status-top-up";
import { rupiah } from "@/lib/rupiah";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { cekStatusPembayaranTopUp } from "@/server/kabar-pembayaran-top-up";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { bacaTopUpMember } from "@/server/top-up";

import { RincianNominal } from "../../../../_components/rincian-nominal";
import { TombolWhatsApp } from "../../../../_components/tombol-whatsapp";
import { PARAMETER_ALAMAT_KEMBALI } from "../../../masuk/alamat-kembali";
import { FormBatalkan } from "../../../pesanan/[tautan]/_components/form-batalkan";
import {
  KerangkaHalamanBayar,
  TombolSimpanQr,
} from "../../../pesanan/[tautan]/_components/kerangka-halaman-bayar";
import { PantauStatus } from "../../../pesanan/[tautan]/_components/pantau-status";
import { aksiBatalkanTopUp } from "./aksi";

/** Panel (DESIGN.md "Cards / Containers"), sama seperti di Halaman bayar Pesanan. */
const PANEL = "kartu p-4 lebar:p-6";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type TopUpDibaca = NonNullable<Awaited<ReturnType<typeof bacaTopUpMember>>>;

/** Rincian Nominal top up, Kode unik, dan Total bayar Top up itu (PRD §15.3). */
function PanelRincian({
  rincian,
  className = "",
}: {
  rincian: TopUpDibaca["rincian"];
  className?: string;
}) {
  return (
    <section
      aria-label="Rincian pembayaran"
      className={`${PANEL} ${className}`}
    >
      <RincianNominal
        baris={[
          { label: "Nominal top up", nilai: rupiah(rincian.nominalTopUp) },
          { label: "Kode unik", nilai: rupiah(rincian.kodeUnik) },
        ]}
        total={{ label: "Total bayar", nilai: rupiah(rincian.totalBayar) }}
      />
    </section>
  );
}

// Halaman Top up Bermasalah (PRD §15.4, §15.5), mengikuti pola Halaman Pesanan Bermasalah (PRD §6.2 ▶ Keputusan
// 2026-11-12 #87): Nomor Top up dengan pil status, kalimat bahwa pembayaran sudah diterima tetapi saldo belum
// bertambah, tombol WhatsApp, lalu rincian Top up di kolom kedua.
function HalamanTopUpBermasalah({
  topUp,
  nomorWhatsapp,
}: {
  topUp: TopUpDibaca;
  nomorWhatsapp: string | null;
}) {
  return (
    <>
      <h1 className="mt-4">Top up</h1>
      <div className="mt-6 min-w-0">
        <p className="text-[16px] text-pensil-redup">Nomor Top up</p>
        <div className="mt-2 lebar:flex lebar:flex-wrap lebar:items-center lebar:gap-x-4 lebar:gap-y-3">
          <p className="min-w-0 font-mono text-[30px] leading-[1.1] font-bold tracking-[0.01em] [overflow-wrap:anywhere]">
            {topUp.nomorTopUp}
          </p>
          <div className="mt-3 lebar:mt-0">
            <PilStatusPesanan status="Bermasalah" />
          </div>
        </div>
      </div>
      <div className="tata-dua-kolom mt-6 lebar:mt-8">
        <div className={`flex min-w-0 flex-col items-start gap-4 ${PANEL}`}>
          <p className="max-w-[65ch]">
            Pembayaran Anda sudah kami terima, tetapi saldo belum bertambah.
            Hubungi kami lewat WhatsApp.
          </p>
          <TombolWhatsApp nomor={nomorWhatsapp}>
            Hubungi kami di WhatsApp
          </TombolWhatsApp>
        </div>
        <div className="min-w-0 lebar:sticky lebar:top-24">
          <PanelRincian rincian={topUp.rincian} />
        </div>
      </div>
    </>
  );
}

// Halaman bayar Top up (PRD §15.3), sama dengan Halaman bayar Pesanan (PRD §5.6): kartu senja dengan hitung mundur dan
// Total bayar, gambar QR, lalu Nomor Top up, rincian Nominal top up, Kode unik, dan Total bayar, serta "Batalkan" dan
// "Simpan gambar QR" di bilah lekat. Hanya Member pemilik Top up yang bisa membukanya: Tamu diarahkan ke halaman Masuk
// lalu kembali ke sini, sedangkan Member lain dan Nomor Top up yang tidak dikenal melihat halaman tidak ditemukan.
//
// Jalur cek status (ADR-0004) dijalankan sebelum Top up dibaca, dan halaman menanyakan status ke server toko secara
// berkala. Begitu Top up Berhasil, halaman berpindah sendiri ke Riwayat saldo dengan pesan Top up berhasil, yang
// dipasang jalur status saat menjawab Berhasil (PRD §15.3 ▶ Keputusan 2026-11-21, issue 240). Halaman ini yang dibuka lagi
// untuk Top up yang sudah Berhasil membawa Member ke Riwayat saldo tanpa pesan itu. Top up Bermasalah menampilkan
// Halaman Top up Bermasalah. Top up lain yang sudah tidak Menunggu Pembayaran
// membawa Member ke tab Akun, karena Top up Kedaluwarsa dan Dibatalkan tidak tampil di mana pun bagi Member (PRD
// §15.3).
export default async function HalamanBayarTopUp({
  params,
}: PageProps<"/akun/top-up/[nomor]">) {
  // Status Top up dibaca setiap kali halaman dibuka, bukan sekali saat build.
  await connection();
  const { nomor } = await params;
  const sesiMember = await bacaSesiMember(await headers());
  if (!sesiMember) {
    redirect(
      `/masuk?${new URLSearchParams({ [PARAMETER_ALAMAT_KEMBALI]: `/akun/top-up/${encodeURIComponent(nomor)}` })}`,
    );
  }
  if (!nomorTopUpSah(nomor)) notFound();
  await cekStatusPembayaranTopUp(nomor, sesiMember.user.id);
  const topUp = await bacaTopUpMember({
    nomorTopUp: nomor,
    idMember: sesiMember.user.id,
  });
  if (!topUp) notFound();
  if (topUp.status === "Berhasil") redirect("/akun/riwayat-saldo");
  if (topUp.status === "Bermasalah") {
    return (
      <HalamanTopUpBermasalah
        topUp={topUp}
        nomorWhatsapp={(await bacaPengaturanToko()).nomorWhatsapp}
      />
    );
  }
  if (topUp.status !== "Menunggu Pembayaran") redirect("/akun");

  return (
    <KerangkaHalamanBayar
      kedaluwarsaPada={topUp.kedaluwarsaPada}
      dibacaPada={topUp.dibacaPada}
      totalBayar={rupiah(topUp.rincian.totalBayar)}
      gambarQr={topUp.gambarQr}
      altQr={`QRIS Top up ${topUp.nomorTopUp}`}
      pemantau={
        <PantauStatus
          alamatStatus={`/akun/top-up/${topUp.nomorTopUp}/status`}
          status={topUp.status}
          statusSah={STATUS_TOP_UP}
        />
      }
    >
      <section aria-label="Top up" className={PANEL}>
        <p className="text-[16px] text-pensil-redup">Nomor Top up</p>
        <p className="font-mono text-xl font-bold tracking-[0.01em]">
          {topUp.nomorTopUp}
        </p>
      </section>
      <PanelRincian rincian={topUp.rincian} className="mt-4" />
      <FormBatalkan
        aksiBatalkan={aksiBatalkanTopUp}
        isian={{ nama: "nomorTopUp", nilai: topUp.nomorTopUp }}
      >
        <TombolSimpanQr
          gambarQr={topUp.gambarQr}
          namaBerkas={`QRIS-${topUp.nomorTopUp}.png`}
        />
      </FormBatalkan>
    </KerangkaHalamanBayar>
  );
}
