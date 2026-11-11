import { headers } from "next/headers";
import type { ReactNode } from "react";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";

import { MenuAdmin } from "./_components/menu-admin";

// Kerangka dasbor admin. Setiap halaman di bawahnya juga memanggil wajibSesiAdmin sendiri, karena
// layout tidak dirender ulang saat Admin berpindah halaman.
export default async function DasborAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await wajibSesiAdmin(await headers());

  return (
    <div className="lebar:flex">
      <MenuAdmin />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-16 lebar:px-8 lebar:pt-8">
        {children}
      </main>
    </div>
  );
}
