// Bahan bersama untuk test yang membutuhkan Member. Pendaftaran Member baru dibangun di T42 dan T43,
// jadi Member terverifikasi ditulis langsung ke database. Berkas ini hanya diimpor oleh test.
import { emailBaku } from "@/domain/kesamaan-email";

import { sisipkanAkun } from "./auth/sisipkan-akun";

/** Member terverifikasi dengan email dan password ini, yang langsung bisa login di halaman Masuk. */
export async function sisipkanMember({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  await sisipkanAkun({ email: emailBaku(email), password, peran: "Member" });
}
