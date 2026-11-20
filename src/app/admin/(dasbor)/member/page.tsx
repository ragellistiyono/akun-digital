import { headers } from "next/headers";
import Link from "next/link";
import { z } from "zod";

import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarMember } from "@/server/daftar-member";
import { tanggalWib } from "@/server/zona-waktu-toko";

import { KELAS_ISIAN } from "../_components/isian-form";
import { PilAktif } from "../_components/pil";
import { aksiUbahStatusMember } from "./aksi";

const ALAMAT = "/admin/member";

// Kata cari dari alamat. Kata cari yang kosong atau tidak sah diabaikan.
const PencarianAlamat = z.object({
  cari: z.string().trim().min(1).optional().catch(undefined),
});

/** Tombol kecil 40 px untuk aksi kedua (DESIGN.md Buttons). */
const KELAS_TOMBOL_KECIL_GARIS = "tombol tombol-kecil tombol-kedua";

/**
 * Form pencarian Member menurut sebagian email (PRD §2.3 ▶ Keputusan 2026-11-17). Dikirim sebagai GET. Isian dan
 * tombolnya sebaris dan rata bawah; di ponsel tombol turun ke bawah isian bila tidak muat.
 */
function FormCari({ cari }: { cari: string | undefined }) {
  return (
    <form
      action={ALAMAT}
      role="search"
      aria-label="Cari Member"
      className="kartu flex flex-wrap items-end gap-4 p-4 min-[640px]:flex-nowrap"
    >
      <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-2">
        <label htmlFor="cari" className="text-[17px] leading-tight">
          Cari email
        </label>
        <input
          id="cari"
          name="cari"
          type="search"
          defaultValue={cari ?? ""}
          placeholder="Sebagian email"
          autoComplete="off"
          className={cn(KELAS_ISIAN, "h-10 min-h-10 w-full min-w-0")}
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button type="submit" className="tombol tombol-kecil">
          Cari
        </button>
        {cari !== undefined && (
          <Link href={ALAMAT} className={KELAS_TOMBOL_KECIL_GARIS}>
            Hapus pencarian
          </Link>
        )}
      </div>
    </form>
  );
}

/** Tombol kecil 40 px untuk aksi kedua (DESIGN.md Buttons). */
const KELAS_TOMBOL_KECIL = "tombol tombol-kecil tombol-kedua whitespace-nowrap";

/**
 * Tombol "Nonaktifkan" atau "Aktifkan kembali" untuk satu Member (PRD §2.3). Aksi ini bisa dibalik, jadi
 * langsung dijalankan tanpa penegasan (DESIGN.md Navigation). Kewenangannya diperiksa di Server Action.
 */
function TombolStatusMember({
  member,
}: {
  member: { id: string; email: string; nonaktif: boolean };
}) {
  return (
    <form action={aksiUbahStatusMember}>
      <input type="hidden" name="idMember" value={member.id} />
      <input
        type="hidden"
        name="status"
        value={member.nonaktif ? "aktif" : "nonaktif"}
      />
      <button type="submit" className={KELAS_TOMBOL_KECIL}>
        {member.nonaktif ? "Aktifkan kembali" : "Nonaktifkan"}
        <span className="sr-only"> {member.email}</span>
      </button>
    </form>
  );
}

/**
 * Tabel Member dengan kolom PRD §2.3 dan kolom Saldo (PRD §15.6), termasuk status Aktif atau Nonaktif beserta
 * tombol untuk mengubahnya. Kartunya selebar isi halaman. Tabelnya bergulir ke samping di dalam kartunya sendiri
 * pada layar sempit, supaya halaman tidak ikut bergulir ke samping (PRD §11.1). Kartu itu `relative`, supaya teks
 * khusus pembaca layar di tombol status ikut terpotong olehnya dan tidak melebarkan halaman.
 */
