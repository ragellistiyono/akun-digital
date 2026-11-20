"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  AKSI_SALDO_ADMIN,
  bacaNominalSaldo,
  NOMINAL_SALDO_MINIMUM,
  PANJANG_KETERANGAN_SALDO_MAKSIMUM,
  type AlasanKeteranganSaldo,
  type AlasanNominalSaldo,
} from "@/domain/ubah-saldo-admin";
import { rupiah } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import {
  periksaUbahSaldo,
  ubahSaldoOlehAdmin,
  type HasilUbahSaldo,
} from "@/server/saldo";

/** Isian form ubah saldo apa adanya, untuk dikembalikan ke form. */
type IsianFormUbahSaldo = { nominal: string; keterangan: string };

/**
 * Keadaan form "Tambah saldo" atau "Kurangi saldo": isiannya, pesan galat per isian, kalimat penegasan bila isian
 * sah dan aksi menunggu persetujuan Admin, dan tanda selesai setelah saldo diubah.
 */
export type KeadaanUbahSaldo = {
  isian: IsianFormUbahSaldo;
  galat?: Partial<Record<keyof IsianFormUbahSaldo, string>>;
  penegasan?: string;
  selesai?: true;
};

/**
 * Masukan form. Tahap "periksa" hanya menilai isian dan meminta penegasan di tempat; tahap "jalankan" dikirim
 * setelah Admin menyetujui penegasan itu (PRD §15.6).
 */
const MasukanUbahSaldo = z.object({
  idMember: z.string().min(1),
  aksi: z.enum(AKSI_SALDO_ADMIN),
  nominal: z.string(),
  keterangan: z.string(),
  tahap: z.enum(["periksa", "jalankan"]),
});

const PESAN_NOMINAL: Record<AlasanNominalSaldo, string> = {
  kosong:
    "Nominal belum diisi. Ketik nominalnya dalam rupiah, misalnya 50.000.",
  "bukan-rupiah-bulat":
    "Nominal harus rupiah bulat tanpa sen, misalnya 50.000. Hapus huruf dan angka di belakang koma.",
  "di-bawah-minimal": `Nominal kurang dari ${rupiah(NOMINAL_SALDO_MINIMUM)}. Isi nominal minimal ${rupiah(NOMINAL_SALDO_MINIMUM)}.`,
};

const PESAN_KETERANGAN: Record<AlasanKeteranganSaldo, string> = {
  kosong:
    "Keterangan belum diisi. Ketik alasan perubahan saldo ini, misalnya Ganti rugi akun Netflix bermasalah. Member melihatnya di Riwayat saldo.",
  "terlalu-panjang": `Keterangan lebih dari ${PANJANG_KETERANGAN_SALDO_MAKSIMUM} karakter. Persingkat menjadi paling banyak ${PANJANG_KETERANGAN_SALDO_MAKSIMUM} karakter.`,
};

/** Pesan galat per isian dari hasil yang ditolak (PRD §15.6). */
function galatDari(
  hasil: Extract<HasilUbahSaldo, { hasil: "ditolak" }>,
): KeadaanUbahSaldo["galat"] {
  const { periksa } = hasil;
  const galat: KeadaanUbahSaldo["galat"] = {};
  if (periksa.alasanNominal) {
    galat.nominal = PESAN_NOMINAL[periksa.alasanNominal];
  } else if (periksa.alasanSaldo && hasil.nominal !== null) {
    galat.nominal = `Saldo tidak cukup untuk dikurangi ${rupiah(hasil.nominal)}. Saldo ${hasil.email} sekarang ${rupiah(hasil.saldo)}.`;
  }
  if (periksa.alasanKeterangan) {
    galat.keterangan = PESAN_KETERANGAN[periksa.alasanKeterangan];
  }
  return galat;
}

/**
 * "Tambah saldo" atau "Kurangi saldo" seorang Member oleh Admin (PRD §15.6), untuk Member aktif maupun nonaktif.
 * Tahap "periksa" menilai isian terhadap saldo sekarang tanpa mengubah apa pun, lalu mengembalikan kalimat
 * penegasan, misalnya "Tambah Rp 50.000 ke saldo budi@mail.com?". Tahap "jalankan" menilai ulang isian terhadap
 * saldo terbaru dan mengubah saldo beserta Riwayat saldo-nya. Isian yang ditolak, termasuk pengurangan yang
 * melebihi saldo, dikembalikan dengan pesannya, dan saldo tidak berubah. Setelah saldo diubah, halaman Member
 * dimuat ulang tanpa pesan "tersimpan" (DESIGN.md Navigation).
 */
export async function aksiUbahSaldo(
  _sebelumnya: KeadaanUbahSaldo,
  formData: FormData,
): Promise<KeadaanUbahSaldo> {
  await wajibSesiAdmin(await headers());

  const masukan = MasukanUbahSaldo.safeParse(Object.fromEntries(formData));
  if (!masukan.success) notFound();
  const { idMember, aksi, nominal, keterangan, tahap } = masukan.data;
  const isian = { nominal, keterangan };

  // Saldo tidak dibatasi maksimum (PRD §15.6), tetapi angka di atas batas ini tidak bisa dihitung persis sampai
  // rupiah terakhir.
  const bacaan = bacaNominalSaldo(nominal);
  if ("nominal" in bacaan && bacaan.nominal > Number.MAX_SAFE_INTEGER) {
    return {
      isian,
      galat: {
        nominal: "Nominal terlalu besar untuk disimpan. Periksa lagi angkanya.",
      },
    };
  }

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengubah saldo.
  const ubah = { idMember, aksi, nominal, keterangan };
  const hasil =
    tahap === "periksa"
      ? await periksaUbahSaldo(ubah)
      : await ubahSaldoOlehAdmin(ubah);
  if (hasil.hasil === "tidak-ada") notFound();
  if (hasil.hasil === "ditolak") return { isian, galat: galatDari(hasil) };
  if (hasil.hasil === "sah") {
    const penegasan =
      aksi === "tambah"
        ? `Tambah ${rupiah(hasil.nominal)} ke saldo ${hasil.email}?`
        : `Kurangi ${rupiah(hasil.nominal)} dari saldo ${hasil.email}?`;
    return { isian, penegasan };
  }

  revalidatePath(`/admin/member/${idMember}`);
  return { isian: { nominal: "", keterangan: "" }, selesai: true };
}
