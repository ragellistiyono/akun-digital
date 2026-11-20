// Saldo Member dan perubahannya oleh Admin (PRD §15.1, §15.2, §15.6).
import { rupiahDariTeks } from "./rupiah";

/** Jenis baris Riwayat saldo (PRD §15.2, GLOSSARY). */
export const JENIS_RIWAYAT_SALDO = [
  "Top up",
  "Pembelian",
  "Ditambah Admin",
  "Dikurangi Admin",
] as const;

export type JenisRiwayatSaldo = (typeof JENIS_RIWAYAT_SALDO)[number];

/** Aksi Admin atas saldo Member (PRD §15.6): "Tambah saldo" atau "Kurangi saldo". */
export const AKSI_SALDO_ADMIN = ["tambah", "kurangi"] as const;

export type AksiSaldoAdmin = (typeof AKSI_SALDO_ADMIN)[number];

/** Jenis baris Riwayat saldo yang ditulis setiap aksi Admin (PRD §15.2). */
export const JENIS_AKSI_SALDO_ADMIN: Record<AksiSaldoAdmin, JenisRiwayatSaldo> =
  { tambah: "Ditambah Admin", kurangi: "Dikurangi Admin" };

/** Panjang keterangan terpanjang, setelah spasi di awal dan akhir dibuang (PRD §15.6, sama seperti §14.4). */
export const PANJANG_KETERANGAN_SALDO_MAKSIMUM = 100;

/** Nominal terkecil yang bisa ditambah atau dikurangi Admin, dalam rupiah (PRD §15.6). */
export const NOMINAL_SALDO_MINIMUM = 1;

export type AlasanNominalSaldo =
  "kosong" | "bukan-rupiah-bulat" | "di-bawah-minimal";

export type AlasanKeteranganSaldo = "kosong" | "terlalu-panjang";

/**
 * Nominal dari teks isian, misalnya "50000" atau "50.000", atau alasan penolakannya (PRD §15.6). Tanda minus di
 * depan angka ikut dibaca, supaya nominal negatif ditolak sebagai di bawah minimal, bukan sebagai teks yang tidak
 * terbaca.
 */
export function bacaNominalSaldo(
  teks: string,
): { nominal: number } | { alasan: AlasanNominalSaldo } {
  const bersih = teks.trim();
  if (bersih === "") return { alasan: "kosong" };
  const negatif = /^[-−]/.test(bersih);
  const nilai = rupiahDariTeks(negatif ? bersih.slice(1).trimStart() : bersih);
  if (nilai === null) return { alasan: "bukan-rupiah-bulat" };
  const nominal = negatif ? -nilai : nilai;
  if (nominal < NOMINAL_SALDO_MINIMUM) return { alasan: "di-bawah-minimal" };
  if (!Number.isInteger(nominal)) return { alasan: "bukan-rupiah-bulat" };
  return { nominal };
}

/**
 * Panjang teks dalam karakter yang terlihat. Array.from menghitung per titik kode, jadi huruf di luar BMP, misalnya
 * emoji, dihitung satu karakter.
 */
const panjang = (teks: string) => Array.from(teks).length;

function alasanKeterangan(keterangan: string): AlasanKeteranganSaldo | null {
  if (keterangan === "") return "kosong";
  if (panjang(keterangan) > PANJANG_KETERANGAN_SALDO_MAKSIMUM) {
    return "terlalu-panjang";
  }
  return null;
}

/**
 * "Tambah saldo" atau "Kurangi saldo" oleh Admin (PRD §15.6, tests/golden/ubah-saldo-admin.json). `saldo` adalah
 * saldo Member sekarang, `nominal` dan `keterangan` teks isian Admin. Nominal rupiah bulat minimal Rp 1, dan
 * keterangan wajib serta paling banyak 100 karakter setelah spasi di awal dan akhir dibuang. Setiap isian diperiksa
 * sendiri. Pengurangan yang melebihi saldo ditolak dengan alasan "tidak-cukup", yang hanya diperiksa bila nominalnya
 * sah, sehingga saldo tidak pernah negatif (PRD §15.1). Bila sah, hasilnya membawa saldo sesudahnya dan keterangan
 * yang disimpan; bila ditolak, keduanya null.
 */
export function ubahSaldoAdmin({
  aksi,
  saldo,
  nominal,
  keterangan,
}: {
  aksi: AksiSaldoAdmin;
  saldo: number;
  nominal: string;
  keterangan: string;
}) {
  const bacaan = bacaNominalSaldo(nominal);
  const bersih = keterangan.trim();
  const keteranganDitolak = alasanKeterangan(bersih);

  let saldoSesudah: number | null = null;
  let alasanSaldo: "tidak-cukup" | null = null;
  if ("nominal" in bacaan) {
    const hasil =
      aksi === "tambah" ? saldo + bacaan.nominal : saldo - bacaan.nominal;
    if (hasil < 0) alasanSaldo = "tidak-cukup";
    else saldoSesudah = hasil;
  }

  const valid =
    "nominal" in bacaan && keteranganDitolak === null && alasanSaldo === null;
  return {
    valid,
    alasanNominal: "alasan" in bacaan ? bacaan.alasan : null,
    alasanKeterangan: keteranganDitolak,
    alasanSaldo,
    saldoSesudah: valid ? saldoSesudah : null,
    keteranganTersimpan: valid ? bersih : null,
  };
}
