import { ChevronLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { RiwayatSaldo } from "@/components/riwayat-saldo";
import { nomorTopUpSah } from "@/domain/nomor-top-up";
import { rupiah } from "@/lib/rupiah";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { bacaSaldoMember, riwayatSaldoMember } from "@/server/saldo";
import { bacaTopUpMember } from "@/server/top-up";

import { PARAMETER_ALAMAT_KEMBALI } from "../../masuk/alamat-kembali";
import { PARAMETER_TOP_UP_BERHASIL } from "./top-up-berhasil";

const ALAMAT = "/akun/riwayat-saldo";

/** Halaman Riwayat saldo dari alamat. Halaman yang kosong atau tidak sah dibaca sebagai halaman pertama. */
const HalamanDariAlamat = z.object({
  halaman: z.coerce.number().int().min(1).catch(1),
  [PARAMETER_TOP_UP_BERHASIL]: z
    .string()
    .refine(nomorTopUpSah)
    .optional()
    .catch(undefined),
});

/**
 * Nominal top up dari Top up dengan Nomor Top up itu, bila Top up itu Berhasil dan milik Member itu, atau null bila
 * tidak ada pesan Top up berhasil yang perlu tampil.
 */
async function nominalTopUpBerhasil(
  nomorTopUp: string | undefined,
  idMember: string,
) {
  if (!nomorTopUp) return null;
  const topUp = await bacaTopUpMember({ nomorTopUp, idMember });
  return topUp?.status === "Berhasil" ? topUp.rincian.nominalTopUp : null;
}

// Riwayat saldo Member (PRD §15.2, §15.10), dibuka dari tautan "Riwayat saldo" di tab Akun. Hanya untuk Member
// yang login: Tamu diarahkan ke halaman Masuk, lalu kembali ke sini setelah login. Isinya saldo sekarang dan
// tabel waktu, jenis, nominal, saldo, dan rujukan, termasuk keterangan Admin, dengan baris terbaru di atas dan 50
// baris per halaman. Tata letaknya pola Baca, kolom 720 px di tengah, seperti daftar Riwayat Pesanan Member
// (DESIGN.md Tata letak halaman). Halaman bayar Top up yang berpindah sendiri karena Top up-nya Berhasil membawa
// Nomor Top up itu di alamat, dan selama itu halaman ini dibuka dengan pesan "Top up Rp X berhasil. Saldo sekarang
// Rp Y." (PRD §15.3).
export default async function HalamanRiwayatSaldo({
  searchParams,
}: PageProps<"/akun/riwayat-saldo">) {
  const sesiMember = await bacaSesiMember(await headers());
  if (!sesiMember) {
    redirect(
      `/masuk?${new URLSearchParams({ [PARAMETER_ALAMAT_KEMBALI]: ALAMAT })}`,
    );
  }
  const alamat = HalamanDariAlamat.parse(await searchParams);
  const { halaman } = alamat;
  const idMember = sesiMember.user.id;
  const [saldo, riwayat, topUpBerhasil] = await Promise.all([
    bacaSaldoMember(idMember),
    riwayatSaldoMember({ idMember, halaman }),
    nominalTopUpBerhasil(alamat[PARAMETER_TOP_UP_BERHASIL], idMember),
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
      {topUpBerhasil !== null && (
        <div role="status" className="kartu mt-4 p-4">
          <p className="max-w-[65ch]">
            Top up {rupiah(topUpBerhasil)} berhasil. Saldo sekarang{" "}
            {rupiah(saldo?.saldo ?? 0)}.
          </p>
        </div>
      )}
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
