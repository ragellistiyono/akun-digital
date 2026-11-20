"use server";

import { headers } from "next/headers";
import { z } from "zod";

import {
  PERSEN_BIAYA_TRANSAKSI_MAKSIMUM,
  periksaIsianBiayaTransaksi,
  type AlasanMinimalBiayaTransaksiDitolak,
  type AlasanPersenBiayaTransaksiDitolak,
} from "@/domain/biaya-transaksi";
import {
  PANJANG_NOMOR_WHATSAPP_MAKSIMUM,
  rapikanNomorWhatsapp,
  type AlasanNomorWhatsappDitolak,
} from "@/domain/nomor-whatsapp";
import {
  AMBANG_STOK_MENIPIS_MAKSIMUM,
  periksaAmbangStokMenipis,
  type AlasanAmbangStokMenipisDitolak,
} from "@/domain/stok-menipis";
import { rupiahDariTeks } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { simpanPengaturanToko } from "@/server/pengaturan-toko";

import { nilaiIsianBiayaTransaksi } from "./nilai-isian-biaya-transaksi";

type NilaiFormPengaturan = {
  nomorWhatsapp: string;
  syaratKetentuan: string;
  kebijakanPrivasi: string;
  /** Ambang stok menipis seperti yang ditulis Admin. */
  ambangStokMenipis: string;
  /** Persen biaya transaksi seperti yang ditulis Admin, dengan koma desimal, misalnya "0,7". */
  persenBiayaTransaksi: string;
  /** Minimal Total bayar yang dikenai biaya seperti yang ditulis Admin, misalnya "100.000". */
  minimalBiayaTransaksi: string;
};

export type KeadaanFormPengaturan = {
  nilai: NilaiFormPengaturan;
  galat?: {
    nomorWhatsapp?: string;
    ambangStokMenipis?: string;
    persenBiayaTransaksi?: string;
    minimalBiayaTransaksi?: string;
  };
  tersimpan?: boolean;
};

// Browser mengirim baris baru di textarea sebagai CRLF; teks disimpan dengan LF saja.
const TeksHalaman = z
  .string()
  .transform((teks) => teks.replace(/\r\n?/g, "\n"));

// Ambang stok menipis hanya dibaca sebagai angka bila isiannya angka bulat tanpa tanda pemisah. Isian lain,
// misalnya "2,5", "1.000", atau kosong, menjadi NaN dan ditolak periksaAmbangStokMenipis sebagai bukan
// bilangan bulat, supaya "1.000" tidak tersimpan diam-diam sebagai 1.
const AngkaAmbang = z
  .string()
  .trim()
  .transform((isian) =>
    /^-?[0-9]+$/.test(isian) ? Number(isian) : Number.NaN,
  );

const MasukanPengaturan = z.object({
  nomorWhatsapp: z.string(),
  syaratKetentuan: TeksHalaman,
  kebijakanPrivasi: TeksHalaman,
  ambangStokMenipis: AngkaAmbang,
});

/**
 * Persen biaya transaksi dari isian (PRD §14.3), yang ditulis dengan koma desimal, misalnya "0,7" atau "0,75":
 * null bila kosong, supaya periksaIsianBiayaTransaksi menolaknya sebagai kosong. Tanda minus di depan angka ikut
 * dibaca, supaya persen negatif ditolak dengan pesan rentang. Titik tidak dibaca sebagai koma desimal, karena
 * di Indonesia titik memisahkan ribuan.
 */
const PersenBiayaTransaksi = z
  .string()
  .trim()
  .transform((teks, ctx) => {
    if (teks === "") return null;
    if (!/^[-−]?\d+(?:,\d+)?$/.test(teks)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Persen biaya transaksi tidak terbaca sebagai angka. Tulis angkanya saja dengan koma desimal, misalnya 0,7, lalu simpan lagi.",
      });
      return z.NEVER;
    }
    return Number(teks.replace("−", "-").replace(",", "."));
  });

