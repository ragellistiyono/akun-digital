import { headers } from "next/headers";
import Link from "next/link";
import { z } from "zod";

import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarMember } from "@/server/daftar-member";
import { tanggalWib } from "@/server/zona-waktu-toko";

import { KELAS_ISIAN } from "../_components/isian-form";

const ALAMAT = "/admin/member";

// Kata cari dari alamat. Kata cari yang kosong atau tidak sah diabaikan.
const PencarianAlamat = z.object({
  cari: z.string().trim().min(1).optional().catch(undefined),
});

const KELAS_TOMBOL_KECIL_GARIS =
  "inline-flex h-10 items-center rounded-[12px] border-[1.5px] border-garis bg-permukaan px-4 text-sm font-bold hover:border-monogram";

/** Form pencarian Member menurut sebagian email (PRD §2.3 ▶ Keputusan 2026-11-17). Dikirim sebagai GET. */
function FormCari({ cari }: { cari: string | undefined }) {
  return (
    <form
      action={ALAMAT}
      role="search"
      aria-label="Cari Member"
      className="mt-6 flex max-w-[1120px] flex-wrap items-end gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <label htmlFor="cari" className="text-sm font-bold">
          Cari email
        </label>
        <input
          id="cari"
          name="cari"
          type="search"
          defaultValue={cari ?? ""}
          placeholder="Sebagian email"
          autoComplete="off"
          className={cn(KELAS_ISIAN, "h-10 w-full min-w-0")}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-[12px] bg-aksi px-4 text-sm font-bold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98]"
        >
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

/**
 * Tabel Member dengan kolom PRD §2.3. Tabelnya bergulir ke samping di dalam panelnya sendiri pada layar
 * sempit, supaya halaman tidak ikut bergulir ke samping (PRD §11.1).
 */
function TabelMember({
  semuaMember,
}: {
  semuaMember: Awaited<ReturnType<typeof daftarMember>>;
}) {
  return (
    <div className="mt-4 max-w-[1120px] overflow-x-auto rounded-[20px] bg-permukaan px-4 py-2 shadow-bayang">
      <table className="w-full min-w-[640px] text-left">
        <caption className="sr-only">Daftar Member</caption>
        <thead className="text-[13px] font-bold text-tinta-redup">
          <tr className="border-b border-garis">
            <th scope="col" className="min-w-48 py-2 pr-4">
              Email
            </th>
            <th scope="col" className="py-2 pr-4">
              Tanggal daftar (WIB)
            </th>
            <th scope="col" className="py-2 pr-4 text-right">
              Pesanan Selesai
            </th>
            <th scope="col" className="py-2 text-right">
              Total belanja
            </th>
          </tr>
        </thead>
        <tbody>
          {semuaMember.map((member) => (
            <tr
              key={member.id}
              className="border-b border-garis align-top last:border-b-0"
            >
              <th
                scope="row"
                className="py-3 pr-4 font-bold [overflow-wrap:anywhere]"
              >
                {member.email}
              </th>
              <td className="py-3 pr-4 whitespace-nowrap">
                {tanggalWib(member.terdaftarPada)}
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                {member.belanja.jumlahPesananSelesai.toLocaleString("id-ID")}
              </td>
              <td className="py-3 text-right font-bold whitespace-nowrap tabular-nums">
                {rupiah(member.belanja.totalBelanja)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PESAN = "mt-6 max-w-[65ch] text-tinta-redup";

// Daftar Member di dasbor admin (PRD §2.3 ▶ Keputusan 2026-11-17): Member terverifikasi, terbaru di atas,
// dengan email, tanggal daftar dalam WIB (PRD §9.1), jumlah Pesanan Selesai, dan total belanja, serta
// pencarian menurut sebagian email. Password Member tidak dibaca maupun ditampilkan.
export default async function HalamanDaftarMember({
  searchParams,
}: PageProps<"/admin/member">) {
  await wajibSesiAdmin(await headers());
  const { cari } = PencarianAlamat.parse(await searchParams);
  const semuaMember = await daftarMember({ cari });

  return (
    <>
      <h1>Member</h1>

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
          <p className="mt-6 text-[13px] font-bold text-tinta-redup">
            {semuaMember.length.toLocaleString("id-ID")} Member
          </p>
          <TabelMember semuaMember={semuaMember} />
        </>
      )}
    </>
  );
}
