import { MailX, TriangleAlert } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { z } from "zod";

import { PilStatusPesanan } from "@/components/pil-status-pesanan";
import { STATUS_PESANAN } from "@/domain/status-pesanan";
import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarPesanan } from "@/server/daftar-pesanan";
import { waktuWib } from "@/server/zona-waktu-toko";

import { KELAS_ISIAN } from "../_components/isian-form";
import { Pil } from "../_components/pil";

const ALAMAT = "/admin/pesanan";

// Saringan dari alamat. Nilai yang tidak sah, termasuk isian yang dikosongkan, diabaikan.
const SaringanAlamat = z.object({
  status: z.enum(STATUS_PESANAN).optional().catch(undefined),
  dari: z.iso.date().optional().catch(undefined),
  sampai: z.iso.date().optional().catch(undefined),
  cari: z.string().trim().min(1).optional().catch(undefined),
  halaman: z.coerce.number().int().min(1).optional().catch(undefined),
});

type Saringan = z.infer<typeof SaringanAlamat>;

/** Alamat daftar Pesanan dengan saringan itu dan halaman itu. */
function alamatDaftar(saringan: Saringan, halaman: number) {
  const parameter = new URLSearchParams();
  for (const kunci of ["status", "dari", "sampai", "cari"] as const) {
    const nilai = saringan[kunci];
    if (nilai !== undefined) parameter.set(kunci, nilai);
  }
  if (halaman > 1) parameter.set("halaman", String(halaman));
  const kueri = parameter.toString();
  return kueri === "" ? ALAMAT : `${ALAMAT}?${kueri}`;
}

/** Isian 40 px untuk saringan, dengan kepadatan Operate dasbor admin (DESIGN.md Navigation). */
const KELAS_ISIAN_SARINGAN = cn(KELAS_ISIAN, "h-10 w-full min-w-0");

/** Satu isian saringan dengan labelnya. Isian berbaris ke bawah bila tidak muat dalam satu baris. */
const KELAS_KOLOM_SARINGAN = "flex min-w-40 flex-1 flex-col gap-2";

const KELAS_TOMBOL_KECIL_GARIS =
  "inline-flex h-10 items-center rounded-[12px] border-[1.5px] border-garis bg-permukaan px-4 text-sm font-bold hover:border-monogram";

/** Form saringan status, rentang tanggal WIB, dan pencarian (PRD §9.5). Dikirim sebagai GET ke alamat ini. */
function FormSaringan({
  saringan,
  menyaring,
}: {
  saringan: Saringan;
  menyaring: boolean;
}) {
  return (
    <form
      action={ALAMAT}
      role="search"
      aria-label="Saring Pesanan"
      className="mt-6 flex max-w-[1120px] flex-wrap items-end gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <div className={KELAS_KOLOM_SARINGAN}>
        <label htmlFor="status" className="text-sm font-bold">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={saringan.status ?? ""}
          className={KELAS_ISIAN_SARINGAN}
        >
          <option value="">Semua status</option>
          {STATUS_PESANAN.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div className={KELAS_KOLOM_SARINGAN}>
        <label htmlFor="dari" className="text-sm font-bold">
          Dari tanggal
        </label>
        <input
          id="dari"
          name="dari"
          type="date"
          defaultValue={saringan.dari ?? ""}
          className={KELAS_ISIAN_SARINGAN}
        />
      </div>
      <div className={KELAS_KOLOM_SARINGAN}>
        <label htmlFor="sampai" className="text-sm font-bold">
          Sampai tanggal
        </label>
        <input
          id="sampai"
          name="sampai"
          type="date"
          defaultValue={saringan.sampai ?? ""}
          className={KELAS_ISIAN_SARINGAN}
        />
      </div>
      <div className={cn(KELAS_KOLOM_SARINGAN, "min-w-56 flex-[2]")}>
        <label htmlFor="cari" className="text-sm font-bold">
          Cari
        </label>
        <input
          id="cari"
          name="cari"
          type="search"
          defaultValue={saringan.cari ?? ""}
          placeholder="Email atau Nomor Pesanan"
          autoComplete="off"
          className={KELAS_ISIAN_SARINGAN}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-[12px] bg-aksi px-4 text-sm font-bold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98]"
        >
          Saring
        </button>
        {menyaring && (
          <Link href={ALAMAT} className={KELAS_TOMBOL_KECIL_GARIS}>
            Hapus saringan
          </Link>
        )}
      </div>
    </form>
  );
}

type HasilDaftar = Awaited<ReturnType<typeof daftarPesanan>>;

/**
 * Tabel Pesanan dengan kolom PRD §9.5. Tabelnya bergulir ke samping di dalam panelnya sendiri pada layar
 * sempit, supaya halaman tidak ikut bergulir ke samping (PRD §11.1).
 */
