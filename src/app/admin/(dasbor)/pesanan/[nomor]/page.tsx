import { ChevronLeft, MailX } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { RincianNominal } from "@/app/(toko)/_components/rincian-nominal";
import { PilStatusPesanan } from "@/components/pil-status-pesanan";
import { kirimUlangEmailTersedia } from "@/domain/kirim-ulang-email";
import { nomorPesananSah } from "@/domain/nomor-pesanan";
import { rupiah } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { bacaDetailPesanan } from "@/server/detail-pesanan";
import { waktuWib } from "@/server/zona-waktu-toko";

import { Pil } from "../../_components/pil";
import { AksiEmailPesanan } from "../_components/aksi-email-pesanan";

const PANEL = "rounded-[20px] bg-permukaan p-4 shadow-bayang";

const KELAS_JUDUL_PANEL =
  "text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]";

/** Nomor Pesanan dari alamat. Teks yang tidak berbentuk Nomor Pesanan pasti bukan Pesanan mana pun. */
const NomorDariAlamat = z.string().refine(nomorPesananSah);

type DetailPesanan = NonNullable<Awaited<ReturnType<typeof bacaDetailPesanan>>>;

/** Email dan Produk beserta Varian Pesanan itu. */
function PanelPesanan({ pesanan }: { pesanan: DetailPesanan }) {
  return (
    <section aria-label="Pesanan" className={PANEL}>
      <dl className="flex flex-col gap-3">
        <div>
          <dt className="text-[13px] font-bold text-tinta-redup">Email</dt>
          <dd className="[overflow-wrap:anywhere]">{pesanan.email}</dd>
        </div>
        <div>
          <dt className="text-[13px] font-bold text-tinta-redup">
            Produk dan Varian
          </dt>
          <dd className="[overflow-wrap:anywhere]">
            <span className="font-bold">{pesanan.namaProduk}</span>{" "}
            <span className="text-tinta-redup">· {pesanan.namaVarian}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Rincian nominal yang dicatat di Pesanan (PRD §5.5), dengan tulisan yang sama seperti di Halaman Pesanan. */
function PanelRincian({ rincian }: { rincian: DetailPesanan["rincian"] }) {
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
        total={{ label: "Total bayar", nilai: rupiah(rincian.totalBayar) }}
      />
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
          <div
            key={urutan}
            className="border-b border-garis py-2 last:border-b-0"
          >
            <dt className="text-[13px] font-bold text-tinta-redup">{nama}</dt>
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
        <p className="mt-2 text-tinta-redup">
          Pesanan ini belum punya catatan perubahan status.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[400px] text-left">
            <caption className="sr-only">Riwayat perubahan status</caption>
            <thead className="text-[13px] font-bold text-tinta-redup">
              <tr className="border-b border-garis">
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
                  className="border-b border-garis align-top last:border-b-0"
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
// "Email gagal" (PRD §6.4), email dan Produk beserta Varian, rincian nominal (PRD §5.5), Item stok bila sudah
// Terkirim, dan riwayat perubahan status. Pesanan yang kirim ulangnya tersedia (Selesai) juga punya aksi
// kirim ulang email "Pesanan selesai" dan koreksi email (PRD §6.4). Di layar lebar isinya menjadi dua kolom.
export default async function HalamanDetailPesanan({
  params,
}: PageProps<"/admin/pesanan/[nomor]">) {
  await wajibSesiAdmin(await headers());

  const nomor = NomorDariAlamat.safeParse((await params).nomor);
  const pesanan = nomor.success ? await bacaDetailPesanan(nomor.data) : null;
  if (!pesanan) notFound();

  return (
    <>
      <Link
        href="/admin/pesanan"
        className="inline-flex h-10 items-center gap-1 rounded-[12px] pr-3 text-sm font-bold text-aksi-teks hover:bg-permukaan-2"
      >
        <ChevronLeft aria-hidden="true" className="size-6 shrink-0" />
        Pesanan
      </Link>
      <p className="mt-2 text-sm font-bold text-tinta-redup">Nomor Pesanan</p>
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

      <div className="mt-6 grid max-w-[1120px] gap-4 lebar:grid-cols-2 lebar:items-start lebar:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <PanelPesanan pesanan={pesanan} />
          <PanelRincian rincian={pesanan.rincian} />
          {pesanan.itemStok && <PanelItemStok kolom={pesanan.itemStok} />}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {kirimUlangEmailTersedia(pesanan.status) && (
            <AksiEmailPesanan pesananId={pesanan.id} email={pesanan.email} />
          )}
          <PanelRiwayat riwayat={pesanan.riwayat} />
        </div>
      </div>
    </>
  );
}