/**
 * Minimal Total bayar yang dikenai biaya dari isian (PRD §14.3), ditulis seperti rupiah lain, misalnya "100000"
 * atau "100.000": null bila kosong. Tanda minus di depan angka ikut dibaca, supaya nilai negatif ditolak
 * periksaIsianBiayaTransaksi dengan pesan minimal Rp 0.
 */
const MinimalBiayaTransaksi = z
  .string()
  .trim()
  .transform((teks, ctx) => {
    if (teks === "") return null;
    const negatif = /^[-−]/.test(teks);
    const nilai = rupiahDariTeks(negatif ? teks.slice(1).trimStart() : teks);
    if (nilai === null || nilai > Number.MAX_SAFE_INTEGER) {
      ctx.addIssue({
        code: "custom",
        message:
          "Minimal Total bayar tidak terbaca sebagai rupiah. Ketik angkanya saja, misalnya 100000 atau 100.000, lalu simpan lagi.",
      });
      return z.NEVER;
    }
    return negatif ? -nilai : nilai;
  });

/** Pesan penolakan persen biaya transaksi dari periksaIsianBiayaTransaksi (PRD §14.3). */
const PESAN_PERSEN_BIAYA_TRANSAKSI: Record<
  AlasanPersenBiayaTransaksiDitolak,
  string
> = {
  "persen-kosong":
    "Persen biaya transaksi belum diisi. Tulis persennya, misalnya 0,7, lalu simpan lagi.",
  "persen-di-luar-rentang": `Persen biaya transaksi hanya boleh 0 sampai ${PERSEN_BIAYA_TRANSAKSI_MAKSIMUM}. Tulis angka di rentang itu, lalu simpan lagi.`,
  "persen-lebih-dari-2-desimal":
    "Persen biaya transaksi paling banyak 2 angka di belakang koma, misalnya 0,75. Hapus angka berikutnya, lalu simpan lagi.",
};

/** Pesan penolakan minimal Total bayar yang dikenai biaya dari periksaIsianBiayaTransaksi (PRD §14.3). */
const PESAN_MINIMAL_BIAYA_TRANSAKSI: Record<
  AlasanMinimalBiayaTransaksiDitolak,
  string
> = {
  "minimal-kosong":
    "Minimal Total bayar belum diisi. Ketik rupiahnya, misalnya 100.000, atau 0 bila semua Pesanan dikenai biaya, lalu simpan lagi.",
  "minimal-negatif":
    "Minimal Total bayar kurang dari Rp 0. Isi minimal Rp 0, lalu simpan lagi.",
  "minimal-bukan-rupiah-bulat":
    "Minimal Total bayar harus rupiah bulat, tanpa sen. Hapus angka di belakang koma, lalu simpan lagi.",
};

/** Pesan penolakan nomor WhatsApp dari rapikanNomorWhatsapp (PRD §9.8 ▶ Keputusan 2026-11-11). */
const PESAN_NOMOR_WHATSAPP: Record<AlasanNomorWhatsappDitolak, string> = {
  "bukan-angka":
    "Nomor WhatsApp hanya boleh berisi angka, spasi, tanda hubung, dan tanda +. Hapus huruf dan tanda lainnya, lalu simpan lagi.",
  "bukan-nomor-indonesia":
    "Nomor WhatsApp harus nomor Indonesia, yang diawali 0, 62, atau +62. Tulis nomornya misalnya 0812-3456-7890, lalu simpan lagi.",
  "terlalu-panjang": `Nomor WhatsApp terlalu panjang: setelah 0 di depan diganti 62, nomornya lebih dari ${PANJANG_NOMOR_WHATSAPP_MAKSIMUM} angka. Periksa lagi nomornya, lalu simpan lagi.`,
};

/** Pesan penolakan Ambang stok menipis dari periksaAmbangStokMenipis (PRD §9.4 ▶ Keputusan 2026-11-17). */
const PESAN_AMBANG_STOK_MENIPIS: Record<
  AlasanAmbangStokMenipisDitolak,
  string
