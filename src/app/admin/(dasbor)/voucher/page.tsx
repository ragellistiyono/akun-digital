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

/** Tombol kecil 36 px bergaris (DESIGN.md Buttons). */
const KELAS_TOMBOL_KECIL =
  "inline-flex h-9 items-center rounded-[10px] border-[1.5px] border-garis bg-permukaan px-3 text-sm font-bold whitespace-nowrap text-tinta hover:border-monogram";

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
 * tidak ikut bergulir ke samping (PRD §11.1).
 */
function TabelVoucher({ semuaVoucher }: { semuaVoucher: Voucher[] }) {
  return (
    <div className="mt-6 max-w-[1120px] overflow-x-auto rounded-[20px] bg-permukaan px-4 py-2 shadow-bayang">
      <table className="w-full min-w-[880px] text-left">
        <caption className="sr-only">Daftar Voucher</caption>
        <thead className="text-[13px] font-bold text-tinta-redup">
          <tr className="border-b border-garis">
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
              className="border-b border-garis align-top last:border-b-0"
            >
              <th scope="row" className="py-3 pr-4 font-bold break-all">
                {voucher.kode}
              </th>
              <td className="py-3 pr-4 whitespace-nowrap tabular-nums">
                {teksPotongan(voucher)}
              </td>
              <td className="py-3 pr-4 tabular-nums">
                {teksMasaBerlaku(voucher)}
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
// dan status Aktif atau Nonaktif, dengan Voucher terbaru di atas. Setiap Voucher bisa diubah, dinonaktifkan,
// dan diaktifkan kembali.
export default async function HalamanDaftarVoucher() {
  await wajibSesiAdmin(await headers());
  const semuaVoucher = await daftarVoucher();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Voucher</h1>
        <Link
          href={`${ALAMAT}/baru`}
          className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-aksi px-4 text-sm font-bold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98]"
        >
          <Plus aria-hidden="true" className="size-6" />
          Tambah Voucher
        </Link>
      </div>

      {semuaVoucher.length === 0 ? (
        <p className="mt-6 max-w-[65ch] text-tinta-redup">
          Belum ada Voucher. Pilih Tambah Voucher untuk membuat Voucher pertama
          beserta potongan dan syaratnya.
        </p>
      ) : (
        <TabelVoucher semuaVoucher={semuaVoucher} />
      )}
    </>
  );
}
