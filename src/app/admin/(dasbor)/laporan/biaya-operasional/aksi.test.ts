import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  bacaBiayaOperasional,
  daftarBiayaOperasional,
  tambahBiayaOperasional,
} from "@/server/biaya-operasional";
import { koneksi } from "@/server/db";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import { tanggalIsianWib } from "@/server/zona-waktu-toko";

import {
  aksiHapusBiayaOperasional,
  aksiTambahBiayaOperasional,
  aksiUbahBiayaOperasional,
} from "./aksi";

// Test integrasi Server Action Biaya operasional (PRD §14.4, issue T69) dengan database app_test dari .env.ci.
// Header permintaan yang dibaca aksi lewat next/headers diganti dengan cookie milik pengunjung di setiap test.
// Database dipakai bersama test lain, jadi setiap test mengenali biayanya sendiri lewat keterangan yang unik dan
// hanya mencatat biaya bertanggal bulan berjalan (bulan lain dipakai src/server/biaya-operasional.test.ts).
vi.mock("next/headers", () => ({ headers: vi.fn() }));

function sebagaiPengunjung(kepala: Headers) {
  vi.mocked(headers).mockResolvedValue(kepala);
}

function formulir(isian: Record<string, string>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) data.set(nama, nilai);
  return data;
}

const hariIni = tanggalIsianWib(new Date());
const bulanIni = hariIni.slice(0, 7);
const ALAMAT_BULAN_INI = `/admin/laporan/biaya-operasional?bulan=${bulanIni}`;

/** Tanggal sesudah hari ini (WIB), sebagai "YYYY-MM-DD". */
function besok() {
  const [tahun, bulan, tanggal] = hariIni.split("-").map(Number);
  return new Date(Date.UTC(tahun, bulan - 1, tanggal + 1))
    .toISOString()
    .slice(0, 10);
}

const keteranganUnik = (keterangan: string) =>
  `${keterangan} ${randomUUID().slice(0, 8)}`;

const keadaanAwal = () => ({
  isian: { tanggal: "", keterangan: "", nominal: "" },
});

/** Biaya bulan ini yang keterangannya itu. */
async function biayaBerketerangan(keterangan: string) {
  return (await daftarBiayaOperasional(bulanIni)).biaya.filter(
    (b) => b.keterangan === keterangan,
  );
}

/** Keterangan 101 karakter dari tests/golden/isian-biaya-operasional.json. */
const KETERANGAN_101 =
  "Sewa server bulan November untuk toko MIWE Digital Store, dibayar lewat transfer bank ke penyedia VP!";

afterAll(async () => {
  await koneksi.end();
});

describe("mencatat Biaya operasional (PRD §14.4)", () => {
  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan biaya tidak dicatat", async () => {
    sebagaiPengunjung(new Headers());
    const keterangan = keteranganUnik("Uji biaya tamu");

    await expect(
      aksiTambahBiayaOperasional(
        keadaanAwal(),
        formulir({ tanggal: hariIni, keterangan, nominal: "10000" }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await biayaBerketerangan(keterangan)).toEqual([]);
  });

  it("Admin mencatat biaya hari ini Rp 10.000 dengan spasi di tepi keterangan, lalu dibawa ke daftar bulan ini", async () => {
    sebagaiPengunjung(await cookieAdminBaru());
    const keterangan = keteranganUnik("Uji biaya");

    await expect(
      aksiTambahBiayaOperasional(
        keadaanAwal(),
        formulir({
          tanggal: hariIni,
          keterangan: `  ${keterangan}  `,
          nominal: "10.000",
        }),
      ),
    ).rejects.toSatisfy(arahKe(ALAMAT_BULAN_INI));

    expect(await biayaBerketerangan(keterangan)).toEqual([
      expect.objectContaining({ tanggal: hariIni, keterangan, nominal: 10000 }),
    ]);
  });

  it("tanggal besok, keterangan yang hanya berisi spasi, dan nominal 0 ditolak dengan pesan di isiannya", async () => {
    sebagaiPengunjung(await cookieAdminBaru());
    const isian = { tanggal: besok(), keterangan: "   ", nominal: "0" };

    expect(
      await aksiTambahBiayaOperasional(keadaanAwal(), formulir(isian)),
    ).toEqual({
      isian,
      galat: {
        tanggal:
          "Tanggal ini belum terjadi. Pilih tanggal paling lambat hari ini, dan periksa juga tahunnya.",
        keterangan:
          "Keterangan belum diisi. Ketik untuk apa biaya ini, misalnya Sewa server November.",
        nominal: "Nominal kurang dari Rp 1. Isi nominal minimal Rp 1.",
      },
    });
  });

  it("keterangan 101 karakter ditolak dengan pesan di isiannya, dan biaya tidak dicatat", async () => {
    sebagaiPengunjung(await cookieAdminBaru());
    const isian = {
      tanggal: hariIni,
      keterangan: KETERANGAN_101,
      nominal: "150000",
    };

    expect(
      await aksiTambahBiayaOperasional(keadaanAwal(), formulir(isian)),
    ).toEqual({
      isian,
      galat: {
        keterangan:
          "Keterangan lebih dari 100 karakter. Persingkat menjadi paling banyak 100 karakter.",
      },
    });
    expect(await biayaBerketerangan(KETERANGAN_101)).toEqual([]);
  });

  it("isian kosong, tanggal yang tidak ada, dan nominal yang bukan angka atau bersen ditolak dengan pesan di isiannya", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    expect(
      (
        await aksiTambahBiayaOperasional(
          keadaanAwal(),
          formulir({ tanggal: "", keterangan: "Sewa server", nominal: "" }),
        )
      ).galat,
    ).toEqual({
      tanggal:
        "Tanggal belum diisi. Pilih tanggal biayanya, paling lambat hari ini.",
      nominal:
        "Nominal belum diisi. Ketik nominalnya dalam rupiah, misalnya 150.000.",
    });
    expect(
      (
        await aksiTambahBiayaOperasional(
          keadaanAwal(),
          formulir({
            tanggal: "2026-02-30",
            keterangan: "Sewa server",
            nominal: "seratus",
          }),
        )
      ).galat,
    ).toEqual({
      tanggal:
        "Tanggal tidak terbaca. Pilih tanggalnya dari isian, paling lambat hari ini.",
      nominal:
        "Nominal tidak terbaca sebagai rupiah. Ketik angkanya saja, misalnya 150000 atau 150.000.",
    });
    expect(
      (
        await aksiTambahBiayaOperasional(
          keadaanAwal(),
          formulir({
            tanggal: hariIni,
            keterangan: "Sewa server",
            nominal: "1.500,5",
          }),
        )
      ).galat,
    ).toEqual({
      nominal:
        "Nominal harus rupiah bulat, tanpa sen. Hapus angka di belakang koma.",
    });
    expect(
      (
        await aksiTambahBiayaOperasional(
          keadaanAwal(),
          formulir({
            tanggal: hariIni,
            keterangan: "Sewa server",
            nominal: "-5000",
          }),
        )
      ).galat,
    ).toEqual({
      nominal: "Nominal kurang dari Rp 1. Isi nominal minimal Rp 1.",
    });
  });
});

