import { headers } from "next/headers";
import { connection } from "next/server";

import { bacaSesiMember } from "@/server/auth/sesi-member";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";

import { TombolWhatsApp } from "../../_components/tombol-whatsapp";
import { TombolMasukDaftar } from "../../_components/tombol-masuk-daftar";
import { FormGantiPassword } from "./_components/form-ganti-password";
import { KontrolMode } from "./_components/kontrol-mode";
import { aksiKeluarMember } from "./aksi";

// Tab Akun (PRD §11.1). Member yang login melihat emailnya, form ganti password (T46, PRD §7.6), dan
// tombol "Keluar" (T41). Email tidak bisa diganti dan tidak ada hapus akun (PRD §7.6). Tamu melihat tombol
// "Masuk" dan "Daftar" (PRD §11.1 ▶ Keputusan 2026-11-17). Setelahnya ada bagian "Tampilan" dengan pilihan
// mode, untuk Tamu dan Member (PRD §11.3 ▶ Keputusan 2026-11-18), lalu tombol WhatsApp. Tautan Syarat &
// Ketentuan dan Kebijakan Privasi tidak diulang di sini karena footer toko sudah menampilkannya tepat di
// bawah (PRD §11.1 ▶ Keputusan 2026-11-20).
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
