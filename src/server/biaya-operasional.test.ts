import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import {
  bacaBiayaOperasional,
  bulanPertamaBiayaOperasional,
  daftarBiayaOperasional,
  hapusBiayaOperasional,
  tambahBiayaOperasional,
  ubahBiayaOperasional,
} from "./biaya-operasional";
import { koneksi } from "./db";
import { tanggalIsianWib } from "./zona-waktu-toko";

// Test integrasi dengan database app_test dari .env.ci (PRD §14.4, issue T69). Database itu dipakai bersama test
// lain yang berjalan paralel. Biaya bulan berjalan juga dicatat test Server Action, jadi hanya bulan lalu dan
// bulan-bulan sebelumnya yang daftarnya diperiksa utuh di sini; tidak ada test lain yang mencatat biaya di sana.

afterAll(async () => {
  await koneksi.end();
});

/** Bulan "YYYY-MM" yang bergeser `geser` bulan dari bulan "YYYY-MM" itu. */
function bulanGeser(bulan: string, geser: number) {
  const [tahun, nomor] = bulan.split("-").map(Number);
  const hasil = new Date(Date.UTC(tahun, nomor - 1 + geser, 1));
  return hasil.toISOString().slice(0, 7);
}

/** Tanggal terakhir bulan "YYYY-MM" itu, sebagai "YYYY-MM-DD". */
function tanggalTerakhir(bulan: string) {
  const [tahun, nomor] = bulan.split("-").map(Number);
  return new Date(Date.UTC(tahun, nomor, 0)).toISOString().slice(0, 10);
}

const hariIni = tanggalIsianWib(new Date());
const bulanIni = hariIni.slice(0, 7);
const bulanLalu = bulanGeser(bulanIni, -1);
const duaBulanLalu = bulanGeser(bulanIni, -2);

/** Keterangan unik per test, supaya biaya test ini bisa dikenali di database bersama. */
const keteranganUnik = (keterangan: string) =>
  `${keterangan} ${randomUUID().slice(0, 8)}`;

describe("daftar Biaya operasional sebulan (PRD §14.4)", () => {
  it("memilih bulan lalu hanya menampilkan biaya bertanggal bulan lalu, terbaru di atas, beserta totalnya", async () => {
    const awalBulanLalu = keteranganUnik("Sewa server bulan lalu");
    const akhirBulanLalu = keteranganUnik("Iklan Instagram");
    await tambahBiayaOperasional({
      tanggal: `${bulanLalu}-01`,
      keterangan: awalBulanLalu,
      nominal: 150000,
    });
    await tambahBiayaOperasional({
      tanggal: tanggalTerakhir(bulanLalu),
      keterangan: akhirBulanLalu,
      nominal: 75000,
    });
    // Di luar bulan lalu: hari terakhir dua bulan lalu dan hari ini.
    await tambahBiayaOperasional({
      tanggal: tanggalTerakhir(duaBulanLalu),
      keterangan: keteranganUnik("Domain dua bulan lalu"),
      nominal: 200000,
    });
    await tambahBiayaOperasional({
      tanggal: hariIni,
      keterangan: keteranganUnik("Biaya bulan ini"),
      nominal: 10000,
    });

    const daftar = await daftarBiayaOperasional(bulanLalu);

    expect(
      daftar.biaya.map(({ tanggal, keterangan, nominal }) => ({
        tanggal,
        keterangan,
        nominal,
      })),
    ).toEqual([
      {
        tanggal: tanggalTerakhir(bulanLalu),
        keterangan: akhirBulanLalu,
        nominal: 75000,
      },
      {
        tanggal: `${bulanLalu}-01`,
        keterangan: awalBulanLalu,
        nominal: 150000,
      },
    ]);
    expect(daftar.total).toBe(225000);
  });

  it("biaya bertanggal sama diurutkan dengan yang terakhir dicatat di atas", async () => {
    const bulan = bulanGeser(bulanIni, -3);
    const pertama = keteranganUnik("Dicatat pertama");
    const kedua = keteranganUnik("Dicatat kedua");
    await tambahBiayaOperasional({
      tanggal: `${bulan}-15`,
      keterangan: pertama,
      nominal: 1000,
    });
    await tambahBiayaOperasional({
      tanggal: `${bulan}-15`,
      keterangan: kedua,
      nominal: 2000,
    });

    const daftar = await daftarBiayaOperasional(bulan);

    expect(daftar.biaya.map((b) => b.keterangan)).toEqual([kedua, pertama]);
    expect(daftar.total).toBe(3000);
  });

  it("bulan tanpa biaya bertotal Rp 0", async () => {
    expect(await daftarBiayaOperasional("2001-01")).toEqual({
      biaya: [],
      total: 0,
    });
  });

  it("bulan pertama adalah bulan biaya bertanggal paling awal", async () => {
    await tambahBiayaOperasional({
      tanggal: "2002-02-14",
      keterangan: keteranganUnik("Biaya paling awal"),
      nominal: 1,
    });
    expect(await bulanPertamaBiayaOperasional()).toBe("2002-02");
  });
});

describe("mengubah dan menghapus Biaya operasional (PRD §14.4)", () => {
  it("mengubah nominal memperbarui total bulannya, dan menghapus biaya mengeluarkannya dari daftar", async () => {
    const bulan = bulanGeser(bulanIni, -4);
    const { id } = await tambahBiayaOperasional({
      tanggal: `${bulan}-10`,
      keterangan: "Uji biaya",
      nominal: 10000,
    });

    expect(
      await ubahBiayaOperasional({
        id,
        tanggal: `${bulan}-10`,
        keterangan: "Uji biaya",
        nominal: 12000,
      }),
    ).toEqual({ hasil: "diubah" });
    expect(await bacaBiayaOperasional(id)).toMatchObject({
      tanggal: `${bulan}-10`,
      keterangan: "Uji biaya",
      nominal: 12000,
    });
    expect((await daftarBiayaOperasional(bulan)).total).toBe(12000);

    expect(await hapusBiayaOperasional(id)).toEqual({
      hasil: "dihapus",
      tanggal: `${bulan}-10`,
    });
    expect(await bacaBiayaOperasional(id)).toBeNull();
    expect(await daftarBiayaOperasional(bulan)).toEqual({
      biaya: [],
      total: 0,
    });
  });

  it("biaya yang tidak ada tidak bisa diubah atau dihapus", async () => {
    const id = randomUUID();
    expect(
      await ubahBiayaOperasional({
        id,
        tanggal: "2003-01-01",
        keterangan: "Tidak ada",
        nominal: 1,
      }),
    ).toEqual({ hasil: "tidak-ada" });
    expect(await hapusBiayaOperasional(id)).toEqual({ hasil: "tidak-ada" });
  });
});
