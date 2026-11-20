import { ChevronLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { RincianNominal } from "@/app/(toko)/_components/rincian-nominal";
import { PilStatusTopUp } from "@/components/pil-status-top-up";
import { nomorTopUpSah } from "@/domain/nomor-top-up";
import { penyelesaianTopUpBermasalahTersedia } from "@/domain/penyelesaian-top-up-bermasalah";
import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { bacaDetailTopUp } from "@/server/top-up-admin";
import { waktuWib } from "@/server/zona-waktu-toko";

import { PenyelesaianTopUpBermasalah } from "../_components/penyelesaian-top-up-bermasalah";

const PANEL = "kartu p-4";

const KELAS_JUDUL_PANEL = "text-[26px]";

/** Kepala tabel riwayat: Kalam 16 px (DESIGN.md Typography). */
const KELAS_KEPALA_TABEL = "font-spidol text-base font-bold text-pensil-redup";

/** Pemisah antarbaris: putus-putus pensil 2 px. */
const KELAS_PEMISAH = "border-b-2 border-dashed border-pensil";

/** Nomor Top up dari alamat. Teks yang tidak berbentuk Nomor Top up pasti bukan Top up mana pun. */
const NomorDariAlamat = z.string().refine(nomorTopUpSah);

type DetailTopUp = NonNullable<Awaited<ReturnType<typeof bacaDetailTopUp>>>;

/** Email Member pemilik Top up itu, yang menaut ke halaman Member di dasbor admin (PRD §15.9). */
function PanelTopUp({ member }: { member: DetailTopUp["member"] }) {
  return (
    <section aria-label="Top up" className={PANEL}>
      <dl>
        <dt className="text-base text-pensil-redup">Member</dt>
        <dd className="[overflow-wrap:anywhere]">
          <Link
            href={`/admin/member/${member.id}`}
            className="text-pulpen underline decoration-2 underline-offset-4"
          >
            {member.email}
          </Link>
        </dd>
      </dl>
    </section>
  );
}

/**
 * Rincian Nominal top up, Kode unik, dan Total bayar Top up itu (PRD §15.9), dengan tulisan yang sama seperti di
 * Halaman bayar Top up. Bila Top up sudah dibayar, di bawahnya ada nominal yang diterima dan Biaya transaksi yang
 * dicatat saat pembayarannya masuk (PRD §15.5).
 */
function PanelRincian({
  rincian,
  pembayaran,
}: {
  rincian: DetailTopUp["rincian"];
  pembayaran: DetailTopUp["pembayaran"];
}) {
  return (
    <section aria-label="Rincian pembayaran" className={PANEL}>
      <RincianNominal
        baris={[
          { label: "Nominal top up", nilai: rupiah(rincian.nominalTopUp) },
          { label: "Kode unik", nilai: rupiah(rincian.kodeUnik) },
        ]}
        total={{ label: "Total bayar", nilai: rupiah(rincian.totalBayar) }}
      />
      {pembayaran && (
        <div className="mt-3 border-t-2 border-dashed border-pensil pt-2">
          <table className="w-full border-collapse text-[17px] leading-[1.3]">
            <tbody>
              {[
                {
                  label: "Nominal diterima",
                  nilai: rupiah(pembayaran.nominalDiterima),
                },
                {
                  label: "Biaya transaksi",
                  nilai: rupiah(pembayaran.biayaTransaksi),
                },
              ].map(({ label, nilai }) => (
                <tr key={label}>
                  <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                    {label}
                  </th>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    {nilai}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Riwayat perubahan status Top up itu, dari yang paling lama: waktu dalam WIB (PRD §9.1), pil status, dan pelakunya
 * (PRD §15.4). Tabelnya bergulir ke samping di dalam panelnya sendiri pada layar sempit (PRD §11.1).
 */
function PanelRiwayat({ riwayat }: { riwayat: DetailTopUp["riwayat"] }) {
  return (
    <section aria-labelledby="judul-riwayat" className={PANEL}>
      <h2 id="judul-riwayat" className={KELAS_JUDUL_PANEL}>
        Riwayat perubahan status
      </h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[400px] text-left">
          <caption className="sr-only">Riwayat perubahan status</caption>
          <thead className={KELAS_KEPALA_TABEL}>
            <tr className={KELAS_PEMISAH}>
              <th scope="col" className="py-2 pr-4">
                Waktu (WIB)
              </th>
              <th scope="col" className="py-2 pr-4">
                Status
              </th>
              <th scope="col" className="py-2">
                Pelaku
              </th>
            </tr>
          </thead>
          <tbody>
            {riwayat.map(({ waktu, status, pelaku }, urutan) => (
              <tr
                key={urutan}
                className={`${KELAS_PEMISAH} align-top last:border-b-0`}
              >
                <td className="py-3 pr-4 whitespace-nowrap">
                  {waktuWib(waktu)}
                </td>
                <td className="py-3 pr-4">
                  <PilStatusTopUp status={status} />
                </td>
                <td className="py-3">{pelaku}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Detail Top up di dasbor admin (PRD §15.9): Nomor Top up dalam huruf mono dengan pil status, Member pemiliknya yang
// menaut ke halaman Member, rincian Nominal top up, Kode unik, dan Total bayar, nominal diterima dan Biaya transaksi
// bila sudah dibayar, lalu riwayat perubahan status beserta pelakunya. Top up Bermasalah punya aksi "Tambahkan ke
// saldo" dan "Tandai Dana Dikembalikan". Admin tidak bisa membuat atau membatalkan Top up di sini.
//
// Tata letaknya sama dengan detail Pesanan (DESIGN.md Tata letak halaman, Dasbor admin): satu kolom 720 px di tengah,
// dan mulai 1200 px Top up Bermasalah menjadi dua kolom dengan panel aksi di kanan.
export default async function HalamanDetailTopUp({
  params,
}: PageProps<"/admin/top-up/[nomor]">) {
  await wajibSesiAdmin(await headers());

  const nomor = NomorDariAlamat.safeParse((await params).nomor);
  const topUp = nomor.success ? await bacaDetailTopUp(nomor.data) : null;
  if (!topUp) notFound();

  const adaPenyelesaian = penyelesaianTopUpBermasalahTersedia(topUp.status);

  return (
    <div
      className={cn("tata-baca", adaPenyelesaian && "min-[1200px]:max-w-none")}
    >
      <Link
        href="/admin/top-up"
        className="inline-flex h-10 items-center gap-1 pr-3 text-[17px] text-pulpen decoration-2 underline-offset-4 hover:underline"
      >
        <ChevronLeft
          aria-hidden="true"
          className="size-6 shrink-0"
          strokeWidth={2.5}
        />
        Top up
      </Link>
      <div className="kepala-halaman mt-2">
        <div className="min-w-0">
          <p className="text-base text-pensil-redup">Nomor Top up</p>
          <h1 className="mt-1 font-mono text-[30px] leading-[1.1] font-bold tracking-[0.01em] [overflow-wrap:anywhere]">
            {topUp.nomorTopUp}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <PilStatusTopUp status={topUp.status} />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-4",
          adaPenyelesaian &&
            "min-[1200px]:grid-cols-2 min-[1200px]:grid-rows-[auto_1fr] min-[1200px]:items-start min-[1200px]:gap-x-6",
        )}
      >
        <div className="flex min-w-0 flex-col gap-4 min-[1200px]:col-start-1 min-[1200px]:row-start-1">
          <PanelTopUp member={topUp.member} />
          <PanelRincian rincian={topUp.rincian} pembayaran={topUp.pembayaran} />
        </div>
        {adaPenyelesaian && (
          <div className="flex min-w-0 flex-col gap-4 min-[1200px]:col-start-2 min-[1200px]:row-span-2 min-[1200px]:row-start-1">
            <PenyelesaianTopUpBermasalah
              topUpId={topUp.id}
              nominalTopUp={rupiah(topUp.rincian.nominalTopUp)}
              email={topUp.member.email}
            />
          </div>
        )}
        <div className="min-w-0 min-[1200px]:col-start-1 min-[1200px]:row-start-2">
          <PanelRiwayat riwayat={topUp.riwayat} />
        </div>
      </div>
    </div>
  );
}
