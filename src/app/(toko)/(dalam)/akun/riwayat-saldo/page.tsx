import { ChevronLeft } from "lucide-react";
import { cookies, headers } from "next/headers";
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
import { HapusPesanTopUp } from "./_components/hapus-pesan-top-up";
import { JENIS_PESAN_TOP_UP, PESAN_TOP_UP } from "./pesan-top-up";

const ALAMAT = "/akun/riwayat-saldo";

/** Halaman Riwayat saldo dari alamat. Halaman yang kosong atau tidak sah dibaca sebagai halaman pertama. */
const HalamanDariAlamat = z.object({
  halaman: z.coerce.number().int().min(1).catch(1),
});

/** Isi cookie pesan Top up: jenis pesan dan Nomor Top up, dipisah titik dua. */
const IsiPesanTopUp = z.object({
  jenis: z.enum(JENIS_PESAN_TOP_UP),
  nomorTopUp: z.string().refine(nomorTopUpSah),
});

/**
 * Pesan sekali tampil dari cookie pesan Top up (PRD §15.3 ▶ Keputusan 2026-11-21, issue 240), hanya bila Top up dengan
 * Nomor Top up itu Berhasil dan milik Member itu. Hasilnya null bila tidak ada pesan yang perlu tampil.
 */
async function pesanTopUp(isiCookie: string | undefined, idMember: string) {
  if (isiCookie === undefined) return null;
  const [jenis, nomorTopUp] = isiCookie.split(":");
  const pesan = IsiPesanTopUp.safeParse({ jenis, nomorTopUp });
  if (!pesan.success) return null;
  const topUp = await bacaTopUpMember({
    nomorTopUp: pesan.data.nomorTopUp,
    idMember,
  });
  if (topUp?.status !== "Berhasil") return null;
  return { jenis: pesan.data.jenis, nominalTopUp: topUp.rincian.nominalTopUp };
}

// Riwayat saldo Member (PRD §15.2, §15.10), dibuka dari tautan "Riwayat saldo" di tab Akun. Hanya untuk Member
// yang login: Tamu diarahkan ke halaman Masuk, lalu kembali ke sini setelah login. Isinya saldo sekarang dan
// tabel waktu, jenis, nominal, saldo, dan rujukan, termasuk keterangan Admin, dengan baris terbaru di atas dan 50
// baris per halaman. Tata letaknya pola Baca, kolom 720 px di tengah, seperti daftar Riwayat Pesanan Member
// (DESIGN.md Tata letak halaman). Tepat setelah Halaman bayar Top up berpindah sendiri karena pembayarannya masuk,
// halaman ini sekali menampilkan "Top up Rp X berhasil. Saldo sekarang Rp Y."; tepat setelah "Batalkan" yang tidak
// membatalkan Top up Berhasil, sebagai gantinya sekali menampilkan "Pembayaran Anda sudah masuk, jadi Top up tidak
// dibatalkan." (PRD §15.3 ▶ Keputusan 2026-11-21, issue 240; lihat pesan-top-up.ts).
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
  const isiCookiePesan = (await cookies()).get(PESAN_TOP_UP.nama)?.value;
  const [saldo, riwayat, pesan] = await Promise.all([
    bacaSaldoMember(idMember),
    riwayatSaldoMember({ idMember, halaman }),
    pesanTopUp(isiCookiePesan, idMember),
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
      {isiCookiePesan !== undefined && <HapusPesanTopUp />}
      <h1 className="mt-2">Riwayat saldo</h1>
      {pesan !== null && (
        <p role="status" className="mt-4 max-w-[65ch] text-st-selesai">
          {pesan.jenis === "berhasil"
            ? `Top up ${rupiah(pesan.nominalTopUp)} berhasil. Saldo sekarang ${rupiah(saldo?.saldo ?? 0)}.`
            : "Pembayaran Anda sudah masuk, jadi Top up tidak dibatalkan."}
        </p>
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
