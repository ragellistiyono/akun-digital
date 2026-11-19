import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { bacaSesiAdmin } from "@/server/auth/sesi-admin";

import { FormMasuk } from "../_masuk/form-masuk";
import { aksiMasukAdmin } from "./aksi";
import { MerekAdmin } from "./_components/merek-admin";

// Halaman login Admin (PRD §2.2). Admin yang sesinya masih berlaku langsung dibawa ke dasbor admin.
// Tidak ada tautan untuk mendaftar: Admin hanya dibuat lewat `pnpm admin:buat`.
export default async function HalamanLoginAdmin() {
  if (await bacaSesiAdmin(await headers())) redirect("/admin/ringkasan");

  return (
    <>
      {/* Ruang env(safe-area-inset-top) menjaga merek dari jam dan poni iPhone. Bilah status iPhone memakai gaya
          bawaan (PRD §11.4 ▶ Keputusan 2026-11-20), jadi ruang itu ikut berwarna kertas seperti bilahnya, yang
          bergaris bawah putus-putus. */}
      <header className="pt-[env(safe-area-inset-top)]">
        <div className="h-16 border-b-2 border-dashed border-pensil">
          <div className="mx-auto flex h-full max-w-[1120px] items-center px-4">
            <MerekAdmin />
          </div>
        </div>
      </header>
      {/* Pola Fokus (DESIGN.md Tata letak halaman): judul, keterangan, dan form dalam satu kolom 560 px di
          tengah, dengan padding samping 16 px di ponsel. */}
      <main className="px-4 pt-6 pb-16 lebar:pt-8">
        <div className="tata-fokus">
          <h1>Masuk ke dasbor admin</h1>
          <p className="mt-2 text-pensil-redup">
            Halaman ini khusus Admin MIWE Digital Store.
          </p>
          {/* Kartu berselotip form ini diatur FormMasuk sendiri, sama dengan login Member. */}
          <FormMasuk aksiMasuk={aksiMasukAdmin} />
        </div>
      </main>
    </>
  );
}
