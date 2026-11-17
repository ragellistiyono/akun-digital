// Lupa password Member: kirim Tautan atur ulang password, lalu simpan password baru lewat tautan itu
// (PRD §7.5 ▶ Keputusan 2026-11-17, §7.7, §10.2).
import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, gt } from "drizzle-orm";

import { periksaKirimTautanAturUlangPassword } from "@/domain/kirim-tautan-atur-ulang-password";
import { emailBaku } from "@/domain/kesamaan-email";
import {
  type AlasanTautanTidakBerlaku,
  tautanAturUlangPasswordBerlaku,
} from "@/domain/tautan-atur-ulang-password";

import { db } from "../db";
import {
  account,
  batasLogin,
  session,
  tautanAturUlangPassword,
  user,
} from "../db/schema";
import { pengirimEmailAktif } from "../email";
import { emailAturUlangPassword } from "../email-atur-ulang-password";
import { auth } from "./auth";

type Transaksi = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Bagian acak Tautan atur ulang password baru: 32 byte acak kriptografis, base64url (43 karakter). */
const tautanAcak = () => randomBytes(32).toString("base64url");

/** Hash yang disimpan untuk bagian acak tautan, supaya isi database saja tidak cukup untuk membukanya. */
const hashTautan = (tautan: string) =>
  createHash("sha256").update(tautan).digest("hex");

/**
 * Mengirim Tautan atur ulang password ke email itu (PRD §7.5 ▶ Keputusan 2026-11-17). Tautan hanya
 * dikirim ke Member aktif; Pendaftar, Member nonaktif, Admin, dan email yang tidak terdaftar tidak menerima
 * email apa pun. Tautan baru paling cepat dikirim 60 detik setelah tautan sebelumnya untuk email itu, dan
 * membuat tautan sebelumnya tidak berlaku lagi. Hasilnya hanya untuk test dan pencatatan: halaman
 * menampilkan pesan yang sama apa pun hasilnya. Email dibandingkan dalam bentuk bakunya (PRD §7.4).
 */
export async function kirimTautanAturUlangPassword({
  email,
}: {
  email: string;
}): Promise<{ hasil: "terkirim" | "tidak-dikirim" }> {
  const emailMember = emailBaku(email);

  return db.transaction(async (tx) => {
    // Baris Member dikunci, supaya dua permintaan yang datang bersamaan dinilai jedanya satu per satu.
    const [member] = await tx
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          eq(user.email, emailMember),
          eq(user.peran, "Member"),
          eq(user.nonaktif, false),
        ),
      )
      .for("update");
    if (!member) return { hasil: "tidak-dikirim" };

    const [terakhir] = await tx
      .select({ dikirimPada: tautanAturUlangPassword.dikirimPada })
      .from(tautanAturUlangPassword)
      .where(eq(tautanAturUlangPassword.userId, member.id))
      .orderBy(desc(tautanAturUlangPassword.dikirimPada))
      .limit(1);
    const sekarang = new Date();
    const { kirim } = periksaKirimTautanAturUlangPassword({
      terakhirDikirimPada: terakhir?.dikirimPada ?? null,
      sekarang,
    });
    if (!kirim) return { hasil: "tidak-dikirim" };

    const tautan = tautanAcak();
    await tx.insert(tautanAturUlangPassword).values({
      hashTautan: hashTautan(tautan),
      userId: member.id,
      dikirimPada: sekarang,
    });
    // Email dikirim di dalam transaksi, supaya kegagalan kirim membatalkan tautan ini dan Member bisa
    // langsung meminta lagi tanpa jeda.
    await pengirimEmailAktif().kirim(
      await emailAturUlangPassword({ kepada: emailMember, tautan }),
    );
    return { hasil: "terkirim" };
  });
}

type KeadaanTautan =
  | { keadaan: "berlaku" }
  | { keadaan: "tidak-berlaku"; alasan: AlasanTautanTidakBerlaku }
  | { keadaan: "tidak-dikenal" };

/**
 * Menilai Tautan atur ulang password dengan bagian acak itu pada saat ini, beserta barisnya, termasuk
 * apakah Member pemiliknya sedang nonaktif (PRD §2.3). Tautan yang tidak pernah dikirim, atau milik user
 * yang bukan Member, tidak dikenal: hasilnya null. Bila `kunci`, baris tautan dan baris Member-nya
 * dikunci sampai transaksi selesai, supaya satu tautan tidak bisa dipakai dua kali bersamaan.
 */
