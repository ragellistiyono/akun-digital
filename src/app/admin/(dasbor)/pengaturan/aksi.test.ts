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
  ambangStokMenipis: 5,
};

/** Isian form seperti yang dikirim browser: semua nilainya teks. */
const ISIAN_AWAL = {
  ...PENGATURAN_AWAL,
  ambangStokMenipis: "5",
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
  nilai: { ...ISIAN_AWAL },
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
          ambangStokMenipis: "3",
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
        ambangStokMenipis: "3",
      }),
    );

    const tersimpan = {
      nomorWhatsapp: "6281234567890",
      syaratKetentuan: "Pasal satu.\nPasal dua.",
      kebijakanPrivasi: "Data dipakai untuk Pesanan.",
    };
    expect(keadaan).toEqual({
      nilai: { ...tersimpan, ambangStokMenipis: "3" },
      tersimpan: true,
    });
    expect(await bacaPengaturanToko()).toEqual({
      ...tersimpan,
      ambangStokMenipis: 3,
    });
  });

  it("nomor WhatsApp yang dikosongkan tersimpan sebagai belum diisi", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiSimpanPengaturanToko(
      keadaanAwal(),
      formulir({ ...ISIAN_AWAL, nomorWhatsapp: "  " }),
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
        ambangStokMenipis: "3",
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

  // PRD §9.4 ▶ Keputusan 2026-11-17 dan tests/golden/ambang-stok-menipis.json: Ambang stok menipis
  // berupa bilangan bulat 0 sampai 999.
  for (const ambang of ["0", "999"]) {
    it(`Admin menyimpan Ambang stok menipis ${ambang}`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());

      const keadaan = await aksiSimpanPengaturanToko(
        keadaanAwal(),
        formulir({ ...ISIAN_AWAL, ambangStokMenipis: ` ${ambang} ` }),
      );

      expect(keadaan.tersimpan).toBe(true);
      expect(keadaan.nilai.ambangStokMenipis).toBe(ambang);
      expect((await bacaPengaturanToko()).ambangStokMenipis).toBe(
        Number(ambang),
      );
    });
  }

  for (const { ambang, pesan } of [
    {
      ambang: "1000",
      pesan:
        "Ambang stok menipis hanya boleh 0 sampai 999. Tulis angka di rentang itu, lalu simpan lagi.",
    },
    {
      ambang: "-1",
      pesan:
        "Ambang stok menipis hanya boleh 0 sampai 999. Tulis angka di rentang itu, lalu simpan lagi.",
    },
    {
      ambang: "2,5",
      pesan:
        "Ambang stok menipis harus bilangan bulat, tanpa koma, titik, atau huruf. Tulis angka 0 sampai 999, misalnya 5, lalu simpan lagi.",
    },
    {
      ambang: "2.5",
      pesan:
        "Ambang stok menipis harus bilangan bulat, tanpa koma, titik, atau huruf. Tulis angka 0 sampai 999, misalnya 5, lalu simpan lagi.",
    },
    {
      ambang: "",
      pesan:
        "Ambang stok menipis harus bilangan bulat, tanpa koma, titik, atau huruf. Tulis angka 0 sampai 999, misalnya 5, lalu simpan lagi.",
    },
  ]) {
    it(`Ambang stok menipis "${ambang}" ditolak dengan pesan, dan pengaturan toko tidak berubah`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());
      const isian = {
        nomorWhatsapp: "0812-3456-7890",
        syaratKetentuan: "Syarat baru.",
        kebijakanPrivasi: "Kebijakan baru.",
        ambangStokMenipis: ambang,
      };

      const keadaan = await aksiSimpanPengaturanToko(
        keadaanAwal(),
        formulir(isian),
      );

      expect(keadaan).toEqual({
        nilai: isian,
        galat: { ambangStokMenipis: pesan },
      });
      expect(await bacaPengaturanToko()).toEqual(PENGATURAN_AWAL);
    });
  }

  it("nomor WhatsApp dan Ambang stok menipis yang sama-sama salah ditolak dengan pesan untuk keduanya", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiSimpanPengaturanToko(
      keadaanAwal(),
      formulir({
        ...ISIAN_AWAL,
        nomorWhatsapp: "+1 555 0100",
        ambangStokMenipis: "1000",
      }),
    );

    expect(keadaan.galat).toEqual({
      nomorWhatsapp:
        "Nomor WhatsApp harus nomor Indonesia, yang diawali 0, 62, atau +62. Tulis nomornya misalnya 0812-3456-7890, lalu simpan lagi.",
      ambangStokMenipis:
        "Ambang stok menipis hanya boleh 0 sampai 999. Tulis angka di rentang itu, lalu simpan lagi.",
    });
    expect(await bacaPengaturanToko()).toEqual(PENGATURAN_AWAL);
  });
});
