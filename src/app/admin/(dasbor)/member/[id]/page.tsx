import { ChevronLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { riwayatPesananMember } from "@/server/riwayat-pesanan";

import { PilAktif } from "../../_components/pil";
import { TabelPesanan } from "../../pesanan/_components/tabel-pesanan";

/** Id Member dari alamat. */
const IdDariAlamat = z.string().min(1);

// Riwayat Pesanan seorang Member di dasbor admin (PRD §2.3 ▶ Keputusan 2026-11-17): Pesanan yang sama dengan
// Riwayat Pesanan Member itu di toko (PRD §7.4), apa pun statusnya, terbaru di atas, dengan kolom daftar
// Pesanan admin (PRD §9.5). Nomor Pesanan setiap baris membuka detail Pesanan di dasbor admin. Halaman ini
// hanya untuk melihat; data Member selain status tidak diubah di sini. Halaman ini halaman daftar, jadi kepala
// dan tabelnya memakai lebar penuh isi dasbor (DESIGN.md Tata letak halaman, Dasbor admin).
export default async function HalamanRiwayatMember({
  params,
}: PageProps<"/admin/member/[id]">) {
  await wajibSesiAdmin(await headers());

  const id = IdDariAlamat.safeParse((await params).id);
  const riwayat = id.success ? await riwayatPesananMember(id.data) : null;
  if (!riwayat) notFound();
  const { member, pesanan } = riwayat;

  return (
    <>
      <Link
        href="/admin/member"
        className="inline-flex h-10 items-center gap-1 pr-3 text-[17px] text-pulpen decoration-2 underline-offset-4 hover:underline"
      >
        <ChevronLeft
          aria-hidden="true"
          className="size-6 shrink-0"
          strokeWidth={2.5}
        />
        Member
      </Link>
      <div className="kepala-halaman mt-2">
        <div className="min-w-0">
          <h1>Riwayat Pesanan</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-[20px] [overflow-wrap:anywhere]">
              {member.email}
            </p>
            <PilAktif aktif={!member.nonaktif} />
          </div>
        </div>
      </div>

      {pesanan.length === 0 ? (
        <p className="max-w-[65ch] text-pensil-redup">
          Belum ada Pesanan dengan email ini.
        </p>
      ) : (
        <>
          <p className="text-[15px] text-pensil-redup">
            {pesanan.length.toLocaleString("id-ID")} Pesanan
          </p>
          <TabelPesanan
            semuaPesanan={pesanan}
            judul={`Riwayat Pesanan ${member.email}`}
          />
        </>
      )}
    </>
  );
}
