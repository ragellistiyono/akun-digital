import { headers } from "next/headers";
import Link from "next/link";
import { z } from "zod";

import { PilStatusTopUp } from "@/components/pil-status-top-up";
import { STATUS_TOP_UP } from "@/domain/status-top-up";
import { rupiah } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarTopUp } from "@/server/top-up-admin";
import { waktuWib } from "@/server/zona-waktu-toko";

const ALAMAT = "/admin/top-up";

// Saringan dari alamat. Nilai yang tidak sah, termasuk isian yang dikosongkan, diabaikan.
const SaringanAlamat = z.object({
  status: z.enum(STATUS_TOP_UP).optional().catch(undefined),
  cari: z.string().trim().min(1).optional().catch(undefined),
  halaman: z.coerce.number().int().min(1).optional().catch(undefined),
});

type Saringan = z.infer<typeof SaringanAlamat>;

/** Alamat daftar Top up dengan saringan itu dan halaman itu. */
function alamatDaftar(saringan: Saringan, halaman: number) {
  const parameter = new URLSearchParams();
  for (const kunci of ["status", "cari"] as const) {
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

/** Tombol kecil 40 px untuk aksi kedua (kelas `tombol-kecil` di globals.css). */
const KELAS_TOMBOL_KECIL_GARIS = "tombol tombol-kedua tombol-kecil";

/** Label isian saringan. */
const KELAS_LABEL = "text-[17px] leading-tight";

/**
 * Form saringan status dan pencarian (PRD §15.9), dikirim sebagai GET ke alamat ini. Di ponsel setiap isian sebaris
 * penuh dan tombol turun ke bawahnya. Mulai 640 px Status, Cari yang dua kali lebih lebar, lalu tombol selebar isinya
 * berbagi satu baris, rata bawah.
 */
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
      aria-label="Saring Top up"
      className="kartu grid items-end gap-4 p-4 min-[640px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
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
          {STATUS_TOP_UP.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div className={KELAS_KOLOM_SARINGAN}>
        <label htmlFor="cari" className={KELAS_LABEL}>
          Cari
        </label>
        <input
          id="cari"
          name="cari"
          type="search"
          defaultValue={saringan.cari ?? ""}
          placeholder="Email atau Nomor Top up"
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
    </form>
  );
}

type HasilDaftar = Awaited<ReturnType<typeof daftarTopUp>>;

/**
 * Tabel Top up dengan kolom PRD §15.9. Nomor Top up setiap baris membuka detail Top up, dan Top up Bermasalah
 * ditonjolkan oleh pil status berwarna Bermasalah. Tabelnya bergulir ke samping di dalam panelnya sendiri pada layar
 * sempit, supaya halaman tidak ikut bergulir ke samping (PRD §11.1).
 */
function TabelTopUp({ semuaTopUp }: { semuaTopUp: HasilDaftar["topUp"] }) {
  return (
    <div className="kartu mt-4 p-4">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[880px] text-left">
          <caption className="sr-only">Daftar Top up</caption>
          <thead className="font-spidol text-base font-bold text-pensil-redup">
            <tr className="border-b-2 border-dashed border-pensil">
              <th scope="col" className="py-2 pr-4">
                Nomor Top up
              </th>
              <th scope="col" className="py-2 pr-4">
                Waktu dibuat (WIB)
              </th>
              <th scope="col" className="min-w-48 py-2 pr-4">
                Email Member
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                Nominal top up
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
            {semuaTopUp.map((satu) => (
              <tr
                key={satu.nomorTopUp}
                className="border-b-2 border-dashed border-pensil align-top last:border-b-0"
              >
                <th
                  scope="row"
                  className="py-3 pr-4 font-mono text-[15px] font-bold whitespace-nowrap"
                >
                  <Link
                    href={`${ALAMAT}/${satu.nomorTopUp}`}
                    className="inline-flex min-h-6 items-center text-pulpen underline-offset-4 hover:underline"
                  >
                    {satu.nomorTopUp}
                  </Link>
                </th>
                <td className="py-3 pr-4 whitespace-nowrap">
                  {satu.waktuDibuat ? waktuWib(satu.waktuDibuat) : "—"}
                </td>
                <td className="py-3 pr-4 [overflow-wrap:anywhere]">
                  {satu.email}
                </td>
                <td className="py-3 pr-4 text-right whitespace-nowrap">
                  {rupiah(satu.nominalTopUp)}
                </td>
                <td className="py-3 pr-4 text-right font-spidol font-bold whitespace-nowrap">
                  {rupiah(satu.totalBayar)}
                </td>
                <td className="py-3">
                  <PilStatusTopUp status={satu.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      aria-label="Halaman daftar Top up"
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

// Daftar Top up di dasbor admin (PRD §15.9): saringan status dan pencarian sebagian email Member atau sebagian Nomor
// Top up tanpa membedakan huruf besar dan kecil, seperti daftar Pesanan (PRD §9.5). Yang terbaru dibuat di atas, 50 Top
// up per halaman. Admin tidak bisa membuat atau membatalkan Top up di sini (PRD §15.9).
export default async function HalamanDaftarTopUp({
  searchParams,
}: PageProps<"/admin/top-up">) {
  await wajibSesiAdmin(await headers());
  const saringan = SaringanAlamat.parse(await searchParams);
  const menyaring =
    saringan.status !== undefined || saringan.cari !== undefined;
  const daftar = await daftarTopUp(saringan);

  return (
    <>
      <div className="kepala-halaman">
        <h1>Top up</h1>
      </div>

      {/* Form dipasang ulang setiap saringan di alamat berubah, supaya isiannya ikut berganti saat Admin memilih
          Hapus saringan, yang berpindah tanpa memuat ulang halaman. */}
      <FormSaringan
        key={alamatDaftar(saringan, 1)}
        saringan={saringan}
        menyaring={menyaring}
      />

      {daftar.jumlah === 0 ? (
        <p className={PESAN}>
          {menyaring
            ? "Tidak ada Top up yang cocok dengan saringan ini. Ubah saringannya, atau pilih Hapus saringan untuk melihat semua Top up."
            : 'Belum ada Top up. Top up muncul di sini begitu Member menekan "Bayar dengan QRIS" di halaman Top up.'}
        </p>
      ) : (
        <>
          <p className="mt-6 text-[15px] text-pensil-redup">
            {daftar.jumlah.toLocaleString("id-ID")} Top up
          </p>
          {daftar.topUp.length === 0 ? (
            <p className={PESAN}>
              Halaman {daftar.halaman} kosong, karena daftar ini hanya punya{" "}
              {daftar.jumlahHalaman} halaman. Pilih Sebelumnya untuk kembali.
            </p>
          ) : (
            <TabelTopUp semuaTopUp={daftar.topUp} />
          )}
          <NavigasiHalaman saringan={saringan} daftar={daftar} />
        </>
      )}
    </>
  );
}
