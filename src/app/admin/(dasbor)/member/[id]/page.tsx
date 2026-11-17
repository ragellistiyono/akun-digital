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
// hanya untuk melihat; data Member selain status tidak diubah di sini.
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
        className="inline-flex h-10 items-center gap-1 rounded-[12px] pr-3 text-sm font-bold text-aksi-teks hover:bg-permukaan-2"
      >
        <ChevronLeft aria-hidden="true" className="size-6 shrink-0" />
        Member
      </Link>
      <h1 className="mt-2">Riwayat Pesanan</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="font-bold [overflow-wrap:anywhere]">{member.email}</p>
        <PilAktif aktif={!member.nonaktif} />
      </div>

      {pesanan.length === 0 ? (
        <p className="mt-6 max-w-[65ch] text-tinta-redup">
          Belum ada Pesanan dengan email ini.
        </p>
      ) : (
        <>
          <p className="mt-6 text-[13px] font-bold text-tinta-redup">
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