> = {
  "bukan-bilangan-bulat": `Ambang stok menipis harus bilangan bulat, tanpa koma, titik, atau huruf. Tulis angka 0 sampai ${AMBANG_STOK_MENIPIS_MAKSIMUM}, misalnya 5, lalu simpan lagi.`,
  "di-luar-rentang": `Ambang stok menipis hanya boleh 0 sampai ${AMBANG_STOK_MENIPIS_MAKSIMUM}. Tulis angka di rentang itu, lalu simpan lagi.`,
};

export async function aksiSimpanPengaturanToko(
  _sebelumnya: KeadaanFormPengaturan,
  formData: FormData,
): Promise<KeadaanFormPengaturan> {
  await wajibSesiAdmin(await headers());

  const nilai = {
    nomorWhatsapp: String(formData.get("nomorWhatsapp") ?? ""),
    syaratKetentuan: String(formData.get("syaratKetentuan") ?? ""),
    kebijakanPrivasi: String(formData.get("kebijakanPrivasi") ?? ""),
    ambangStokMenipis: String(formData.get("ambangStokMenipis") ?? ""),
    persenBiayaTransaksi: String(formData.get("persenBiayaTransaksi") ?? ""),
    minimalBiayaTransaksi: String(formData.get("minimalBiayaTransaksi") ?? ""),
  };
  const masukan = MasukanPengaturan.parse(nilai);
  const nomor = rapikanNomorWhatsapp({ isian: masukan.nomorWhatsapp });
  const ambang = periksaAmbangStokMenipis({
    ambang: masukan.ambangStokMenipis,
  });
  const persen = PersenBiayaTransaksi.safeParse(nilai.persenBiayaTransaksi);
  const minimal = MinimalBiayaTransaksi.safeParse(nilai.minimalBiayaTransaksi);
  // Isian Biaya transaksi yang terbaca sebagai angka diperiksa domain; yang tidak terbaca sudah punya pesan.
  const biaya = periksaIsianBiayaTransaksi({
    persen: persen.success ? persen.data : 0,
    minimalTotalBayar: minimal.success ? minimal.data : 0,
  });
  const galatPersen = !persen.success
    ? persen.error.issues[0].message
    : biaya.alasanPersen && PESAN_PERSEN_BIAYA_TRANSAKSI[biaya.alasanPersen];
  const galatMinimal = !minimal.success
    ? minimal.error.issues[0].message
    : biaya.alasanMinimal && PESAN_MINIMAL_BIAYA_TRANSAKSI[biaya.alasanMinimal];
  if (
    !nomor.sah ||
    !ambang.sah ||
    galatPersen ||
    galatMinimal ||
    !persen.success ||
    !minimal.success ||
    persen.data === null ||
    minimal.data === null
  ) {
    return {
      nilai,
      galat: {
        ...(!nomor.sah && {
          nomorWhatsapp: PESAN_NOMOR_WHATSAPP[nomor.alasan],
        }),
        ...(!ambang.sah && {
          ambangStokMenipis: PESAN_AMBANG_STOK_MENIPIS[ambang.alasan],
        }),
        ...(galatPersen && { persenBiayaTransaksi: galatPersen }),
        ...(galatMinimal && { minimalBiayaTransaksi: galatMinimal }),
      },
    };
  }

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk menyimpan.
  const biayaTransaksi = {
    persen: persen.data,
    minimalTotalBayar: minimal.data,
  };
  await simpanPengaturanToko(
    {
      ...masukan,
      nomorWhatsapp: nomor.nomor,
      ambangStokMenipis: ambang.ambang,
    },
    biayaTransaksi,
  );
  // Isian menampilkan nilai yang benar-benar tersimpan, yaitu nomor hasil rapinya, ambang tanpa spasi, dan
  // Biaya transaksi dalam tulisan baku, misalnya "0,7" dan "100.000".
  return {
    nilai: {
      ...masukan,
      nomorWhatsapp: nomor.nomor ?? "",
      ambangStokMenipis: String(ambang.ambang),
      ...nilaiIsianBiayaTransaksi(biayaTransaksi),
    },
    tersimpan: true,
  };
}
