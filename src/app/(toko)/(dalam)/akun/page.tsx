import { History, Plus, QrCode } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";

import { rupiah } from "@/lib/rupiah";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { bacaSaldoMember } from "@/server/saldo";
import { bacaTopUpMenunggu } from "@/server/top-up";

import { TombolWhatsApp } from "../../_components/tombol-whatsapp";
import { TombolMasukDaftar } from "../../_components/tombol-masuk-daftar";
import { FormGantiPassword } from "./_components/form-ganti-password";
import { KontrolMode } from "./_components/kontrol-mode";
import { aksiKeluarMember } from "./aksi";

// Tab Akun (PRD §11.1). Member yang login melihat emailnya, form ganti password (T46, PRD §7.6), dan
// tombol "Keluar" (T41). Di antara email dan form ganti password ada kotak "Saldo Rp X" dengan tombol "Top up",
// tautan "Riwayat saldo", dan Top up yang menunggu pembayaran bila ada (PRD §15.10). Email tidak bisa diganti dan
// tidak ada hapus akun (PRD §7.6). Tamu melihat tombol "Masuk" dan "Daftar" (PRD §11.1 ▶ Keputusan 2026-11-17).
// Setelahnya ada bagian "Tampilan" dengan pilihan mode, untuk Tamu dan Member (PRD §11.3 ▶ Keputusan 2026-11-18),
// lalu tombol WhatsApp. Tautan Syarat & Ketentuan dan Kebijakan Privasi tidak diulang di sini karena footer toko
// sudah menampilkannya tepat di bawah (PRD §11.1 ▶ Keputusan 2026-11-20).
//
// Tata letak Fokus (DESIGN.md Tata letak halaman): satu kolom 560 px di tengah dengan judul di dalamnya.
// Kartu dan tombol selebar kolom, antarbagian 24 px dan antarkartu dalam bagian Member 16 px.
export default async function HalamanAkun() {
  // Nomor WhatsApp dibaca setiap kali halaman dibuka, supaya perubahan Admin langsung tampil.
  await connection();
  const [sesiMember, { nomorWhatsapp }] = await Promise.all([
    bacaSesiMember(await headers()),
    bacaPengaturanToko(),
  ]);

  return (
    <div className="tata-fokus">
      <h1 className="mt-4">Akun</h1>
      <div className="mt-6 flex flex-col gap-6">
        {sesiMember ? (
          <div className="flex flex-col gap-4">
            <section aria-label="Member" className="kartu p-5">
              <p className="text-[16px] text-pensil-redup">Email</p>
              <p className="font-spidol text-[22px] leading-snug font-bold [overflow-wrap:anywhere]">
                {sesiMember.user.email}
              </p>
            </section>
            <KotakSaldo idMember={sesiMember.user.id} />
            <FormGantiPassword />
            <form action={aksiKeluarMember}>
              <button type="submit" className="tombol tombol-kedua w-full">
                Keluar
              </button>
            </form>
          </div>
        ) : (
          <TombolMasukDaftar />
        )}
        <KontrolMode />
        <TombolWhatsApp nomor={nomorWhatsapp}>
          Hubungi kami di WhatsApp
        </TombolWhatsApp>
      </div>
    </div>
  );
}

/**
 * Kotak "Saldo Rp X" Member yang login (PRD §15.10), dengan tombol "Top up" yang membuka Halaman Top up dan tautan
 * "Riwayat saldo". Selama Member punya Top up Menunggu Pembayaran, kotak ini juga menampilkan "Top up Rp X menunggu
 * pembayaran" dengan tombol "Lanjutkan bayar" yang membuka Halaman bayar Top up itu.
 */
async function KotakSaldo({ idMember }: { idMember: string }) {
  const [saldo, menunggu] = await Promise.all([
    bacaSaldoMember(idMember),
    bacaTopUpMenunggu(idMember),
  ]);
  return (
    <section aria-label="Saldo" className="kartu flex flex-col gap-4 p-5">
      <p className="font-spidol text-[22px] leading-snug font-bold tabular-nums">
        Saldo {rupiah(saldo?.saldo ?? 0)}
      </p>
      {menunggu && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-coret-md border-2 border-dashed border-pensil p-3">
          <p className="text-[17px]">
            Top up {rupiah(menunggu.nominalTopUp)} menunggu pembayaran
          </p>
          <Link
            href={`/akun/top-up/${menunggu.nomorTopUp}`}
            className="tombol tombol-kecil"
          >
            <QrCode aria-hidden="true" className="size-5" strokeWidth={2.5} />
            Lanjutkan bayar
          </Link>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Link href="/akun/top-up" className="tombol tombol-kecil">
          <Plus aria-hidden="true" className="size-5" strokeWidth={2.5} />
          Top up
        </Link>
        <Link
          href="/akun/riwayat-saldo"
          className="tombol tombol-kecil tombol-kedua"
        >
          <History aria-hidden="true" className="size-5" strokeWidth={2.5} />
          Riwayat saldo
        </Link>
      </div>
    </section>
  );
}
