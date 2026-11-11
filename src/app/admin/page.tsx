import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { bacaSesiAdmin } from "@/server/auth/sesi-admin";

import { FormMasuk } from "./_components/form-masuk";
import { MerekAdmin } from "./_components/merek-admin";

// Halaman login Admin (PRD §2.2). Admin yang sesinya masih berlaku langsung dibawa ke dasbor admin.
// Tidak ada tautan untuk mendaftar: Admin hanya dibuat lewat `pnpm admin:buat`.
export default async function HalamanLoginAdmin() {
  if (await bacaSesiAdmin(await headers())) redirect("/admin/ringkasan");

  return (
    <>
      <header className="bg-langit text-langit-teks">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center px-4">
          <MerekAdmin />
        </div>
      </header>
      <main className="mx-auto max-w-[440px] px-4 pt-8 pb-16">
        <h1>Masuk ke dasbor admin</h1>
        <p className="mt-2 text-tinta-redup">
          Halaman ini khusus Admin MIWE Digital Store.
        </p>
        <FormMasuk />
      </main>
    </>
  );
}