async function nilaiTautan(tx: Transaksi, tautan: string, kunci: boolean) {
  const kueri = tx
    .select({
      hashTautan: tautanAturUlangPassword.hashTautan,
      userId: tautanAturUlangPassword.userId,
      email: user.email,
      dikirimPada: tautanAturUlangPassword.dikirimPada,
      dipakaiPada: tautanAturUlangPassword.dipakaiPada,
      nonaktif: user.nonaktif,
    })
    .from(tautanAturUlangPassword)
    .innerJoin(user, eq(tautanAturUlangPassword.userId, user.id))
    .where(
      and(
        eq(tautanAturUlangPassword.hashTautan, hashTautan(tautan)),
        eq(user.peran, "Member"),
      ),
    );
  const [baris] = await (kunci ? kueri.for("update") : kueri);
  if (!baris) return null;

  // Tautan yang dikirim sesudahnya ke Member yang sama menggantikan tautan ini.
  const [lebihBaru] = await tx
    .select({ hashTautan: tautanAturUlangPassword.hashTautan })
    .from(tautanAturUlangPassword)
    .where(
      and(
        eq(tautanAturUlangPassword.userId, baris.userId),
        gt(tautanAturUlangPassword.dikirimPada, baris.dikirimPada),
      ),
    )
    .limit(1);
  const nilai = tautanAturUlangPasswordBerlaku({
    dikirimPada: baris.dikirimPada,
    sekarang: new Date(),
    sudahDipakai: baris.dipakaiPada !== null,
    diganti: !!lebihBaru,
    memberNonaktif: baris.nonaktif,
  });
  return { nilai, baris };
}

/**
 * Keadaan Tautan atur ulang password dengan bagian acak itu saat dibuka: berlaku, tidak berlaku beserta
 * alasannya (PRD §7.5 ▶ Keputusan 2026-11-17), atau tidak dikenal.
 */
export async function bacaTautanAturUlangPassword(
  tautan: string,
): Promise<KeadaanTautan> {
  const tautanItu = await db.transaction((tx) =>
    nilaiTautan(tx, tautan, false),
  );
  if (!tautanItu) return { keadaan: "tidak-dikenal" };
  const { nilai } = tautanItu;
  return nilai.berlaku
    ? { keadaan: "berlaku" }
    : { keadaan: "tidak-berlaku", alasan: nilai.alasan };
}

type HasilAturUlangPassword =
  | { hasil: "berhasil" }
  | { hasil: "tidak-berlaku"; alasan: AlasanTautanTidakBerlaku }
  | { hasil: "tidak-dikenal" };

/**
 * Menyimpan password baru lewat Tautan atur ulang password (PRD §7.5 ▶ Keputusan 2026-11-17). Tautan yang
 * tidak berlaku ditolak dengan alasannya tanpa mengubah apa pun. Tautan milik Member nonaktif juga tidak
 * ditandai sudah dipakai, supaya bisa dipakai lagi bila Member diaktifkan kembali dalam 30 menitnya. Bila berlaku, dalam satu transaksi:
 * password baru disimpan, tautan ditandai sudah dipakai, semua sesi Member itu dihapus sehingga ia keluar
 * dari semua perangkat, dan kunci login 15 menit untuk emailnya dicabut dengan hitungan salah kembali ke 0
 * (PRD §7.7). Panjang password baru sudah diperiksa pemanggil.
 */
export async function aturUlangPassword({
  tautan,
  passwordBaru,
}: {
  tautan: string;
  passwordBaru: string;
}): Promise<HasilAturUlangPassword> {
  // Hash dihitung sebelum transaksi, supaya baris tautan tidak terkunci selama hitungan yang lambat.
  const konteks = await auth.$context;
  const hashBaru = await konteks.password.hash(passwordBaru);

  return db.transaction(async (tx) => {
    const tautanItu = await nilaiTautan(tx, tautan, true);
    if (!tautanItu) return { hasil: "tidak-dikenal" };
    const { nilai, baris } = tautanItu;
    if (!nilai.berlaku) return { hasil: "tidak-berlaku", alasan: nilai.alasan };

    await tx
      .update(account)
      .set({ password: hashBaru })
      .where(
        and(
          eq(account.userId, baris.userId),
          eq(account.providerId, "credential"),
          eq(account.accountId, baris.userId),
        ),
      );
    await tx
      .update(tautanAturUlangPassword)
      .set({ dipakaiPada: new Date() })
      .where(eq(tautanAturUlangPassword.hashTautan, baris.hashTautan));
    await tx.delete(session).where(eq(session.userId, baris.userId));
    await tx
      .update(batasLogin)
      .set({ jumlahSalah: 0, terkunciSampai: null })
      .where(eq(batasLogin.email, baris.email));
    return { hasil: "berhasil" };
  });
}
