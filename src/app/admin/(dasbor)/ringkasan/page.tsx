import { headers } from "next/headers";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";

// Halaman depan dasbor admin. Kartu angka Ringkasan (PRD §9.2) ditambahkan di M2.
export default async function HalamanRingkasan() {
  await wajibSesiAdmin(await headers());

  return <h1>Ringkasan</h1>;
}
