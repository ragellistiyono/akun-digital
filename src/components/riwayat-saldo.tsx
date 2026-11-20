import Link from "next/link";

import type { JenisRiwayatSaldo } from "@/domain/ubah-saldo-admin";
import { rupiah, rupiahPlusMinus } from "@/lib/rupiah";
import { waktuWib } from "@/server/zona-waktu-toko";

/** Satu halaman Riwayat saldo, seperti hasil riwayatSaldoMember di src/server/saldo.ts. */
type HalamanRiwayatSaldo = {
  baris: readonly {
    id: number;
    waktu: Date;
    jenis: JenisRiwayatSaldo;
    nominal: number;
    saldoSesudah: number;
    rujukan: string;
  }[];
  jumlah: number;
  halaman: number;
  jumlahHalaman: number;
};

/** Tombol kecil 40 px untuk aksi kedua (DESIGN.md Buttons). */
const KELAS_TOMBOL_KECIL_GARIS = "tombol tombol-kecil tombol-kedua";

const PESAN = "max-w-[65ch] text-pensil-redup";

/** Tautan ke halaman Riwayat saldo sebelum dan sesudahnya, bila riwayatnya punya lebih dari satu halaman. */
function NavigasiHalaman({
  halaman,
  jumlahHalaman,
  alamatHalaman,
}: {
  halaman: number;
  jumlahHalaman: number;
  alamatHalaman: (halaman: number) => string;
}) {
  if (jumlahHalaman <= 1) return null;
  return (
    <nav
      aria-label="Halaman Riwayat saldo"
      className="flex flex-wrap items-center gap-2"
    >
      {halaman > 1 && (
        <Link
          href={alamatHalaman(Math.min(halaman - 1, jumlahHalaman))}
          className={KELAS_TOMBOL_KECIL_GARIS}
        >
          Sebelumnya
        </Link>
      )}
      <p className="px-2 text-[15px] text-pensil-redup">
        Halaman {halaman} dari {jumlahHalaman}
      </p>
      {halaman < jumlahHalaman && (
        <Link
          href={alamatHalaman(halaman + 1)}
          className={KELAS_TOMBOL_KECIL_GARIS}
        >
          Berikutnya
        </Link>
      )}
    </nav>
  );
}

/**
 * Riwayat saldo seorang Member (PRD §15.2): tabel berkolom waktu, jenis, nominal bertanda + atau −, saldo
 * sesudahnya, dan rujukan, termasuk keterangan Admin, dengan baris terbaru di atas dan 50 baris per halaman.
 * Dipakai halaman Member di dasbor admin (§15.6) dan halaman Riwayat saldo Member (§15.10). Tabelnya bergulir ke
 * samping di dalam kartunya sendiri pada layar sempit, supaya halaman tidak ikut bergulir ke samping (PRD §11.1).
 */
export function RiwayatSaldo({
  riwayat,
  judul,
  alamatHalaman,
}: {
  riwayat: HalamanRiwayatSaldo;
  judul: string;
  alamatHalaman: (halaman: number) => string;
}) {
  if (riwayat.jumlah === 0) {
    return <p className={PESAN}>Belum ada perubahan saldo.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {riwayat.baris.length === 0 ? (
        <p className={PESAN}>
          Halaman {riwayat.halaman} kosong, karena Riwayat saldo ini hanya punya{" "}
          {riwayat.jumlahHalaman} halaman. Pilih Sebelumnya untuk kembali.
        </p>
      ) : (
        <div className="kartu p-4">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <caption className="sr-only">{judul}</caption>
              <thead className="font-spidol text-base font-bold text-pensil-redup">
                <tr className="border-b-2 border-dashed border-pensil">
                  <th scope="col" className="py-2 pr-4">
                    Waktu (WIB)
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Jenis
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right">
                    Nominal
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right">
                    Saldo
                  </th>
                  <th scope="col" className="min-w-48 py-2">
                    Rujukan
                  </th>
                </tr>
              </thead>
              <tbody>
                {riwayat.baris.map((baris) => (
                  <tr
                    key={baris.id}
                    className="border-b-2 border-dashed border-pensil align-top last:border-b-0"
                  >
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {waktuWib(baris.waktu)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {baris.jenis}
                    </td>
                    <td
                      className={`py-3 pr-4 text-right font-spidol font-bold whitespace-nowrap tabular-nums ${baris.nominal < 0 ? "text-aksi" : "text-st-selesai"}`}
                    >
                      {rupiahPlusMinus(baris.nominal)}
                    </td>
                    <td className="py-3 pr-4 text-right whitespace-nowrap tabular-nums">
                      {rupiah(baris.saldoSesudah)}
                    </td>
                    <td className="py-3 [overflow-wrap:anywhere]">
                      {baris.rujukan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <NavigasiHalaman
        halaman={riwayat.halaman}
        jumlahHalaman={riwayat.jumlahHalaman}
        alamatHalaman={alamatHalaman}
      />
    </div>
  );
}
