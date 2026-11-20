import { ChevronLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { RiwayatSaldo } from "@/components/riwayat-saldo";
import { rupiah } from "@/lib/rupiah";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { bacaSaldoMember, riwayatSaldoMember } from "@/server/saldo";

import { PARAMETER_ALAMAT_KEMBALI } from "../../masuk/alamat-kembali";

const ALAMAT = "/akun/riwayat-saldo";

/** Halaman Riwayat saldo dari alamat. Halaman yang kosong atau tidak sah dibaca sebagai halaman pertama. */
const HalamanDariAlamat = z.object({
  halaman: z.coerce.number().int().min(1).catch(1),
});

// Riwayat saldo Member (PRD §15.2, §15.10), dibuka dari tautan "Riwayat saldo" di tab Akun. Hanya untuk Member
// yang login: Tamu diarahkan ke halaman Masuk, lalu kembali ke sini setelah login. Isinya saldo sekarang dan
// tabel waktu, jenis, nominal, saldo, dan rujukan, termasuk keterangan Admin, dengan baris terbaru di atas dan 50
// baris per halaman. Tata letaknya pola Baca, kolom 720 px di tengah, seperti daftar Riwayat Pesanan Member
// (DESIGN.md Tata letak halaman).
export default async function HalamanRiwayatSaldo({
  searchParams,
}: PageProps<"/akun/riwayat-saldo">) {
  const sesiMember = await bacaSesiMember(await headers());
  if (!sesiMember) {
    redirect(
      `/masuk?${new URLSearchParams({ [PARAMETER_ALAMAT_KEMBALI]: ALAMAT })}`,
    );
  }
  const { halaman } = HalamanDariAlamat.parse(await searchParams);
  const idMember = sesiMember.user.id;
  const [saldo, riwayat] = await Promise.all([
    bacaSaldoMember(idMember),
    riwayatSaldoMember({ idMember, halaman }),
  ]);

  return (
    <div className="tata-baca">
      <Link
        href="/akun"
        className="mt-4 inline-flex h-10 items-center gap-1 pr-3 text-[17px] text-pulpen decoration-2 underline-offset-4 hover:underline"
      >
        <ChevronLeft
          aria-hidden="true"
          className="size-6 shrink-0"
          strokeWidth={2.5}
        />
        Akun
      </Link>
      <h1 className="mt-2">Riwayat saldo</h1>
      <p className="mt-2 mb-6 font-spidol text-[22px] font-bold tabular-nums">
        Saldo {rupiah(saldo?.saldo ?? 0)}
      </p>
      <RiwayatSaldo
        riwayat={riwayat}
        judul="Riwayat saldo"
        alamatHalaman={(nomor) =>
          nomor > 1 ? `${ALAMAT}?halaman=${nomor}` : ALAMAT
        }
      />
    </div>
  );
}
