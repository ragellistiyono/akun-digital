import { ChevronLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { RiwayatSaldo } from "@/components/riwayat-saldo";
import { rupiah } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { riwayatPesananMember } from "@/server/riwayat-pesanan";
import { bacaSaldoMember, riwayatSaldoMember } from "@/server/saldo";

import { PilAktif } from "../../_components/pil";
import { TabelPesanan } from "../../pesanan/_components/tabel-pesanan";
import { UbahSaldo } from "./_components/ubah-saldo";

/** Id Member dari alamat. */
const IdDariAlamat = z.string().min(1);

/** Halaman Riwayat saldo dari alamat. Halaman yang kosong atau tidak sah dibaca sebagai halaman pertama. */
const HalamanDariAlamat = z.object({
  halaman: z.coerce.number().int().min(1).catch(1),
});

// Halaman Member di dasbor admin, yang dibuka dengan mengetuk email Member di daftar Member (PRD §2.3 ▶ Keputusan
// 2026-11-17, §15.6). Judulnya tetap "Riwayat Pesanan" dengan email Member beserta pil Aktif atau Nonaktif. Di
// bawahnya Saldo dengan tombol "Tambah saldo" dan "Kurangi saldo" untuk Member aktif maupun nonaktif, lalu Riwayat
// saldo (PRD §15.2) dengan baris terbaru di atas dan 50 baris per halaman, lalu Riwayat Pesanan: Pesanan yang sama
// dengan Riwayat Pesanan Member itu di toko (PRD §7.4), apa pun statusnya, terbaru di atas, dengan kolom daftar
// Pesanan admin (PRD §9.5). Nomor Pesanan setiap baris membuka detail Pesanan di dasbor admin. Halaman ini halaman
// daftar, jadi kepala dan tabelnya memakai lebar penuh isi dasbor (DESIGN.md Tata letak halaman, Dasbor admin).
export default async function HalamanMember({
  params,
  searchParams,
}: PageProps<"/admin/member/[id]">) {
  await wajibSesiAdmin(await headers());

  const id = IdDariAlamat.safeParse((await params).id);
  const { halaman } = HalamanDariAlamat.parse(await searchParams);
  const [riwayat, saldo] = id.success
    ? await Promise.all([
        riwayatPesananMember(id.data),
        bacaSaldoMember(id.data),
      ])
    : [null, null];
  if (!id.success || !riwayat || !saldo) notFound();
  const { member, pesanan } = riwayat;
  const riwayatSaldo = await riwayatSaldoMember({
    idMember: member.id,
    halaman,
  });
  const alamat = `/admin/member/${member.id}`;

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

      <section aria-label="Saldo" className="kartu flex flex-col gap-4 p-4">
        <div>
          <p className="text-[16px] text-pensil-redup">Saldo</p>
          <p className="font-spidol text-[28px] leading-snug font-bold tabular-nums">
            {rupiah(saldo.saldo)}
          </p>
        </div>
        <UbahSaldo idMember={member.id} />
      </section>

      <section aria-labelledby="judul-riwayat-saldo" className="mt-8">
        <h2 id="judul-riwayat-saldo" className="mb-4 text-[26px]">
          Riwayat saldo
        </h2>
        <RiwayatSaldo
          riwayat={riwayatSaldo}
          judul={`Riwayat saldo ${member.email}`}
          alamatHalaman={(nomor) =>
            nomor > 1 ? `${alamat}?halaman=${nomor}` : alamat
          }
        />
      </section>

      <section aria-labelledby="judul-pesanan-member" className="mt-8">
        <h2 id="judul-pesanan-member" className="mb-4 text-[26px]">
          Pesanan
        </h2>
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
      </section>
    </>
  );
}
