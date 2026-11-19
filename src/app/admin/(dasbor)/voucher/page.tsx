import { Plus } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { rupiah } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarVoucher, type Voucher } from "@/server/voucher";
import { waktuWib } from "@/server/zona-waktu-toko";

import { PilAktif } from "../_components/pil";
import { aksiUbahStatusVoucher } from "./aksi";

const ALAMAT = "/admin/voucher";

/** Satu baris daftar Voucher: Voucher beserta pemakaiannya. */
type BarisVoucher = Awaited<ReturnType<typeof daftarVoucher>>[number];

/** Tombol kecil 40 px untuk aksi kedua (DESIGN.md Buttons). */
const KELAS_TOMBOL_KECIL = "tombol tombol-kecil tombol-kedua whitespace-nowrap";

/** Potongan Voucher seperti "Rp 5.000", "10%", atau "10%, maks Rp 10.000" (PRD §8.8 ▶ Keputusan 2026-11-17). */
function teksPotongan(voucher: Voucher) {
  if (voucher.jenisPotongan === "nominal") return rupiah(voucher.nilai);
  if (voucher.batasMaksimum === null) return `${voucher.nilai}%`;
  return `${voucher.nilai}%, maks ${rupiah(voucher.batasMaksimum)}`;
}

/** Masa berlaku Voucher dalam WIB (PRD §8.4, §9.1). Waktu yang tidak diisi tidak membatasi. */
function teksMasaBerlaku({ mulai, berakhir }: Voucher) {
  if (mulai && berakhir) return `${waktuWib(mulai)} – ${waktuWib(berakhir)}`;
  if (mulai) return `Mulai ${waktuWib(mulai)}`;
  if (berakhir) return `Sampai ${waktuWib(berakhir)}`;
  return "Tanpa batas waktu";
}

/**
 * Pemakaian Voucher menurut §8.5, ditulis "3 dari 10" bila Voucher punya Kuota voucher, atau "3" bila tidak
 * (PRD §8.8 ▶ Keputusan 2026-11-17).
 */
function teksPemakaian({
  pemakaian,
  kuotaVoucher,
}: Pick<BarisVoucher, "pemakaian" | "kuotaVoucher">) {
  return kuotaVoucher === null
    ? String(pemakaian)
    : `${pemakaian} dari ${kuotaVoucher}`;
}

/**
 * Tombol "Nonaktifkan" atau "Aktifkan kembali" untuk satu Voucher (PRD §8.8). Aksi ini bisa dibalik, jadi
 * langsung dijalankan tanpa penegasan (DESIGN.md Navigation). Kewenangannya diperiksa di Server Action.
 */
function TombolStatusVoucher({ voucher }: { voucher: Voucher }) {
  return (
    <form action={aksiUbahStatusVoucher}>
      <input type="hidden" name="id" value={voucher.id} />
      <input
        type="hidden"
        name="status"
        value={voucher.aktif ? "nonaktif" : "aktif"}
      />
      <button type="submit" className={KELAS_TOMBOL_KECIL}>
        {voucher.aktif ? "Nonaktifkan" : "Aktifkan kembali"}
        <span className="sr-only"> {voucher.kode}</span>
      </button>
    </form>
  );
}

/**
 * Tabel Voucher. Tabelnya bergulir ke samping di dalam panelnya sendiri pada layar sempit, supaya halaman
 * tidak ikut bergulir ke samping (PRD §11.1). Panelnya `relative`, supaya teks sr-only (position absolute) di
 * dalam tabel ikut tergulir di panel dan tidak melebarkan halaman.
 */
function TabelVoucher({ semuaVoucher }: { semuaVoucher: BarisVoucher[] }) {
  return (
    <div className="kartu relative overflow-x-auto px-4 py-2 sm:px-6">
      <table className="w-full min-w-[960px] text-left">
        <caption className="sr-only">Daftar Voucher</caption>
        <thead className="font-spidol text-[16px] font-bold text-pensil-redup">
          <tr className="border-b-2 border-dashed border-pensil">
            <th scope="col" className="py-2 pr-4">
              Kode
            </th>
            <th scope="col" className="py-2 pr-4">
              Potongan
            </th>
            <th scope="col" className="py-2 pr-4">
              Masa berlaku (WIB)
            </th>
            <th scope="col" className="py-2 pr-4">
              Pemakaian
            </th>
            <th scope="col" className="py-2 pr-4">
              Status
            </th>
            <th scope="col" className="py-2">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {semuaVoucher.map((voucher) => (
            <tr
              key={voucher.id}
              className="border-b-2 border-dashed border-pensil align-top last:border-b-0"
            >
              <th
                scope="row"
                className="py-3 pr-4 font-spidol font-bold break-all"
              >
                {voucher.kode}
              </th>
              <td className="py-3 pr-4 whitespace-nowrap tabular-nums">
                {teksPotongan(voucher)}
              </td>
              <td className="py-3 pr-4 tabular-nums">
                {teksMasaBerlaku(voucher)}
              </td>
              <td className="py-3 pr-4 whitespace-nowrap tabular-nums">
                {teksPemakaian(voucher)}
              </td>
              <td className="py-3 pr-4">
                <PilAktif aktif={voucher.aktif} />
              </td>
              <td className="py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`${ALAMAT}/${voucher.id}`}
                    className={KELAS_TOMBOL_KECIL}
                  >
                    Ubah<span className="sr-only"> {voucher.kode}</span>
                  </Link>
                  <TombolStatusVoucher voucher={voucher} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Daftar Voucher di dasbor admin (PRD §8.8 ▶ Keputusan 2026-11-17): kode, potongan, masa berlaku dalam WIB,
// pemakaian, dan status Aktif atau Nonaktif, dengan Voucher terbaru di atas. Setiap Voucher bisa diubah,
// dinonaktifkan, dan diaktifkan kembali.
export default async function HalamanDaftarVoucher() {
  await wajibSesiAdmin(await headers());
  const semuaVoucher = await daftarVoucher();

  return (
    <>
      <div className="kepala-halaman">
        <h1>Voucher</h1>
        <Link href={`${ALAMAT}/baru`} className="tombol tombol-kecil">
          <Plus aria-hidden="true" className="size-6" strokeWidth={2.5} />
          Tambah Voucher
        </Link>
      </div>

      {semuaVoucher.length === 0 ? (
        <p className="max-w-[65ch] text-pensil-redup">
          Belum ada Voucher. Pilih Tambah Voucher untuk membuat Voucher pertama
          beserta potongan dan syaratnya.
        </p>
      ) : (
        <TabelVoucher semuaVoucher={semuaVoucher} />
      )}
    </>
  );
}
