import { ChevronLeft, MailX } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { RincianNominal } from "@/app/(toko)/_components/rincian-nominal";
import { PilStatusPesanan } from "@/components/pil-status-pesanan";
import {
  kirimUlangEmailTersedia,
  koreksiEmailTersedia,
} from "@/domain/kirim-ulang-email";
import { labelPotonganVoucher } from "@/domain/label-potongan-voucher";
import { nomorPesananSah } from "@/domain/nomor-pesanan";
import { penyelesaianBermasalahTersedia } from "@/domain/penyelesaian-bermasalah";
import { rupiah, rupiahBertanda } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { bacaDetailPesanan } from "@/server/detail-pesanan";
import { waktuWib } from "@/server/zona-waktu-toko";

import { Pil } from "../../_components/pil";
import {
  AksiEmailPesanan,
  KoreksiEmailBermasalah,
} from "../_components/aksi-email-pesanan";
import { PenyelesaianBermasalah } from "../_components/penyelesaian-bermasalah";

const PANEL = "kartu p-4";

const KELAS_JUDUL_PANEL = "text-[26px]";

/** Kepala tabel riwayat: Kalam 16 px (DESIGN.md Typography). */
const KELAS_KEPALA_TABEL = "font-spidol text-base font-bold text-pensil-redup";

/** Pemisah antarbaris: putus-putus pensil 2 px. */
const KELAS_PEMISAH = "border-b-2 border-dashed border-pensil";

/** Nomor Pesanan dari alamat. Teks yang tidak berbentuk Nomor Pesanan pasti bukan Pesanan mana pun. */
const NomorDariAlamat = z.string().refine(nomorPesananSah);

type DetailPesanan = NonNullable<Awaited<ReturnType<typeof bacaDetailPesanan>>>;

