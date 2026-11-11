import { headers } from "next/headers";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { koneksi } from "@/server/db";
import {
  bacaPengaturanToko,
  simpanPengaturanToko,
} from "@/server/pengaturan-toko";
import { arahKe, cookieAdminBaru } from "@/server/uji-admin";

import { aksiSimpanPengaturanToko } from "./aksi";

// Test integrasi Server Action dengan database app_test (.env.ci). Header permintaan yang dibaca
// aksi lewat next/headers diganti dengan cookie milik pengunjung di setiap test.
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const PENGATURAN_AWAL = {
  nomorWhatsapp: "6281200000001",
  syaratKetentuan: "Syarat lama.",
  kebijakanPrivasi: "Kebijakan lama.",
};

function sebagaiPengunjung(kepala: Headers) {
  vi.mocked(headers).mockResolvedValue(kepala);
}

function formulir(isian: Record<string, string>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) data.set(nama, nilai);
  return data;
}

const keadaanAwal = () => ({
  nilai: { ...PENGATURAN_AWAL },
});

beforeEach(async () => {
  await simpanPengaturanToko(PENGATURAN_AWAL);
});

afterAll(async () => {
  await koneksi.end();
});

describe("menyimpan Pengaturan toko (PRD §9.8)", () => {
  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan pengaturan toko tidak berubah", async () => {
    sebagaiPengunjung(new Headers());

    await expect(
      aksiSimpanPengaturanToko(
        keadaanAwal(),
        formulir({
          nomorWhatsapp: "081299999999",
          syaratKetentuan: "Syarat dari Tamu.",
          kebijakanPrivasi: "Kebijakan dari Tamu.",
        }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await bacaPengaturanToko()).toEqual(PENGATURAN_AWAL);
  });

  // PRD §9.8 ▶ Keputusan 2026-11-11 (#53): `0812-3456-7890` disimpan sebagai `6281234567890`.
  it("Admin menyimpan nomor WhatsApp yang sudah dirapikan serta teks Syarat & Ketentuan dan Kebijakan Privasi", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiSimpanPengaturanToko(
      keadaanAwal(),
      // Browser mengirim baris baru di textarea sebagai CRLF.
      formulir({
        nomorWhatsapp: "0812-3456-7890",
        syaratKetentuan: "Pasal satu.\r\nPasal dua.",
        kebijakanPrivasi: "Data dipakai untuk Pesanan.",
      }),
    );

    const tersimpan = {
      nomorWhatsapp: "6281234567890",
      syaratKetentuan: "Pasal satu.\nPasal dua.",
      kebijakanPrivasi: "Data dipakai untuk Pesanan.",
    };
    expect(keadaan).toEqual({ nilai: tersimpan, tersimpan: true });
    expect(await bacaPengaturanToko()).toEqual(tersimpan);
  });

  it("nomor WhatsApp yang dikosongkan tersimpan sebagai belum diisi", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiSimpanPengaturanToko(
      keadaanAwal(),
      formulir({ ...PENGATURAN_AWAL, nomorWhatsapp: "  " }),
    );

    expect(keadaan.nilai.nomorWhatsapp).toBe("");
    expect(await bacaPengaturanToko()).toEqual({
      ...PENGATURAN_AWAL,
      nomorWhatsapp: null,
    });
  });

  // Satu contoh untuk setiap alasan penolakan di tests/golden/nomor-whatsapp.json.
  for (const { nomor, pesan } of [
    {
      nomor: "0812.3456.7890",
      pesan:
        "Nomor WhatsApp hanya boleh berisi angka, spasi, tanda hubung, dan tanda +. Hapus huruf dan tanda lainnya, lalu simpan lagi.",
    },
    {
      nomor: "+1 555 0100",
      pesan:
        "Nomor WhatsApp harus nomor Indonesia, yang diawali 0, 62, atau +62. Tulis nomornya misalnya 0812-3456-7890, lalu simpan lagi.",
    },
    {
      nomor: "081234567890123",
      pesan:
        "Nomor WhatsApp terlalu panjang: setelah 0 di depan diganti 62, nomornya lebih dari 15 angka. Periksa lagi nomornya, lalu simpan lagi.",
    },
  ]) {
    it(`nomor WhatsApp "${nomor}" ditolak dengan pesan yang menyebut sebabnya, dan pengaturan toko tidak berubah`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());
      const isian = {
        nomorWhatsapp: nomor,
        syaratKetentuan: "Syarat baru.",
        kebijakanPrivasi: "Kebijakan baru.",
      };

      const keadaan = await aksiSimpanPengaturanToko(
        keadaanAwal(),
        formulir(isian),
      );

      expect(keadaan).toEqual({
        nilai: isian,
        galat: { nomorWhatsapp: pesan },
      });
      expect(await bacaPengaturanToko()).toEqual(PENGATURAN_AWAL);
    });
  }
});
