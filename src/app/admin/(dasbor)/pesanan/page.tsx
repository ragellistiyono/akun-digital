import { TriangleAlert } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { z } from "zod";

import { STATUS_PESANAN } from "@/domain/status-pesanan";
import { cn } from "@/lib/utils";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarPesanan } from "@/server/daftar-pesanan";

import { TabelPesanan } from "./_components/tabel-pesanan";

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
const KELAS_ISIAN_SARINGAN = "isian h-10 min-h-10 w-full min-w-0";

/** Satu isian saringan dengan labelnya. */
const KELAS_KOLOM_SARINGAN = "flex min-w-0 flex-col gap-2";

/**
 * Susunan form saringan. Di ponsel setiap isian sebaris penuh. Mulai 640 px Status dan kedua tanggal berbagi
 * baris pertama sama lebar, lalu Cari dan tombolnya mengisi baris kedua. Mulai 1400 px, saat isi hampir selebar
 * 1120 px, semuanya satu baris: tiga isian sama lebar, Cari dua kali lebih lebar, lalu tombol selebar isinya.
 * Tombol selalu rata bawah dengan isian. Varian `min-[…px]` dipakai, bukan `sm:`, supaya urutannya di CSS tetap
 * menaik bersama `lebar:` (px).
 */
const KELAS_FORM_SARINGAN =
  "kartu grid items-end gap-4 p-4 min-[640px]:grid-cols-3 min-[1400px]:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)_auto]";

/**
 * Pembungkus Cari dan tombolnya. Di ponsel tombol turun ke bawah Cari bila tidak muat. Mulai 640 px keduanya
 * sebaris selebar form, dan mulai 1400 px pembungkus ini lebur (`contents`) sehingga Cari dan tombol menjadi
 * lajur grid sendiri.
 */
const KELAS_BARIS_CARI =
  "flex flex-wrap items-end gap-4 min-[640px]:col-span-3 min-[640px]:flex-nowrap min-[1400px]:contents";

/** Tombol kecil 40 px untuk aksi kedua (kelas `tombol-kecil` di globals.css). */
const KELAS_TOMBOL_KECIL_GARIS = "tombol tombol-kedua tombol-kecil";

/** Label isian saringan. */
const KELAS_LABEL = "text-[17px] leading-tight";

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
      className={KELAS_FORM_SARINGAN}
    >
      <div className={KELAS_KOLOM_SARINGAN}>
        <label htmlFor="status" className={KELAS_LABEL}>
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
        <label htmlFor="dari" className={KELAS_LABEL}>
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
        <label htmlFor="sampai" className={KELAS_LABEL}>
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
      <div className={KELAS_BARIS_CARI}>
        <div className={cn(KELAS_KOLOM_SARINGAN, "flex-[1_1_14rem]")}>
          <label htmlFor="cari" className={KELAS_LABEL}>
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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="submit" className="tombol tombol-kecil">
            Saring
          </button>
          {menyaring && (
            <Link href={ALAMAT} className={KELAS_TOMBOL_KECIL_GARIS}>
              Hapus saringan
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}

type HasilDaftar = Awaited<ReturnType<typeof daftarPesanan>>;

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
      <p className="px-2 text-[15px] text-pensil-redup">
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

const PESAN = "mt-6 max-w-[65ch] text-pensil-redup";

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
      <div className="kepala-halaman">
        <h1>Pesanan</h1>
        <Link
          href={alamatDaftar({ status: "Bermasalah" }, 1)}
          className="chip bg-st-masalah-bg text-st-masalah"
        >
          <TriangleAlert
            aria-hidden="true"
            className="size-6"
            strokeWidth={2.5}
          />
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
          className="mt-6 flex max-w-[65ch] items-start gap-2 text-base text-aksi"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
            strokeWidth={2.5}
          />
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
          <p className="mt-6 text-[15px] text-pensil-redup">
            {daftar.jumlah.toLocaleString("id-ID")} Pesanan
          </p>
          {daftar.pesanan.length === 0 ? (
            <p className={PESAN}>
              Halaman {daftar.halaman} kosong, karena daftar ini hanya punya{" "}
              {daftar.jumlahHalaman} halaman. Pilih Sebelumnya untuk kembali.
            </p>
          ) : (
            <TabelPesanan
              semuaPesanan={daftar.pesanan}
              judul="Daftar Pesanan"
            />
          )}
          <NavigasiHalaman saringan={saringan} daftar={daftar} />
        </>
      )}
    </>
  );
}
