// Daftar sebagai Pendaftar dan kirim Kode verifikasi (PRD §7.2, §7.3, §7.7). Memasukkan kode dan
// mengaktifkan akun Member dibangun terpisah (T43).
import { randomInt } from "node:crypto";

import { eq } from "drizzle-orm";

import { periksaKirimUlangKodeVerifikasi } from "@/domain/kirim-ulang-kode-verifikasi";
import { emailBaku } from "@/domain/kesamaan-email";

import { db } from "../db";
import { pendaftar, user } from "../db/schema";
import { pengirimEmailAktif } from "../email";
import { emailKodeVerifikasi } from "../email-kode-verifikasi";
import { auth } from "./auth";

type HasilKirimKode =
  { hasil: "kode-terkirim" } | { hasil: "tunggu"; tungguDetik: number };

type Transaksi = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Kode verifikasi baru: 6 digit acak dari sumber acak kriptografis, termasuk angka 0 di depan. */
function kodeVerifikasiBaru() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Mengirim email Kode verifikasi lewat adaptor email. Dipanggil di dalam transaksi yang menyimpan kode itu,
 * supaya kegagalan kirim membatalkan perubahan Pendaftar dan Pendaftar bisa langsung mencoba lagi tanpa
 * jeda.
 */
async function kirimEmailKode(email: string, kode: string) {
  await pengirimEmailAktif().kirim(
    await emailKodeVerifikasi({ kepada: email, kode }),
  );
}

/** Baris Pendaftar dengan email itu, dikunci sampai transaksi selesai, atau undefined. */
async function pendaftarTerkunci(tx: Transaksi, email: string) {
  const [baris] = await tx
    .select({ kodeDikirimPada: pendaftar.kodeDikirimPada })
    .from(pendaftar)
    .where(eq(pendaftar.email, email))
    .for("update");
  return baris;
}

/**
 * Mendaftarkan email dan password sebagai Pendaftar, lalu mengirim Kode verifikasi ke email itu
 * (PRD §7.2, §7.3). Password sudah divalidasi pemanggil.
 * - Email Member, aktif maupun nonaktif, dan email Admin ditolak tanpa mengirim email.
 * - Pendaftar yang mendaftar ulang mendapat kode baru dengan password baru, tetapi paling cepat 60 detik
 *   setelah kode terakhir (PRD §7.7). Pendaftaran ulang yang terlalu cepat tidak mengubah apa pun.
 * Email dibandingkan dan disimpan dalam bentuk bakunya (PRD §7.4).
 */
export async function daftarPendaftar({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<HasilKirimKode | { hasil: "email-terdaftar" }> {
  const emailPendaftar = emailBaku(email);
  // Hash dihitung sebelum transaksi, supaya baris Pendaftar tidak terkunci selama hitungan yang lambat.
  const konteks = await auth.$context;
  const hash = await konteks.password.hash(password);

  return db.transaction(async (tx) => {
    const [pemilik] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, emailPendaftar));
    if (pemilik) return { hasil: "email-terdaftar" };

    const sekarang = new Date();
    const isian = {
      password: hash,
      kodeVerifikasi: kodeVerifikasiBaru(),
      kodeDikirimPada: sekarang,
    };
    // Bila email itu sudah Pendaftar, barisnya tidak ditimpa di sini, tetapi dikunci lalu diperiksa
    // jedanya lebih dulu.
    const [baru] = await tx
      .insert(pendaftar)
      .values({ email: emailPendaftar, ...isian })
      .onConflictDoNothing()
      .returning({ email: pendaftar.email });
    if (!baru) {
      const lama = await pendaftarTerkunci(tx, emailPendaftar);
      const jeda = periksaKirimUlangKodeVerifikasi({
        terakhirDikirimPada: lama.kodeDikirimPada,
        sekarang,
      });
      if (!jeda.boleh)
        return { hasil: "tunggu", tungguDetik: jeda.tungguDetik };
      await tx
        .update(pendaftar)
        .set(isian)
        .where(eq(pendaftar.email, emailPendaftar));
    }

    await kirimEmailKode(emailPendaftar, isian.kodeVerifikasi);
    return { hasil: "kode-terkirim" };
  });
}

/**
 * Mengirim Kode verifikasi baru ke Pendaftar itu ("Kirim ulang kode"), paling cepat 60 detik setelah
 * kode terakhir (PRD §7.7). Permintaan yang terlalu cepat tidak mengubah apa pun. Email yang bukan
 * Pendaftar tidak dikirimi apa pun.
 */
export async function kirimUlangKodeVerifikasi({
  email,
}: {
  email: string;
}): Promise<HasilKirimKode | { hasil: "bukan-pendaftar" }> {
  const emailPendaftar = emailBaku(email);

  return db.transaction(async (tx) => {
    const baris = await pendaftarTerkunci(tx, emailPendaftar);
    if (!baris) return { hasil: "bukan-pendaftar" };

    const sekarang = new Date();
    const jeda = periksaKirimUlangKodeVerifikasi({
      terakhirDikirimPada: baris.kodeDikirimPada,
      sekarang,
    });
    if (!jeda.boleh) return { hasil: "tunggu", tungguDetik: jeda.tungguDetik };

    const kode = kodeVerifikasiBaru();
    await tx
      .update(pendaftar)
      .set({ kodeVerifikasi: kode, kodeDikirimPada: sekarang })
      .where(eq(pendaftar.email, emailPendaftar));
    await kirimEmailKode(emailPendaftar, kode);
    return { hasil: "kode-terkirim" };
  });
}
