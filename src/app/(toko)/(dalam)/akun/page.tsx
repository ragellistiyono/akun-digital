import { headers } from "next/headers";
import { connection } from "next/server";

import { bacaSesiMember } from "@/server/auth/sesi-member";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";

import { TautanHalamanHukum } from "../../_components/tautan-halaman-hukum";
import { TombolWhatsApp } from "../../_components/tombol-whatsapp";
import { aksiKeluarMember } from "./aksi";

// Tab Akun (PRD §11.1). Member yang login melihat emailnya dan tombol "Keluar" (T41), di atas tombol
// WhatsApp serta tautan Syarat & Ketentuan dan Kebijakan Privasi. Tamu melihat isi sebelum M2:
// tombol Masuk dan Daftar untuk Tamu baru dipasang di T51 (PRD §13 ▶ Keputusan 2026-11-17).
export default async function HalamanAkun() {
  // Nomor WhatsApp dibaca setiap kali halaman dibuka, supaya perubahan Admin langsung tampil.
  await connection();
  const [sesiMember, { nomorWhatsapp }] = await Promise.all([
    bacaSesiMember(await headers()),
    bacaPengaturanToko(),
  ]);

  return (
    <>
      <h1 className="mt-4">Akun</h1>
      <div className="mt-6 flex flex-col items-start gap-6">
        {sesiMember && (
          <div className="flex w-full max-w-[440px] flex-col gap-4">
            <section
              aria-label="Member"
              className="rounded-[20px] bg-permukaan p-4 shadow-bayang"
            >
              <p className="text-[13px] font-bold text-tinta-redup">Email</p>
              <p className="font-extrabold [overflow-wrap:anywhere]">
                {sesiMember.user.email}
              </p>
            </section>
            <form action={aksiKeluarMember}>
              <button
                type="submit"
                className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-garis bg-permukaan px-6 text-base font-extrabold text-tinta hover:border-monogram"
              >
                Keluar
              </button>
            </form>
          </div>
        )}
        <TombolWhatsApp nomor={nomorWhatsapp}>
          Hubungi kami di WhatsApp
        </TombolWhatsApp>
        <TautanHalamanHukum />
      </div>
    </>
  );
}
