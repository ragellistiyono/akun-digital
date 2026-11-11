"use server";

import { headers } from "next/headers";
import { z } from "zod";

import {
  PANJANG_NOMOR_WHATSAPP_MAKSIMUM,
  rapikanNomorWhatsapp,
  type AlasanNomorWhatsappDitolak,
} from "@/domain/nomor-whatsapp";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { simpanPengaturanToko } from "@/server/pengaturan-toko";

type NilaiFormPengaturan = {
  nomorWhatsapp: string;
  syaratKetentuan: string;
  kebijakanPrivasi: string;
};

export type KeadaanFormPengaturan = {
  nilai: NilaiFormPengaturan;
  galat?: { nomorWhatsapp?: string };
  tersimpan?: boolean;
};

// Browser mengirim baris baru di textarea sebagai CRLF; teks disimpan dengan LF saja.
const TeksHalaman = z
  .string()
  .transform((teks) => teks.replace(/\r\n?/g, "\n"));

const MasukanPengaturan = z.object({
  nomorWhatsapp: z.string(),
  syaratKetentuan: TeksHalaman,
  kebijakanPrivasi: TeksHalaman,
});

/** Pesan penolakan nomor WhatsApp dari rapikanNomorWhatsapp (PRD §9.8 ▶ Keputusan 2026-11-11). */
const PESAN_NOMOR_WHATSAPP: Record<AlasanNomorWhatsappDitolak, string> = {
  "bukan-angka":
    "Nomor WhatsApp hanya boleh berisi angka, spasi, tanda hubung, dan tanda +. Hapus huruf dan tanda lainnya, lalu simpan lagi.",
  "bukan-nomor-indonesia":
    "Nomor WhatsApp harus nomor Indonesia, yang diawali 0, 62, atau +62. Tulis nomornya misalnya 0812-3456-7890, lalu simpan lagi.",
  "terlalu-panjang": `Nomor WhatsApp terlalu panjang: setelah 0 di depan diganti 62, nomornya lebih dari ${PANJANG_NOMOR_WHATSAPP_MAKSIMUM} angka. Periksa lagi nomornya, lalu simpan lagi.`,
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
  };
  const masukan = MasukanPengaturan.parse(nilai);
  const nomor = rapikanNomorWhatsapp({ isian: masukan.nomorWhatsapp });
  if (!nomor.sah) {
    return {
      nilai,
      galat: { nomorWhatsapp: PESAN_NOMOR_WHATSAPP[nomor.alasan] },
    };
  }

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk menyimpan.
  await simpanPengaturanToko({ ...masukan, nomorWhatsapp: nomor.nomor });
  // Isian menampilkan nomor yang benar-benar tersimpan, yaitu hasil rapinya.
  return {
    nilai: { ...masukan, nomorWhatsapp: nomor.nomor ?? "" },
    tersimpan: true,
  };
}
