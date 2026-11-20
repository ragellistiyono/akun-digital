import { headers } from "next/headers";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { koneksi } from "@/server/db";
import {
  bacaPengaturanBiayaTransaksi,
  bacaPengaturanToko,
  simpanPengaturanToko,
} from "@/server/pengaturan-toko";
import { arahKe, cookieAdminBaru } from "@/server/uji-admin";
import { kunciPengaturanToko } from "@/server/uji-pengaturan-toko";

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

/** Nilai awal Biaya transaksi (PRD §14.3). */
const BIAYA_TRANSAKSI_AWAL = { persen: 0.7, minimalTotalBayar: 100000 };

/** Isian Biaya transaksi nilai awal, seperti yang tampil di form. */
const ISIAN_BIAYA_AWAL = {
  persenBiayaTransaksi: "0,7",
  minimalBiayaTransaksi: "100.000",
};

/** Isian form seperti yang dikirim browser: semua nilainya teks. */
const ISIAN_AWAL = {
  ...PENGATURAN_AWAL,
  ambangStokMenipis: "5",
  ...ISIAN_BIAYA_AWAL,
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

// Pengaturan toko berlaku untuk seluruh toko, dan test Biaya transaksi di src/server/kabar-pembayaran.test.ts
// juga mengubahnya, jadi berkas ini memegang kunci Pengaturan toko selama berjalan.
let lepasKunci: () => Promise<void>;
beforeAll(async () => {
  lepasKunci = await kunciPengaturanToko();
});

beforeEach(async () => {
  await simpanPengaturanToko(PENGATURAN_AWAL, BIAYA_TRANSAKSI_AWAL);
});

afterAll(async () => {
  await simpanPengaturanToko(PENGATURAN_AWAL, BIAYA_TRANSAKSI_AWAL);
  await lepasKunci();
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
        ...ISIAN_BIAYA_AWAL,
      }),
    );

    const tersimpan = {
      nomorWhatsapp: "6281234567890",
      syaratKetentuan: "Pasal satu.\nPasal dua.",
      kebijakanPrivasi: "Data dipakai untuk Pesanan.",
    };
    expect(keadaan).toEqual({
      nilai: { ...tersimpan, ambangStokMenipis: "3", ...ISIAN_BIAYA_AWAL },
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
        ...ISIAN_BIAYA_AWAL,
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
        ...ISIAN_BIAYA_AWAL,
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

  // PRD §9.8 ▶ Keputusan 2026-11-20, §14.3, UAT-N2, dan tests/golden/isian-biaya-transaksi.json.
  for (const { isian, tersimpan, tampil } of [
    {
      isian: { persenBiayaTransaksi: "1", minimalBiayaTransaksi: "0" },
      tersimpan: { persen: 1, minimalTotalBayar: 0 },
      tampil: { persenBiayaTransaksi: "1", minimalBiayaTransaksi: "0" },
    },
    {
      isian: {
        persenBiayaTransaksi: " 0,75 ",
        minimalBiayaTransaksi: "250000",
      },
      tersimpan: { persen: 0.75, minimalTotalBayar: 250000 },
      tampil: {
        persenBiayaTransaksi: "0,75",
        minimalBiayaTransaksi: "250.000",
      },
    },
    {
      isian: { persenBiayaTransaksi: "10", minimalBiayaTransaksi: "Rp 1.000" },
      tersimpan: { persen: 10, minimalTotalBayar: 1000 },
      tampil: { persenBiayaTransaksi: "10", minimalBiayaTransaksi: "1.000" },
    },
  ]) {
    it(`Admin menyimpan persen biaya transaksi "${isian.persenBiayaTransaksi}" dan minimal Total bayar "${isian.minimalBiayaTransaksi}"`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());

      const keadaan = await aksiSimpanPengaturanToko(
        keadaanAwal(),
        formulir({ ...ISIAN_AWAL, ...isian }),
      );

      expect(keadaan).toEqual({
        nilai: { ...ISIAN_AWAL, ...tampil },
        tersimpan: true,
      });
      expect(await bacaPengaturanBiayaTransaksi()).toEqual(tersimpan);
      expect(await bacaPengaturanToko()).toEqual(PENGATURAN_AWAL);
    });
  }

  for (const { isian, galat } of [
    {
      isian: { persenBiayaTransaksi: "10,01" },
      galat: {
        persenBiayaTransaksi:
          "Persen biaya transaksi hanya boleh 0 sampai 10. Tulis angka di rentang itu, lalu simpan lagi.",
      },
    },
    {
      isian: { persenBiayaTransaksi: "0,755" },
      galat: {
        persenBiayaTransaksi:
          "Persen biaya transaksi paling banyak 2 angka di belakang koma, misalnya 0,75. Hapus angka berikutnya, lalu simpan lagi.",
      },
    },
    {
      isian: { persenBiayaTransaksi: "-0,1" },
      galat: {
        persenBiayaTransaksi:
          "Persen biaya transaksi hanya boleh 0 sampai 10. Tulis angka di rentang itu, lalu simpan lagi.",
      },
    },
    {
      isian: { persenBiayaTransaksi: " " },
      galat: {
        persenBiayaTransaksi:
          "Persen biaya transaksi belum diisi. Tulis persennya, misalnya 0,7, lalu simpan lagi.",
      },
    },
    {
      isian: { persenBiayaTransaksi: "0.7" },
      galat: {
        persenBiayaTransaksi:
          "Persen biaya transaksi tidak terbaca sebagai angka. Tulis angkanya saja dengan koma desimal, misalnya 0,7, lalu simpan lagi.",
      },
    },
    {
      isian: { persenBiayaTransaksi: "0,7%" },
      galat: {
        persenBiayaTransaksi:
          "Persen biaya transaksi tidak terbaca sebagai angka. Tulis angkanya saja dengan koma desimal, misalnya 0,7, lalu simpan lagi.",
      },
    },
    {
      isian: { minimalBiayaTransaksi: "-1" },
      galat: {
        minimalBiayaTransaksi:
          "Minimal Total bayar kurang dari Rp 0. Isi minimal Rp 0, lalu simpan lagi.",
      },
    },
    {
      isian: { minimalBiayaTransaksi: "1.000,5" },
      galat: {
        minimalBiayaTransaksi:
          "Minimal Total bayar harus rupiah bulat, tanpa sen. Hapus angka di belakang koma, lalu simpan lagi.",
      },
    },
    {
      isian: { minimalBiayaTransaksi: "" },
      galat: {
        minimalBiayaTransaksi:
          "Minimal Total bayar belum diisi. Ketik rupiahnya, misalnya 100.000, atau 0 bila semua Pesanan dikenai biaya, lalu simpan lagi.",
      },
    },
    {
      isian: { minimalBiayaTransaksi: "seratus ribu" },
      galat: {
        minimalBiayaTransaksi:
          "Minimal Total bayar tidak terbaca sebagai rupiah. Ketik angkanya saja, misalnya 100000 atau 100.000, lalu simpan lagi.",
      },
    },
    {
      isian: { persenBiayaTransaksi: "11", minimalBiayaTransaksi: "-5" },
      galat: {
        persenBiayaTransaksi:
          "Persen biaya transaksi hanya boleh 0 sampai 10. Tulis angka di rentang itu, lalu simpan lagi.",
        minimalBiayaTransaksi:
          "Minimal Total bayar kurang dari Rp 0. Isi minimal Rp 0, lalu simpan lagi.",
      },
    },
  ]) {
    it(`isian Biaya transaksi ${JSON.stringify(isian)} ditolak dengan pesan, dan pengaturan toko tidak berubah`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());
      const dikirim = { ...ISIAN_AWAL, ambangStokMenipis: "3", ...isian };

      const keadaan = await aksiSimpanPengaturanToko(
        keadaanAwal(),
        formulir(dikirim),
      );

      expect(keadaan).toEqual({ nilai: dikirim, galat });
      expect(await bacaPengaturanBiayaTransaksi()).toEqual(
        BIAYA_TRANSAKSI_AWAL,
      );
      expect(await bacaPengaturanToko()).toEqual(PENGATURAN_AWAL);
    });
  }
});
