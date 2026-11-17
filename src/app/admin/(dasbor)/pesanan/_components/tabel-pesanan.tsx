import { MailX } from "lucide-react";
import Link from "next/link";

import { PilStatusPesanan } from "@/components/pil-status-pesanan";
import type { StatusPesanan } from "@/domain/status-pesanan";
import { rupiah } from "@/lib/rupiah";
import { waktuWib } from "@/server/zona-waktu-toko";

import { Pil } from "../../_components/pil";

/** Satu baris tabel Pesanan, dengan kolom PRD §9.5. */
type BarisPesanan = {
  nomorPesanan: string;
  waktuDibuat: Date | null;
  email: string;
  namaProduk: string;
  namaVarian: string;
  totalBayar: number;
  status: StatusPesanan;
  emailGagal: boolean;
};

/**
 * Tabel Pesanan dengan kolom PRD §9.5, dipakai daftar Pesanan dan Riwayat Pesanan Member di dasbor admin
 * (PRD §2.3 ▶ Keputusan 2026-11-17). Nomor Pesanan setiap baris membuka detail Pesanan. Tabelnya bergulir ke
 * samping di dalam panelnya sendiri pada layar sempit, supaya halaman tidak ikut bergulir ke samping (PRD
 * §11.1).
 */
export function TabelPesanan({
  semuaPesanan,
  judul,
}: {
  semuaPesanan: readonly BarisPesanan[];
  judul: string;
}) {
  return (
    <div className="mt-4 max-w-[1120px] overflow-x-auto rounded-[20px] bg-permukaan px-4 py-2 shadow-bayang">
      <table className="w-full min-w-[880px] text-left">
        <caption className="sr-only">{judul}</caption>
        <thead className="text-[13px] font-bold text-tinta-redup">
          <tr className="border-b border-garis">
            <th scope="col" className="py-2 pr-4">
              Nomor Pesanan
            </th>
            <th scope="col" className="py-2 pr-4">
              Waktu dibuat (WIB)
            </th>
            <th scope="col" className="min-w-48 py-2 pr-4">
              Email
            </th>
            <th scope="col" className="min-w-48 py-2 pr-4">
              Produk dan Varian
            </th>
            <th scope="col" className="py-2 pr-4 text-right">
              Total bayar
            </th>
            <th scope="col" className="py-2">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {semuaPesanan.map((satu) => (
            <tr
              key={satu.nomorPesanan}
              className="border-b border-garis align-top last:border-b-0"
            >
              <th
                scope="row"
                className="py-3 pr-4 font-mono text-[13px] font-bold whitespace-nowrap"
              >
                {/* Nomor Pesanan membuka detail Pesanan (PRD §9.5). */}
                <Link
                  href={`/admin/pesanan/${satu.nomorPesanan}`}
                  className="inline-flex min-h-6 items-center text-aksi-teks underline-offset-2 hover:underline"
                >
                  {satu.nomorPesanan}
                </Link>
              </th>
              <td className="py-3 pr-4 whitespace-nowrap">
                {satu.waktuDibuat ? waktuWib(satu.waktuDibuat) : "—"}
              </td>
              <td className="py-3 pr-4 [overflow-wrap:anywhere]">
                {satu.email}
              </td>
              <td className="py-3 pr-4 [overflow-wrap:anywhere]">
                <span className="font-bold">{satu.namaProduk}</span>{" "}
                <span className="text-tinta-redup">· {satu.namaVarian}</span>
              </td>
              <td className="py-3 pr-4 text-right font-bold whitespace-nowrap">
                {rupiah(satu.totalBayar)}
              </td>
              <td className="py-3">
                <div className="flex flex-wrap gap-2">
                  <PilStatusPesanan status={satu.status} />{" "}
                  {satu.emailGagal && (
                    <Pil
                      ikon={MailX}
                      label="Email gagal"
                      className="bg-st-masalah-bg text-st-masalah"
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
