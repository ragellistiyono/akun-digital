import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { nomorTopUpSah } from "@/domain/nomor-top-up";
import { rupiah } from "@/lib/rupiah";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { bacaTopUpMember } from "@/server/top-up";

import { RincianNominal } from "../../../../_components/rincian-nominal";
import { PARAMETER_ALAMAT_KEMBALI } from "../../../masuk/alamat-kembali";
import { FormBatalkan } from "../../../pesanan/[tautan]/_components/form-batalkan";
import {
  KerangkaHalamanBayar,
  TombolSimpanQr,
} from "../../../pesanan/[tautan]/_components/kerangka-halaman-bayar";
import { aksiBatalkanTopUp } from "./aksi";

/** Panel (DESIGN.md "Cards / Containers"), sama seperti di Halaman bayar Pesanan. */
const PANEL = "kartu p-4 lebar:p-6";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Halaman bayar Top up (PRD §15.3), sama dengan Halaman bayar Pesanan (PRD §5.6): kartu senja dengan hitung mundur dan
// Total bayar, gambar QR, lalu Nomor Top up, rincian Nominal top up, Kode unik, dan Total bayar, serta "Batalkan" dan
// "Simpan gambar QR" di bilah lekat. Hanya Member pemilik Top up yang bisa membukanya: Tamu diarahkan ke halaman Masuk
// lalu kembali ke sini, sedangkan Member lain dan Nomor Top up yang tidak dikenal melihat halaman tidak ditemukan. Top
// up yang sudah tidak Menunggu Pembayaran membawa Member ke tab Akun, karena Top up Kedaluwarsa dan Dibatalkan tidak
// tampil di mana pun bagi Member (PRD §15.3).
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
  const topUp = await bacaTopUpMember({
    nomorTopUp: nomor,
    idMember: sesiMember.user.id,
  });
  if (!topUp) notFound();
  if (topUp.status !== "Menunggu Pembayaran") redirect("/akun");

  const { rincian } = topUp;
  return (
    <KerangkaHalamanBayar
      kedaluwarsaPada={topUp.kedaluwarsaPada}
      dibacaPada={topUp.dibacaPada}
      totalBayar={rupiah(rincian.totalBayar)}
      gambarQr={topUp.gambarQr}
      altQr={`QRIS Top up ${topUp.nomorTopUp}`}
    >
      <section aria-label="Top up" className={PANEL}>
        <p className="text-[16px] text-pensil-redup">Nomor Top up</p>
        <p className="font-mono text-xl font-bold tracking-[0.01em]">
          {topUp.nomorTopUp}
        </p>
      </section>
      <section aria-label="Rincian pembayaran" className={`mt-4 ${PANEL}`}>
        <RincianNominal
          baris={[
            { label: "Nominal top up", nilai: rupiah(rincian.nominalTopUp) },
            { label: "Kode unik", nilai: rupiah(rincian.kodeUnik) },
          ]}
          total={{ label: "Total bayar", nilai: rupiah(rincian.totalBayar) }}
        />
      </section>
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
