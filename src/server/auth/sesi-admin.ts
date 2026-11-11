import { redirect } from "next/navigation";

import { sesiAdminBerlaku } from "@/domain/sesi-admin";

import { auth } from "./auth";

/**
 * Membaca sesi Admin dari cookie permintaan. Hasilnya null bila tidak ada sesi, atau bila sesi
 * sudah melewati 12 jam sejak login (PRD §2.2 ▶ Keputusan 2026-11-11).
 */
export async function bacaSesiAdmin(kepala: Headers) {
  const sesi = await auth.api.getSession({ headers: kepala });
  if (!sesi) return null;

  const berlaku = sesiAdminBerlaku({
    waktuLogin: sesi.session.createdAt,
    sekarang: new Date(),
  });
  return berlaku ? sesi : null;
}

/**
 * Pemeriksaan sesi untuk setiap halaman dan aksi dasbor admin. Tanpa sesi Admin yang berlaku,
 * pengunjung diarahkan ke halaman login `/admin`.
 */
export async function wajibSesiAdmin(kepala: Headers) {
  const sesi = await bacaSesiAdmin(kepala);
  if (!sesi) redirect("/admin");
  return sesi;
}