function TabelPesanan({
  semuaPesanan,
}: {
  semuaPesanan: HasilDaftar["pesanan"];
}) {
  return (
    <div className="mt-4 max-w-[1120px] overflow-x-auto rounded-[20px] bg-permukaan px-4 py-2 shadow-bayang">
      <table className="w-full min-w-[880px] text-left">
        <caption className="sr-only">Daftar Pesanan</caption>
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
                {satu.nomorPesanan}
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

/** Tautan ke halaman sebelum dan sesudahnya, bila daftar punya lebih dari satu halaman. */
function NavigasiHalaman({
  saringan,
  daftar,
}: {
  saringan: Saringan;
  daftar: HasilDaftar;
}) {
  const { halaman, jumlahHalaman } = daftar;
  if (jumlahHalaman <= 1) return null;
  return (
    <nav
      aria-label="Halaman daftar Pesanan"
      className="mt-4 flex flex-wrap items-center gap-2"
    >
      {halaman > 1 && (
        <Link
          href={alamatDaftar(saringan, Math.min(halaman - 1, jumlahHalaman))}
          className={KELAS_TOMBOL_KECIL_GARIS}
        >
          Sebelumnya
        </Link>
      )}
      <p className="px-2 text-[13px] font-bold text-tinta-redup">
        Halaman {halaman} dari {jumlahHalaman}
      </p>
      {halaman < jumlahHalaman && (
        <Link
          href={alamatDaftar(saringan, halaman + 1)}
          className={KELAS_TOMBOL_KECIL_GARIS}
        >
          Berikutnya
        </Link>
      )}
    </nav>
  );
}

const PESAN = "mt-6 max-w-[65ch] text-tinta-redup";

// Daftar Pesanan di dasbor admin (PRD §9.5): saringan status dan rentang tanggal WIB (PRD §9.1), pencarian
// menurut email atau Nomor Pesanan, dan pintasan ke Pesanan Bermasalah, yang tampil menonjol (PRD §5.9).
// Yang terbaru dibuat di atas, 50 Pesanan per halaman.
export default async function HalamanDaftarPesanan({
  searchParams,
}: PageProps<"/admin/pesanan">) {
  await wajibSesiAdmin(await headers());
  const saringan = SaringanAlamat.parse(await searchParams);
  const menyaring =
    saringan.status !== undefined ||
    saringan.dari !== undefined ||
    saringan.sampai !== undefined ||
    saringan.cari !== undefined;
  const tanggalTerbalik =
    saringan.dari !== undefined &&
    saringan.sampai !== undefined &&
    saringan.dari > saringan.sampai;
  const daftar = tanggalTerbalik ? null : await daftarPesanan(saringan);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Pesanan</h1>
        <Link
          href={alamatDaftar({ status: "Bermasalah" }, 1)}
          className="inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-transparent bg-st-masalah-bg px-4 text-sm font-bold text-st-masalah hover:border-monogram"
        >
          <TriangleAlert aria-hidden="true" className="size-6" />
          Pesanan Bermasalah
        </Link>
      </div>

      {/* Form dipasang ulang setiap saringan di alamat berubah, supaya isiannya ikut berganti saat Admin
          memilih pintasan Pesanan Bermasalah atau Hapus saringan, yang berpindah tanpa memuat ulang halaman. */}
      <FormSaringan
        key={alamatDaftar(saringan, 1)}
        saringan={saringan}
        menyaring={menyaring}
      />

      {daftar === null ? (
        <p
          role="alert"
          className="mt-6 flex max-w-[65ch] items-start gap-2 text-[13px] font-bold text-st-masalah"
        >
          <TriangleAlert aria-hidden="true" className="size-6 shrink-0" />
          Tanggal &quot;Dari&quot; jatuh sesudah tanggal &quot;Sampai&quot;,
          jadi tidak ada Pesanan yang bisa cocok. Tukar kedua tanggal, lalu
          tekan Saring lagi.
        </p>
      ) : daftar.jumlah === 0 ? (
        <p className={PESAN}>
          {menyaring
            ? "Tidak ada Pesanan yang cocok dengan saringan ini. Ubah saringannya, atau pilih Hapus saringan untuk melihat semua Pesanan."
            : "Belum ada Pesanan. Pesanan muncul di sini begitu Pembeli checkout."}
        </p>
      ) : (
        <>
          <p className="mt-6 text-[13px] font-bold text-tinta-redup">
            {daftar.jumlah.toLocaleString("id-ID")} Pesanan
          </p>
          {daftar.pesanan.length === 0 ? (
            <p className={PESAN}>
              Halaman {daftar.halaman} kosong, karena daftar ini hanya punya{" "}
              {daftar.jumlahHalaman} halaman. Pilih Sebelumnya untuk kembali.
            </p>
          ) : (
            <TabelPesanan semuaPesanan={daftar.pesanan} />
          )}
          <NavigasiHalaman saringan={saringan} daftar={daftar} />
        </>
      )}
    </>
  );
}
