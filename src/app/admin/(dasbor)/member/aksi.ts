"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { ubahStatusMember } from "@/server/status-member";

/** Member yang dipilih dan status barunya, dari tombol di daftar Member. */
const MasukanStatusMember = z.object({
  idMember: z.string().min(1),
  status: z.enum(["nonaktif", "aktif"]),
});

/**
 * Menonaktifkan Member atau mengaktifkannya kembali dari daftar Member (PRD §2.3 ▶ Keputusan 2026-11-17).
 * Aksi ini bisa dibalik, jadi tidak perlu penegasan (DESIGN.md Navigation). Hanya Admin yang boleh mengubah
 * status Member: tanpa sesi Admin yang berlaku, pengunjung diarahkan ke halaman login `/admin`.
 */
export async function aksiUbahStatusMember(formData: FormData) {
  await wajibSesiAdmin(await headers());

  const masukan = MasukanStatusMember.safeParse({
    idMember: formData.get("idMember"),
    status: formData.get("status"),
  });
  if (!masukan.success) notFound();

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengubah status.
  const hasil = await ubahStatusMember({
    idMember: masukan.data.idMember,
    nonaktif: masukan.data.status === "nonaktif",
  });
  if (hasil.hasil === "tidak-ada") notFound();

  // Daftar Member dibuat ulang dengan status barunya, tanpa pesan "tersimpan" (DESIGN.md Navigation).
  revalidatePath("/admin/member");
}
