// Saldo Member dan Riwayat saldo di database (PRD §15.1, §15.2, §15.6). Aturan perubahan saldo oleh Admin ada di
// ubahSaldoAdmin (src/domain/ubah-saldo-admin.ts). Pemeriksaan bahwa yang mengubah adalah Admin dilakukan Server
// Action pemanggilnya.
import { and, count, desc, eq } from "drizzle-orm";

import {
  bacaNominalSaldo,
  JENIS_AKSI_SALDO_ADMIN,
  ubahSaldoAdmin,
  type AksiSaldoAdmin,
} from "@/domain/ubah-saldo-admin";

import { db } from "./db";
import { riwayatSaldo, user } from "./db/schema";

/** Jumlah baris Riwayat saldo di satu halaman (PRD §15.2). */
const UKURAN_HALAMAN = 50;

/** Hanya baris user berperan Member yang punya saldo. */
const syaratMember = (idMember: string) =>
  and(eq(user.id, idMember), eq(user.peran, "Member"));

const kolomSaldo = {
  email: user.email,
  nonaktif: user.nonaktif,
  saldo: user.saldo,
};

/** Email, status nonaktif, dan Saldo seorang Member, atau null bila tidak ada Member dengan id itu. */
export async function bacaSaldoMember(idMember: string) {
  const [baris] = await db
    .select(kolomSaldo)
    .from(user)
    .where(syaratMember(idMember));
  return baris ?? null;
}

/** Isian "Tambah saldo" atau "Kurangi saldo" apa adanya dari form Admin (PRD §15.6). */
type IsianUbahSaldo = {
  idMember: string;
  aksi: AksiSaldoAdmin;
  nominal: string;
  keterangan: string;
};

/** Hasil pemeriksaan atau perubahan saldo oleh Admin. */
export type HasilUbahSaldo =
  | { hasil: "tidak-ada" }
  | {
      hasil: "ditolak";
      email: string;
      /** Saldo Member saat diperiksa, untuk pesan "Saldo … sekarang Rp X". */
      saldo: number;
      /** Nominal yang terbaca, atau null bila nominalnya ditolak. */
      nominal: number | null;
      periksa: ReturnType<typeof ubahSaldoAdmin>;
    }
  | {
      hasil: "sah" | "diubah";
      email: string;
      nominal: number;
      saldoSesudah: number;
      keterangan: string;
    };

/** Menilai isian dengan aturan domain terhadap saldo `saldo` Member itu. */
function nilai(
  { aksi, nominal, keterangan }: IsianUbahSaldo,
  member: { email: string; saldo: number },
): HasilUbahSaldo {
  const periksa = ubahSaldoAdmin({
    aksi,
    saldo: member.saldo,
    nominal,
    keterangan,
  });
  const bacaan = bacaNominalSaldo(nominal);
  const nominalTerbaca = "nominal" in bacaan ? bacaan.nominal : null;
  if (
    !periksa.valid ||
    nominalTerbaca === null ||
    periksa.saldoSesudah === null ||
    periksa.keteranganTersimpan === null
  ) {
    return {
      hasil: "ditolak",
      email: member.email,
      saldo: member.saldo,
      nominal: nominalTerbaca,
      periksa,
    };
  }
  return {
    hasil: "sah",
    email: member.email,
    nominal: nominalTerbaca,
    saldoSesudah: periksa.saldoSesudah,
    keterangan: periksa.keteranganTersimpan,
  };
}

/**
 * Memeriksa isian "Tambah saldo" atau "Kurangi saldo" terhadap saldo Member sekarang tanpa mengubah apa pun, untuk
 * Modal penegasan sebelum aksi dijalankan (PRD §15.6, §9.10). Hasilnya "sah" beserta nominal yang terbaca, atau
 * "ditolak" beserta alasannya.
 */
export async function periksaUbahSaldo(
  isian: IsianUbahSaldo,
): Promise<HasilUbahSaldo> {
  const member = await bacaSaldoMember(isian.idMember);
  if (!member) return { hasil: "tidak-ada" };
  return nilai(isian, member);
}

/**
 * Menjalankan "Tambah saldo" atau "Kurangi saldo" oleh Admin (PRD §15.6), untuk Member aktif maupun nonaktif.
 * Baris user Member itu dikunci lebih dulu, jadi perubahan saldo yang bersamaan dinilai satu per satu terhadap
 * saldo terbaru, dan pengurangan yang bersamaan tidak bisa membuat saldo negatif (PRD §15.1). Bila sah, saldo
 * baru dan satu baris Riwayat saldo berjenis Ditambah Admin atau Dikurangi Admin, dengan keterangan Admin sebagai
 * rujukannya, ditulis dalam transaksi yang sama (PRD §15.2).
 */
export async function ubahSaldoOlehAdmin(
  isian: IsianUbahSaldo,
): Promise<HasilUbahSaldo> {
  return db.transaction(async (tx) => {
    const [member] = await tx
      .select({ email: user.email, saldo: user.saldo })
      .from(user)
      .where(syaratMember(isian.idMember))
      .for("update");
    if (!member) return { hasil: "tidak-ada" };

    const hasil = nilai(isian, member);
    if (hasil.hasil !== "sah") return hasil;

    await tx
      .update(user)
      .set({ saldo: hasil.saldoSesudah })
      .where(eq(user.id, isian.idMember));
    await tx.insert(riwayatSaldo).values({
      userId: isian.idMember,
      jenis: JENIS_AKSI_SALDO_ADMIN[isian.aksi],
      nominal: isian.aksi === "tambah" ? hasil.nominal : -hasil.nominal,
      saldoSesudah: hasil.saldoSesudah,
      rujukan: hasil.keterangan,
    });
    return { ...hasil, hasil: "diubah" };
  });
}

/**
 * Satu halaman Riwayat saldo seorang Member (PRD §15.2): perubahan terbaru di atas, 50 baris per halaman, beserta
 * jumlah semua baris dan jumlah halamannya. Riwayat tanpa baris tetap punya satu halaman.
 */
export async function riwayatSaldoMember({
  idMember,
  halaman,
}: {
  idMember: string;
  halaman: number;
}) {
  const milikMember = eq(riwayatSaldo.userId, idMember);
  const [{ jumlah }] = await db
    .select({ jumlah: count() })
    .from(riwayatSaldo)
    .where(milikMember);
  const baris = await db
    .select({
      id: riwayatSaldo.id,
      waktu: riwayatSaldo.waktu,
      jenis: riwayatSaldo.jenis,
      nominal: riwayatSaldo.nominal,
      saldoSesudah: riwayatSaldo.saldoSesudah,
      rujukan: riwayatSaldo.rujukan,
    })
    .from(riwayatSaldo)
    .where(milikMember)
    .orderBy(desc(riwayatSaldo.id))
    .limit(UKURAN_HALAMAN)
    .offset((halaman - 1) * UKURAN_HALAMAN);
  return {
    baris,
    jumlah,
    halaman,
    jumlahHalaman: Math.max(1, Math.ceil(jumlah / UKURAN_HALAMAN)),
  };
}
