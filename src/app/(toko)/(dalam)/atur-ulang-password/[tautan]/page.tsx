import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { bacaTautanAturUlangPassword } from "@/server/auth/atur-ulang-password";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";

import { PesanGalat } from "../../../../_masuk/form-masuk";
import { TombolWhatsApp } from "../../../_components/tombol-whatsapp";
import { FormAturUlangPassword } from "./_components/form-atur-ulang-password";
import {
  PESAN_TAUTAN_TIDAK_BERLAKU,
  TautanAturUlang,
} from "./tautan-atur-ulang";

// Tautan atur ulang password bersifat rahasia: alamatnya tidak dikirim ke situs lain lewat Referer, dan
// halamannya tidak diindeks mesin pencari.
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// Halaman di Tautan atur ulang password (PRD §7.5 ▶ Keputusan 2026-11-17). Tautan yang masih berlaku
// menampilkan form password baru. Tautan yang tidak berlaku lagi ditolak dengan pesan menurut alasannya:
// kedaluwarsa, sudah dipakai, atau diganti tautan yang lebih baru. Tautan milik Member nonaktif menampilkan
// pesan nonaktif beserta tombol WhatsApp dari Pengaturan toko; tanpa nomor WhatsApp, hanya pesannya yang
// tampil. Alamat yang tidak dikenal menampilkan halaman tidak ditemukan. Tata letak Fokus (DESIGN.md Tata
// letak halaman): kolom 560 px di tengah.
export default async function HalamanAturUlangPassword({
  params,
}: PageProps<"/atur-ulang-password/[tautan]">) {
  // Keadaan tautan dibaca setiap kali halaman dibuka, bukan sekali saat build.
  await connection();
  const tautan = TautanAturUlang.safeParse((await params).tautan);
  if (!tautan.success) notFound();
  const keadaan = await bacaTautanAturUlangPassword(tautan.data);
  if (keadaan.keadaan === "tidak-dikenal") notFound();
  const memberNonaktif =
    keadaan.keadaan === "tidak-berlaku" && keadaan.alasan === "member-nonaktif";
  const nomorWhatsapp = memberNonaktif
    ? (await bacaPengaturanToko()).nomorWhatsapp
    : null;

  return (
    <div className="tata-fokus">
      <h1 className="mt-4">Atur ulang password</h1>
      {keadaan.keadaan === "berlaku" ? (
        <>
          <p className="mt-2 text-pensil-redup">
            Buat password baru untuk akun Member Anda.
          </p>
          <FormAturUlangPassword tautan={tautan.data} />
        </>
      ) : (
        <section className="kartu paku relative mt-6 flex flex-col gap-4 p-5">
          <PesanGalat id="tautan-galat" peran="alert">
            {PESAN_TAUTAN_TIDAK_BERLAKU[keadaan.alasan]}
          </PesanGalat>
          {memberNonaktif ? (
            <TombolWhatsApp nomor={nomorWhatsapp}>
              Hubungi kami di WhatsApp
            </TombolWhatsApp>
          ) : (
            <Link href="/lupa-password" className="tombol w-full">
              Minta tautan baru
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