function TabelMember({
  semuaMember,
}: {
  semuaMember: Awaited<ReturnType<typeof daftarMember>>;
}) {
  return (
    <div className="kartu relative mt-4 overflow-x-auto px-4 py-2">
      <table className="w-full min-w-[1000px] text-left">
        <caption className="sr-only">Daftar Member</caption>
        <thead className="font-spidol text-[16px] font-bold text-pensil-redup">
          <tr className="border-b-2 border-dashed border-pensil">
            <th scope="col" className="min-w-48 py-2 pr-4">
              Email
            </th>
            <th scope="col" className="py-2 pr-4">
              Tanggal daftar (WIB)
            </th>
            <th scope="col" className="py-2 pr-4 text-right">
              Pesanan Selesai
            </th>
            <th scope="col" className="py-2 pr-4 text-right">
              Total belanja
            </th>
            <th scope="col" className="py-2 pr-4 text-right">
              Saldo
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
          {semuaMember.map((member) => (
            <tr
              key={member.id}
              className="border-b-2 border-dashed border-pensil align-top last:border-b-0"
            >
              <th
                scope="row"
                className="py-3 pr-4 font-normal [overflow-wrap:anywhere]"
              >
                {/* Email membuka Riwayat Pesanan Member itu (PRD §2.3 ▶ Keputusan 2026-11-17). */}
                <Link
                  href={`${ALAMAT}/${member.id}`}
                  className="inline-flex min-h-6 items-center text-pulpen decoration-2 underline-offset-4 hover:underline"
                >
                  {member.email}
                </Link>
              </th>
              <td className="py-3 pr-4 whitespace-nowrap">
                {tanggalWib(member.terdaftarPada)}
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                {member.belanja.jumlahPesananSelesai.toLocaleString("id-ID")}
              </td>
              <td className="py-3 pr-4 text-right font-spidol font-bold whitespace-nowrap tabular-nums">
                {rupiah(member.belanja.totalBelanja)}
              </td>
              <td className="py-3 pr-4 text-right font-spidol font-bold whitespace-nowrap tabular-nums">
                {rupiah(member.saldo)}
              </td>
              <td className="py-3 pr-4">
                <PilAktif aktif={!member.nonaktif} />
              </td>
              <td className="py-2 text-right">
                <TombolStatusMember member={member} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PESAN = "mt-6 max-w-[65ch] text-pensil-redup";

// Daftar Member di dasbor admin (PRD §2.3 ▶ Keputusan 2026-11-17): Member terverifikasi, terbaru di atas,
// dengan email, tanggal daftar dalam WIB (PRD §9.1), jumlah Pesanan Selesai, total belanja, dan status Aktif
// atau Nonaktif beserta tombol untuk menonaktifkan atau mengaktifkannya kembali, serta pencarian menurut
// sebagian email. Password Member tidak dibaca maupun ditampilkan.
export default async function HalamanDaftarMember({
  searchParams,
}: PageProps<"/admin/member">) {
  await wajibSesiAdmin(await headers());
  const { cari } = PencarianAlamat.parse(await searchParams);
  const semuaMember = await daftarMember({ cari });

  return (
    <>
      <div className="kepala-halaman">
        <h1>Member</h1>
      </div>

      {/* Form dipasang ulang setiap kata cari berubah, supaya isiannya kosong lagi setelah Hapus pencarian,
          yang berpindah tanpa memuat ulang halaman. */}
      <FormCari key={cari ?? ""} cari={cari} />

      {semuaMember.length === 0 ? (
        <p className={PESAN}>
          {cari === undefined
            ? "Belum ada Member. Member muncul di sini begitu Pembeli memasukkan Kode verifikasi yang benar."
            : `Tidak ada Member yang emailnya memuat "${cari}". Periksa ejaannya, atau pilih Hapus pencarian untuk melihat semua Member.`}
        </p>
      ) : (
        <>
          <p className="mt-6 text-[15px] text-pensil-redup">
            {semuaMember.length.toLocaleString("id-ID")} Member
          </p>
          <TabelMember semuaMember={semuaMember} />
        </>
      )}
    </>
  );
}
