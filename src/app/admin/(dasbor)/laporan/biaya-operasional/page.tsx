import { Plus } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { z } from "zod";

import { rupiah } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import {
  bulanPertamaBiayaOperasional,
  daftarBiayaOperasional,
} from "@/server/biaya-operasional";
import { tanggalIsianWib, tanggalWibDariIsian } from "@/server/zona-waktu-toko";

import { ALAMAT_BIAYA_OPERASIONAL } from "./alamat";

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** Nama bulan "YYYY-MM", misalnya "November 2026". */
function namaBulan(bulan: string) {
  const [tahun, nomor] = bulan.split("-").map(Number);
  return `${NAMA_BULAN[nomor - 1]} ${tahun}`;
}

/** Bulan "YYYY-MM" sebelum bulan itu. */
function bulanSebelum(bulan: string) {
  const [tahun, nomor] = bulan.split("-").map(Number);
  return nomor === 1
    ? `${tahun - 1}-12`
    : `${tahun}-${String(nomor - 1).padStart(2, "0")}`;
}

/** Bulan dari bulan berjalan mundur sampai bulan `paling awal`, terbaru di atas. */
function pilihanBulan(bulanBerjalan: string, palingAwal: string) {
  const semua = [bulanBerjalan];
  while (semua[semua.length - 1] > palingAwal) {
    semua.push(bulanSebelum(semua[semua.length - 1]));
  }
  return semua;
}

const POLA_BULAN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Tombol kecil 40 px untuk aksi kedua (DESIGN.md Buttons). */
const KELAS_TOMBOL_KECIL = "tombol tombol-kecil tombol-kedua whitespace-nowrap";

type Biaya = Awaited<
  ReturnType<typeof daftarBiayaOperasional>
>["biaya"][number];

/** Saringan bulan, dikirim sebagai GET ke alamat halaman ini (PRD §14.4). */
function FormSaringanBulan({
  bulan,
  pilihan,
}: {
  bulan: string;
  pilihan: string[];
}) {
  return (
    <form
      action={ALAMAT_BIAYA_OPERASIONAL}
      role="search"
      aria-label="Saring Biaya operasional"
      className="kartu flex flex-wrap items-end gap-4 p-4"
    >
      <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-2">
        <label htmlFor="bulan" className="text-[17px] leading-tight">
          Bulan
        </label>
        <select
          id="bulan"
          name="bulan"
          defaultValue={bulan}
          className="isian h-10 min-h-10 w-full min-w-0"
        >
          {pilihan.map((b) => (
            <option key={b} value={b}>
              {namaBulan(b)}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="tombol tombol-kecil">
        Tampilkan
      </button>
    </form>
  );
}

/**
 * Tabel Biaya operasional sebulan. Tabelnya bergulir ke samping di dalam panelnya sendiri pada layar sempit, supaya
 * halaman tidak ikut bergulir ke samping (PRD §11.1).
 */
function TabelBiaya({ biaya }: { biaya: readonly Biaya[] }) {
  return (
    <div className="kartu relative overflow-x-auto px-4 py-2 sm:px-6">
      <table className="w-full min-w-[560px] text-left">
        <caption className="sr-only">Daftar Biaya operasional</caption>
        <thead className="font-spidol text-[16px] font-bold text-pensil-redup">
          <tr className="border-b-2 border-dashed border-pensil">
            <th scope="col" className="py-2 pr-4">
              Tanggal
            </th>
            <th scope="col" className="py-2 pr-4">
              Keterangan
            </th>
            <th scope="col" className="py-2 pr-4 text-right">
              Nominal
            </th>
            <th scope="col" className="py-2">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {biaya.map((b) => (
            <tr
              key={b.id}
              className="border-b-2 border-dashed border-pensil align-top last:border-b-0"
            >
              <td className="py-3 pr-4 whitespace-nowrap tabular-nums">
                {tanggalWibDariIsian(b.tanggal)}
              </td>
              <th
                scope="row"
                className="py-3 pr-4 font-normal [overflow-wrap:anywhere]"
              >
                {b.keterangan}
              </th>
              <td className="py-3 pr-4 text-right whitespace-nowrap tabular-nums">
                {rupiah(b.nominal)}
              </td>
              <td className="py-2">
                <div className="flex justify-end">
                  <Link
                    href={`${ALAMAT_BIAYA_OPERASIONAL}/${b.id}`}
                    className={KELAS_TOMBOL_KECIL}
                  >
                    Ubah<span className="sr-only"> {b.keterangan}</span>
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Halaman Biaya operasional (PRD §14.4 ▶ Keputusan 2026-11-20): saringan bulan dengan bulan berjalan menurut zona
// waktu toko (PRD §9.1) sebagai pilihan awal, total Biaya operasional bulan itu, dan daftar biayanya dengan tanggal
// terbaru di atas. Halaman ini dibuka dari Laporan keuangan, dan belum ditautkan dari menu samping maupun
// Ringkasan (PRD §13 ▶ Keputusan 2026-11-20).
export default async function HalamanBiayaOperasional({
  searchParams,
}: PageProps<"/admin/laporan/biaya-operasional">) {
  await wajibSesiAdmin(await headers());
  const bulanBerjalan = tanggalIsianWib(new Date()).slice(0, 7);
  // Bulan dari alamat. Bulan yang tidak sah atau yang belum tiba diabaikan, dan bulan berjalan yang dipakai.
  const { bulan = bulanBerjalan } = z
    .object({
      bulan: z
        .string()
        .regex(POLA_BULAN)
        .refine((b) => b <= bulanBerjalan)
        .optional()
        .catch(undefined),
    })
    .parse(await searchParams);

  const [{ biaya, total }, bulanPertama] = await Promise.all([
    daftarBiayaOperasional(bulan),
    bulanPertamaBiayaOperasional(),
  ]);
  const palingAwal = [bulan, bulanPertama ?? bulan].sort()[0];

  return (
    <>
      <div className="kepala-halaman">
        <h1>Biaya operasional</h1>
        <Link
          href={`${ALAMAT_BIAYA_OPERASIONAL}/baru`}
          className="tombol tombol-kecil"
        >
          <Plus aria-hidden="true" className="size-6" strokeWidth={2.5} />
          Tambah biaya
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {/* Form dipasang ulang setiap bulan di alamat berubah, supaya pilihannya ikut berganti. */}
        <FormSaringanBulan
          key={bulan}
          bulan={bulan}
          pilihan={pilihanBulan(bulanBerjalan, palingAwal)}
        />

        <section aria-labelledby="total-judul" className="kartu p-4 sm:p-6">
          <h2 id="total-judul" className="text-[20px] text-pensil-redup">
            Total Biaya operasional {namaBulan(bulan)}
          </h2>
          <p className="font-spidol text-[32px] font-bold tabular-nums">
            {rupiah(total)}
          </p>
        </section>

        {biaya.length === 0 ? (
          <p className="max-w-[65ch] text-pensil-redup">
            Belum ada Biaya operasional bertanggal {namaBulan(bulan)}. Pilih
            Tambah biaya untuk mencatat biaya toko di luar Harga modal dan Biaya
            transaksi, misalnya sewa server atau iklan.
          </p>
        ) : (
          <TabelBiaya biaya={biaya} />
        )}
      </div>
    </>
  );
}