/** Email dan Produk beserta Varian Pesanan itu. */
function PanelPesanan({ pesanan }: { pesanan: DetailPesanan }) {
  return (
    <section aria-label="Pesanan" className={PANEL}>
      <dl className="flex flex-col gap-3">
        <div>
          <dt className="text-base text-pensil-redup">Email</dt>
          <dd className="[overflow-wrap:anywhere]">{pesanan.email}</dd>
        </div>
        <div>
          <dt className="text-base text-pensil-redup">Produk dan Varian</dt>
          <dd className="[overflow-wrap:anywhere]">
            <span className="font-spidol font-bold">{pesanan.namaProduk}</span>{" "}
            <span className="text-pensil-redup">· {pesanan.namaVarian}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * Harga modal, Laba kotor, dan Biaya transaksi Pesanan itu, sesudah rincian nominal (PRD §9.5 ▶ Keputusan
 * 2026-11-20). Pesanan tanpa Harga modal menampilkan "—" beserta keterangannya. Biaya transaksi hanya tampil
 * bila Pesanan sudah dibayar, yaitu bila sudah tercatat (PRD §14.3). Baris ini hanya ada di dasbor admin.
 */
function RincianLaba({ laba }: { laba: DetailPesanan["laba"] }) {
  const baris = [
    {
      label: "Harga modal",
      nilai: laba.hargaModal === null ? "—" : rupiah(laba.hargaModal),
    },
    {
      label: "Laba kotor",
      nilai: laba.labaKotor === null ? "—" : rupiahBertanda(laba.labaKotor),
    },
    ...(laba.biayaTransaksi === null
      ? []
      : [{ label: "Biaya transaksi", nilai: rupiah(laba.biayaTransaksi) }]),
  ];
  return (
    <div className="mt-3 border-t-2 border-dashed border-pensil pt-2">
      <table className="w-full border-collapse text-[17px] leading-[1.3]">
        <tbody>
          {baris.map(({ label, nilai }) => (
            <tr key={label}>
              <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                {label}
              </th>
              <td className="py-1.5 text-right whitespace-nowrap">{nilai}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {laba.hargaModal === null && (
        <p className="mt-1 text-[15px] text-pensil-redup">
          Harga modal Varian ini belum diisi
        </p>
      )}
    </div>
  );
}

/**
 * Rincian nominal yang dicatat di Pesanan (PRD §5.5), dengan tulisan yang sama seperti di Halaman Pesanan. Baris
 * potongannya menyebut kode Voucher Pesanan itu, bila ada (PRD §8.8 ▶ Keputusan 2026-11-17). Di bawahnya ada
 * Harga modal dan Laba kotor Pesanan itu.
 */
function PanelRincian({
  rincian,
  laba,
}: {
  rincian: DetailPesanan["rincian"];
  laba: DetailPesanan["laba"];
}) {
  return (
    <section aria-label="Rincian pembayaran" className={PANEL}>
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
        total={{ label: "Total bayar", nilai: rupiah(rincian.totalBayar) }}
      />
      <RincianLaba laba={laba} />
    </section>
  );
}

/**
 * Item stok yang Terkirim ke Pesanan itu: nama kolom Format Item stok yang dicatat saat Terkirim, lalu isinya
 * dalam huruf mono yang boleh patah di mana saja (DESIGN.md Typography).
 */
function PanelItemStok({
  kolom,
}: {
  kolom: NonNullable<DetailPesanan["itemStok"]>;
}) {
  return (
    <section aria-labelledby="judul-item-stok" className={PANEL}>
      <h2 id="judul-item-stok" className={KELAS_JUDUL_PANEL}>
        Item stok
      </h2>
      <dl className="mt-2">
        {kolom.map(({ nama, nilai }, urutan) => (
          <div key={urutan} className={`${KELAS_PEMISAH} py-2 last:border-b-0`}>
            <dt className="text-base text-pensil-redup">{nama}</dt>
            <dd className="font-mono text-[15px] font-medium [overflow-wrap:anywhere]">
              {nilai}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Riwayat perubahan status Pesanan itu, dari yang paling lama: waktu dalam WIB (PRD §9.1), pil status, dan
 * pelakunya. Tabelnya bergulir ke samping di dalam panelnya sendiri pada layar sempit, supaya halaman tidak
 * ikut bergulir ke samping (PRD §11.1).
 */
function PanelRiwayat({ riwayat }: { riwayat: DetailPesanan["riwayat"] }) {
  return (
    <section aria-labelledby="judul-riwayat" className={PANEL}>
      <h2 id="judul-riwayat" className={KELAS_JUDUL_PANEL}>
        Riwayat perubahan status
      </h2>
      {riwayat.length === 0 ? (
        <p className="mt-2 text-pensil-redup">
          Pesanan ini belum punya catatan perubahan status.
        </p>
      ) : (
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
                    <PilStatusPesanan status={status} />
                  </td>
                  <td className="py-3">{pelaku}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Detail Pesanan di dasbor admin (PRD §9.5): Nomor Pesanan dalam huruf mono dengan pil status dan tanda
// "Email gagal" (PRD §6.4), email dan Produk beserta Varian, rincian nominal (PRD §5.5) beserta Harga modal,
// Laba kotor, dan Biaya transaksi Pesanan yang sudah dibayar (PRD §9.5 ▶ Keputusan 2026-11-20), Item stok bila sudah
// Terkirim, dan riwayat perubahan status. Pesanan yang kirim ulangnya tersedia (Selesai) juga punya aksi
// kirim ulang email "Pesanan selesai" dan koreksi email (PRD §6.4), dan Pesanan Bermasalah punya koreksi email
// yang hanya menyimpan (PRD §6.4, ▶ Keputusan 2026-11-12) serta aksi "Kirim Item stok" dan "Tandai Dana
// Dikembalikan" (PRD §5.9).
//
// Tata letaknya (DESIGN.md Tata letak halaman, Dasbor admin): di bawah 1200 px semua panel satu kolom 720 px di
// tengah, berurutan ringkasan Pesanan, panel aksi, lalu riwayat. Mulai 1200 px, bila ada panel aksi, isinya
// menjadi dua kolom: ringkasan Pesanan dan riwayat di kiri, panel aksi di kanan. Urutan di DOM tidak berubah,
// jadi urutan baca tetap sama dengan ponsel, termasuk Koreksi email sebelum Selesaikan Pesanan Bermasalah
// (▶ Keputusan 2026-11-12 #99). Baris kedua grid berukuran `1fr`, supaya tinggi kolom aksi masuk ke baris itu
// dan riwayat menempel tepat di bawah ringkasan. Pesanan tanpa panel aksi tetap satu kolom 720 px di tengah.
export default async function HalamanDetailPesanan({
  params,
}: PageProps<"/admin/pesanan/[nomor]">) {
  await wajibSesiAdmin(await headers());

  const nomor = NomorDariAlamat.safeParse((await params).nomor);
  const pesanan = nomor.success ? await bacaDetailPesanan(nomor.data) : null;
  if (!pesanan) notFound();

  const adaKoreksiEmailBermasalah =
    koreksiEmailTersedia(pesanan.status) &&
    !kirimUlangEmailTersedia(pesanan.status);
  const adaPenyelesaian = penyelesaianBermasalahTersedia(pesanan.status);
  const adaAksiEmail = kirimUlangEmailTersedia(pesanan.status);
  const duaKolom = adaKoreksiEmailBermasalah || adaPenyelesaian || adaAksiEmail;

  return (
    <div className={cn("tata-baca", duaKolom && "min-[1200px]:max-w-none")}>
      <Link
        href="/admin/pesanan"
        className="inline-flex h-10 items-center gap-1 pr-3 text-[17px] text-pulpen decoration-2 underline-offset-4 hover:underline"
      >
        <ChevronLeft
          aria-hidden="true"
          className="size-6 shrink-0"
          strokeWidth={2.5}
        />
        Pesanan
      </Link>
      <div className="kepala-halaman mt-2">
        <div className="min-w-0">
          <p className="text-base text-pensil-redup">Nomor Pesanan</p>
          <h1 className="mt-1 font-mono text-[30px] leading-[1.1] font-bold tracking-[0.01em] [overflow-wrap:anywhere]">
            {pesanan.nomorPesanan}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <PilStatusPesanan status={pesanan.status} />
            {pesanan.emailGagal && (
              <Pil
                ikon={MailX}
                label="Email gagal"
                className="bg-st-masalah-bg text-st-masalah"
              />
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-4",
          duaKolom &&
            "min-[1200px]:grid-cols-2 min-[1200px]:grid-rows-[auto_1fr] min-[1200px]:items-start min-[1200px]:gap-x-6",
        )}
      >
        <div className="flex min-w-0 flex-col gap-4 min-[1200px]:col-start-1 min-[1200px]:row-start-1">
          <PanelPesanan pesanan={pesanan} />
          <PanelRincian rincian={pesanan.rincian} laba={pesanan.laba} />
          {pesanan.itemStok && <PanelItemStok kolom={pesanan.itemStok} />}
        </div>
        {duaKolom && (
          <div className="flex min-w-0 flex-col gap-4 min-[1200px]:col-start-2 min-[1200px]:row-span-2 min-[1200px]:row-start-1">
            {/* Koreksi email Pesanan Bermasalah ada di atas "Kirim Item stok", sesuai urutan kerjanya (UAT-E6). */}
            {adaKoreksiEmailBermasalah && (
              <KoreksiEmailBermasalah
                pesananId={pesanan.id}
                email={pesanan.email}
              />
            )}
            {adaPenyelesaian && (
              <PenyelesaianBermasalah
                pesananId={pesanan.id}
                email={pesanan.email}
              />
            )}
            {adaAksiEmail && (
              <AksiEmailPesanan pesananId={pesanan.id} email={pesanan.email} />
            )}
          </div>
        )}
        <div className="min-w-0 min-[1200px]:col-start-1 min-[1200px]:row-start-2">
          <PanelRiwayat riwayat={pesanan.riwayat} />
        </div>
      </div>
    </div>
  );
}