describe("mengubah dan menghapus Biaya operasional (PRD §14.4)", () => {
  it("Admin mengubah nominal Uji biaya menjadi Rp 12.000, lalu dibawa ke daftar bulan biaya itu", async () => {
    sebagaiPengunjung(await cookieAdminBaru());
    const keterangan = keteranganUnik("Uji biaya");
    const { id } = await tambahBiayaOperasional({
      tanggal: hariIni,
      keterangan,
      nominal: 10000,
    });

    await expect(
      aksiUbahBiayaOperasional(
        keadaanAwal(),
        formulir({ id, tanggal: hariIni, keterangan, nominal: "12000" }),
      ),
    ).rejects.toSatisfy(arahKe(ALAMAT_BULAN_INI));

    expect(await bacaBiayaOperasional(id)).toMatchObject({ nominal: 12000 });
  });

  it("isian ubah yang ditolak tidak mengubah biaya", async () => {
    sebagaiPengunjung(await cookieAdminBaru());
    const keterangan = keteranganUnik("Uji biaya");
    const { id } = await tambahBiayaOperasional({
      tanggal: hariIni,
      keterangan,
      nominal: 10000,
    });

    const hasil = await aksiUbahBiayaOperasional(
      keadaanAwal(),
      formulir({ id, tanggal: besok(), keterangan, nominal: "10000" }),
    );

    expect(Object.keys(hasil.galat ?? {})).toEqual(["tanggal"]);
    expect(await bacaBiayaOperasional(id)).toMatchObject({
      tanggal: hariIni,
    });
  });

  it("Tamu tidak bisa mengubah atau menghapus biaya", async () => {
    sebagaiPengunjung(new Headers());
    const keterangan = keteranganUnik("Uji biaya");
    const { id } = await tambahBiayaOperasional({
      tanggal: hariIni,
      keterangan,
      nominal: 10000,
    });

    await expect(
      aksiUbahBiayaOperasional(
        keadaanAwal(),
        formulir({ id, tanggal: hariIni, keterangan, nominal: "1" }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));
    await expect(
      aksiHapusBiayaOperasional({}, formulir({ id })),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await bacaBiayaOperasional(id)).toMatchObject({ nominal: 10000 });
  });

  it("Admin menghapus biaya, lalu dibawa ke daftar bulan biaya itu", async () => {
    sebagaiPengunjung(await cookieAdminBaru());
    const { id } = await tambahBiayaOperasional({
      tanggal: hariIni,
      keterangan: keteranganUnik("Uji biaya"),
      nominal: 10000,
    });

    await expect(
      aksiHapusBiayaOperasional({}, formulir({ id })),
    ).rejects.toSatisfy(arahKe(ALAMAT_BULAN_INI));

    expect(await bacaBiayaOperasional(id)).toBeNull();
  });

  it("biaya yang tidak ada menampilkan halaman tidak ditemukan", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiHapusBiayaOperasional({}, formulir({ id: randomUUID() })),
    ).rejects.toSatisfy(tidakDitemukan);
    await expect(
      aksiUbahBiayaOperasional(
        keadaanAwal(),
        formulir({
          id: "bukan-id",
          tanggal: hariIni,
          keterangan: "Sewa server",
          nominal: "1",
        }),
      ),
    ).rejects.toSatisfy(tidakDitemukan);
  });
});
