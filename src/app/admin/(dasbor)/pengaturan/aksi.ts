"use server";

import { headers } from "next/headers";
import { z } from "zod";

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
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { simpanPengaturanToko } from "@/server/pengaturan-toko";

type NilaiFormPengaturan = {
  nomorWhatsapp: string;
  syaratKetentuan: string;
  kebijakanPrivasi: string;
  /** Ambang stok menipis seperti yang ditulis Admin. */
  ambangStokMenipis: string;
};

export type KeadaanFormPengaturan = {
  nilai: NilaiFormPengaturan;
  galat?: { nomorWhatsapp?: string; ambangStokMenipis?: string };
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
  };
  const masukan = MasukanPengaturan.parse(nilai);
  const nomor = rapikanNomorWhatsapp({ isian: masukan.nomorWhatsapp });
  const ambang = periksaAmbangStokMenipis({
    ambang: masukan.ambangStokMenipis,
  });
  if (!nomor.sah || !ambang.sah) {
    return {
      nilai,
      galat: {
        ...(!nomor.sah && {
          nomorWhatsapp: PESAN_NOMOR_WHATSAPP[nomor.alasan],
        }),
        ...(!ambang.sah && {
          ambangStokMenipis: PESAN_AMBANG_STOK_MENIPIS[ambang.alasan],
        }),
      },
    };
  }

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk menyimpan.
  await simpanPengaturanToko({
    ...masukan,
    nomorWhatsapp: nomor.nomor,
    ambangStokMenipis: ambang.ambang,
  });
  // Isian menampilkan nilai yang benar-benar tersimpan, yaitu nomor hasil rapinya dan ambang tanpa spasi.
  return {
    nilai: {
      ...masukan,
      nomorWhatsapp: nomor.nomor ?? "",
      ambangStokMenipis: String(ambang.ambang),
    },
    tersimpan: true,
  };
}
