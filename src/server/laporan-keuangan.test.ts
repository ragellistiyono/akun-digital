import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { tambahBiayaOperasional } from "./biaya-operasional";
import { db, koneksi } from "./db";
import { kategori, produk, user, varian } from "./db/schema";
import {
  grafikLaporan,
  pilihanSaringanLaporan,
  rincianLaporan,
  tabelPesananLaporan,
} from "./laporan-keuangan";
import goldenProdukTerlaris from "../../tests/golden/produk-terlaris-tanpa-kode-unik.json";
import { sisipkanKategori, sisipkanProduk } from "./uji-katalog";
import { sisipkanMember } from "./uji-member";
import { sisipkanPesanan } from "./uji-pesanan";
import { sisipkanTopUp } from "./uji-top-up";

// Test integrasi dengan database app_test (.env.ci), yang dipakai bersama test lain. Test lain membuat Pesanan
// yang dibayar dan Biaya operasional bertanggal sekitar waktu nyata, November 2026, atau tahun 2031, jadi setiap
// test di sini memakai rentang pada tanggal tersendiri di tahun 2032 (Top up: 2033, di bulan yang tidak dipakai test
// Ringkasan), atau menyaring ke Produk dan Kategori-nya sendiri.

afterAll(async () => {
  await koneksi.end();
});

/** Produk uji dengan satu Varian di Kategori itu, atau di Kategori barunya sendiri. Hasilnya id keduanya. */
async function produkUji({
  nama = "Laporan",
  kategoriId,
}: { nama?: string; kategoriId?: string } = {}) {
  const produkId = await sisipkanProduk({
    nama: `${nama} ${randomUUID().slice(0, 8)}`,
    kategoriId,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return { produkId, varianId };
}

/** Tiga Pesanan Selesai contoh PRD §14.5, dibayar pada tanggal WIB itu. */
async function sisipkanContohPrd(varianId: string, tanggal: string) {
  for (const [jam, rincian, hargaModal, biayaTransaksi] of [
    [
      "09:00",
      {
        hargaJual: 50000,
        potonganVoucher: 5000,
        kodeUnik: 123,
        totalBayar: 45123,
      },
      35000,
      0,
    ],
    [
      "13:30",
      { hargaJual: 50000, potonganVoucher: 0, kodeUnik: 10, totalBayar: 50010 },
      35000,
      0,
    ],
    [
      "20:45",
      {
        hargaJual: 135000,
        potonganVoucher: 0,
        kodeUnik: 499,
        totalBayar: 135499,
      },
      100000,
      949,
    ],
  ] as const) {
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      rincian,
      hargaModal,
      biayaTransaksi,
      waktuBayar: new Date(`${tanggal}T${jam}:00+07:00`),
    });
  }
}

/** Id Member baru dengan email unik, pemilik Top up uji. */
async function memberUji() {
  const email = `laporan-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return id;
}

/** Top up Berhasil contoh PRD §15.8: Nominal top up Rp 150.000, Kode unik Rp 200, Biaya transaksi Rp 1.052. */
const topUpContohPrd = async (waktuBayar: string) =>
  sisipkanTopUp({
    userId: await memberUji(),
    status: "Berhasil",
    nominalTopUp: 150000,
    kodeUnik: 200,
    biayaTransaksi: 1052,
    waktuBayar: new Date(waktuBayar),
  });

/** Pesanan saldo Selesai contoh PRD §15.8: Harga jual Rp 50.000 tanpa Voucher, Harga modal Rp 35.000. */
const pesananSaldoContohPrd = (varianId: string, waktuBayar: string) =>
  sisipkanPesanan({
    varianId,
    status: "Selesai",
    metode: "Saldo",
    rincian: {
      hargaJual: 50000,
      potonganVoucher: 0,
      kodeUnik: 0,
      totalBayar: 50000,
    },
    hargaModal: 35000,
    biayaTransaksi: 0,
    waktuBayar: new Date(waktuBayar),
  });

// PRD §14.5 dan §14.6 ▶ Keputusan 2026-11-20 dan 2026-11-23, §15.8: Top up dan saringan Metode, tanpa Kode unik dan
// Kode unik Top up. Angkanya dari tests/golden/laba-top-up-tanpa-kode-unik.json.
describe("rincianLaporan dengan Top up dan saringan Metode (PRD §14.5, §14.6, §15.8)", () => {
  it("contoh PRD §14.5 ditambah satu Top up Berhasil memberi Laba bersih Rp 47.999, sedangkan Pendapatan tetap Rp 230.000 dan Top up Bermasalah tidak dihitung", async () => {
    const { varianId } = await produkUji();
    await sisipkanContohPrd(varianId, "2033-02-10");
    await tambahBiayaOperasional({
      tanggal: "2033-02-10",
      keterangan: `Iklan ${randomUUID().slice(0, 8)}`,
      nominal: 10000,
    });
    await topUpContohPrd("2033-02-10T10:00:00+07:00");
    await sisipkanTopUp({
      userId: await memberUji(),
      status: "Bermasalah",
      biayaTransaksi: 0,
      waktuBayar: new Date("2033-02-10T11:00:00+07:00"),
    });

    const rincian = await rincianLaporan({
      dari: "2033-02-10",
      sampai: "2033-02-10",
    });

    expect(rincian).toMatchObject({
      pendapatan: 230000,
      biayaOperasional: 10000,
      biayaTransaksiTopUp: 1052,
      labaBersih: 47999,
      topUpBerhasil: { jumlah: 1, nominal: 150000 },
    });
  });

  it("saringan Metode QRIS dan Saldo hanya menghitung Pesanan bermetode itu, tanpa Biaya operasional dan Top up", async () => {
    const { varianId } = await produkUji();
    await sisipkanContohPrd(varianId, "2033-03-10");
    await pesananSaldoContohPrd(varianId, "2033-03-10T10:20:00+07:00");
    await tambahBiayaOperasional({
      tanggal: "2033-03-10",
      keterangan: `Iklan ${randomUUID().slice(0, 8)}`,
      nominal: 10000,
    });
    await topUpContohPrd("2033-03-10T10:00:00+07:00");
    const rentang = { dari: "2033-03-10", sampai: "2033-03-10" };

    const qris = await rincianLaporan({ ...rentang, metode: "QRIS" });
    const saldo = await rincianLaporan({ ...rentang, metode: "Saldo" });

    expect(qris).toMatchObject({
      pendapatan: 230000,
      pesananSelesai: 3,
      biayaOperasional: null,
      biayaTransaksiTopUp: null,
      labaBersih: 59051,
      topUpBerhasil: null,
    });
    expect(saldo).toMatchObject({
      pendapatan: 50000,
      pesananSelesai: 1,
      biayaOperasional: null,
      biayaTransaksiTopUp: null,
      labaBersih: 15000,
      topUpBerhasil: null,
    });
  });
});

describe("rincianLaporan (PRD §14.5, §14.6)", () => {
  it("rentang satu hari yang berisi contoh PRD §14.5 ▶ Keputusan 2026-11-23 menghasilkan angka contoh itu sampai Laba bersih Rp 49.051, tanpa Kode unik", async () => {
    const { varianId } = await produkUji();
    await sisipkanContohPrd(varianId, "2032-03-10");
    await tambahBiayaOperasional({
      tanggal: "2032-03-10",
      keterangan: `Iklan ${randomUUID().slice(0, 8)}`,
      nominal: 10000,
    });
    // Di luar rentang: sehari sebelum dan sesudahnya.
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      hargaModal: 35000,
      biayaTransaksi: 0,
      waktuBayar: new Date("2032-03-09T23:59:59+07:00"),
    });
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      hargaModal: 35000,
      biayaTransaksi: 0,
      waktuBayar: new Date("2032-03-11T00:00:00+07:00"),
    });

    const rincian = await rincianLaporan({
      dari: "2032-03-10",
      sampai: "2032-03-10",
    });

    expect({
      pendapatan: rincian.pendapatan,
      pesananSelesai: rincian.pesananSelesai,
      totalHargaModal: rincian.totalHargaModal,
      labaKotor: rincian.labaKotor,
      potonganVoucher: rincian.potonganVoucher,
      biayaTransaksi: rincian.biayaTransaksi,
      biayaOperasional: rincian.biayaOperasional,
      labaBersih: rincian.labaBersih,
      pesananTanpaHargaModal: rincian.pesananTanpaHargaModal,
    }).toEqual({
      pendapatan: 230000,
      pesananSelesai: 3,
      totalHargaModal: 170000,
      labaKotor: 65000,
      potonganVoucher: 5000,
      biayaTransaksi: 949,
      biayaOperasional: 10000,
      labaBersih: 49051,
      pesananTanpaHargaModal: 0,
    });
  });

  it("saringan Produk atau Kategori tidak mengurangkan Biaya operasional, dan hanya menghitung Pesanan Produk atau Kategori itu", async () => {
    const kategoriId = await sisipkanKategori({
      nama: `Streaming ${randomUUID().slice(0, 8)}`,
    });
    const { produkId, varianId } = await produkUji({ kategoriId });
    const lain = await produkUji({ kategoriId });
    await sisipkanContohPrd(varianId, "2032-04-10");
    await sisipkanContohPrd(lain.varianId, "2032-04-10");
    await tambahBiayaOperasional({
      tanggal: "2032-04-10",
      keterangan: `Iklan ${randomUUID().slice(0, 8)}`,
      nominal: 10000,
    });

    const perProduk = await rincianLaporan({
      dari: "2032-04-10",
      sampai: "2032-04-10",
      produkId,
    });
    const perKategori = await rincianLaporan({
      dari: "2032-04-10",
      sampai: "2032-04-10",
      kategoriId,
    });

    expect(perProduk.pendapatan).toBe(230000);
    expect(perProduk.biayaOperasional).toBeNull();
    expect(perProduk.labaBersih).toBe(59051);
    expect(perKategori.pendapatan).toBe(460000);
    expect(perKategori.biayaOperasional).toBeNull();
    expect(perKategori.labaBersih).toBe(118102);
  });

  it("Pesanan dari Produk yang dipindah Kategori terhitung di Kategori barunya", async () => {
    const kategoriLama = await sisipkanKategori({
      nama: `Musik ${randomUUID().slice(0, 8)}`,
    });
    const kategoriBaru = await sisipkanKategori({
      nama: `Streaming ${randomUUID().slice(0, 8)}`,
    });
    const { produkId, varianId } = await produkUji({
      kategoriId: kategoriLama,
    });
    await sisipkanContohPrd(varianId, "2032-05-10");

    await db
      .update(produk)
      .set({ kategoriId: kategoriBaru })
      .where(eq(produk.id, produkId));

    const saringan = { dari: "2032-05-10", sampai: "2032-05-10" };
    expect(
      (await rincianLaporan({ ...saringan, kategoriId: kategoriBaru }))
        .pendapatan,
    ).toBe(230000);
    expect(
      (await rincianLaporan({ ...saringan, kategoriId: kategoriLama }))
        .pesananSelesai,
    ).toBe(0);
  });
});

describe("tabelPesananLaporan (PRD §14.8)", () => {
  it("memuat Pesanan Selesai dalam saringan dengan kolom PRD §14.8, terbaru dibayar di atas, 50 per halaman", async () => {
    const { produkId, varianId } = await produkUji();
    // 51 Pesanan Selesai, dibayar setiap menit mulai 08.00 WIB 6 Juni 2032.
    for (let menit = 0; menit < 51; menit++) {
      await sisipkanPesanan({
        varianId,
        status: "Selesai",
        hargaModal: 35000,
        biayaTransaksi: 0,
        waktuBayar: new Date(
          Date.parse("2032-06-06T08:00:00+07:00") + menit * 60_000,
        ),
      });
    }
    // Bukan Pesanan Selesai: tidak masuk tabel.
    for (const status of ["Bermasalah", "Dana Dikembalikan"] as const) {
      await sisipkanPesanan({
        varianId,
        status,
        waktuBayar: new Date("2032-06-06T09:30:00+07:00"),
      });
    }
    const saringan = { dari: "2032-06-06", sampai: "2032-06-06", produkId };

    const pertama = await tabelPesananLaporan(saringan);
    const kedua = await tabelPesananLaporan({ ...saringan, halaman: 2 });

    expect(pertama.jumlah).toBe(51);
    expect(pertama.jumlahHalaman).toBe(2);
    expect(pertama.pesanan).toHaveLength(50);
    expect(pertama.pesanan[0].waktuBayar).toEqual(
      new Date("2032-06-06T08:50:00+07:00"),
    );
    expect(kedua.pesanan).toHaveLength(1);
    expect(kedua.pesanan[0].waktuBayar).toEqual(
      new Date("2032-06-06T08:00:00+07:00"),
    );
    // Kolom PRD §14.8 dan Metode (§14.6 ▶ Keputusan 2026-11-20), dengan rincian contoh PRD §5.5 dari
    // sisipkanPesanan.
    expect(Object.keys(kedua.pesanan[0]).sort()).toEqual(
      [
        "nomorPesanan",
        "waktuBayar",
        "metode",
        "namaProduk",
        "namaVarian",
        "hargaJual",
        "hargaModal",
        "labaKotor",
        "potonganVoucher",
        "kodeUnik",
        "biayaTransaksi",
        "totalBayar",
      ].sort(),
    );
    expect(kedua.pesanan[0]).toMatchObject({
      namaVarian: "1 Bulan",
      hargaJual: 50000,
      hargaModal: 35000,
      labaKotor: 15000,
      potonganVoucher: 5000,
      kodeUnik: 123,
      biayaTransaksi: 0,
      totalBayar: 45123,
    });
  });

  it("Pesanan tanpa Harga modal tidak punya Laba kotor, dan pencarian sebagian email dalam huruf besar menyaring tabel", async () => {
    const { produkId, varianId } = await produkUji();
    const akhiran = randomUUID().slice(0, 8);
    const dicari = await sisipkanPesanan({
      varianId,
      status: "Selesai",
      email: `sari-${akhiran}@example.test`,
      biayaTransaksi: 0,
      waktuBayar: new Date("2032-07-07T10:00:00+07:00"),
    });
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      hargaModal: 35000,
      biayaTransaksi: 0,
      waktuBayar: new Date("2032-07-07T11:00:00+07:00"),
    });
    const saringan = { dari: "2032-07-07", sampai: "2032-07-07", produkId };

    const hasil = await tabelPesananLaporan({
      ...saringan,
      cari: `SARI-${akhiran}`.toUpperCase(),
    });
    const tanpaHasil = await tabelPesananLaporan({
      ...saringan,
      cari: "tidak-ada-di-mana-pun",
    });

    expect(hasil.pesanan.map((p) => p.nomorPesanan)).toEqual([
      dicari.nomorPesanan,
    ]);
    expect(hasil.pesanan[0]).toMatchObject({
      hargaModal: null,
      labaKotor: null,
    });
    expect(tanpaHasil.jumlah).toBe(0);
  });
});

// PRD §14.6 ▶ Keputusan 2026-11-20: saringan Metode membatasi tabel, dan tabel punya kolom Metode.
describe("tabelPesananLaporan dengan Metode (PRD §14.6, §14.8)", () => {
  it("memuat Metode setiap Pesanan, dan saringan Metode Saldo hanya memuat Pesanan saldo", async () => {
    const { produkId, varianId } = await produkUji();
    const qris = await sisipkanPesanan({
      varianId,
      status: "Selesai",
      biayaTransaksi: 0,
      waktuBayar: new Date("2033-05-05T09:00:00+07:00"),
    });
    const saldo = await pesananSaldoContohPrd(
      varianId,
      "2033-05-05T10:00:00+07:00",
    );
    const saringan = { dari: "2033-05-05", sampai: "2033-05-05", produkId };

    const semua = await tabelPesananLaporan(saringan);
    const hanyaSaldo = await tabelPesananLaporan({
      ...saringan,
      metode: "Saldo",
    });

    expect(
      semua.pesanan.map(({ nomorPesanan, metode }) => ({
        nomorPesanan,
        metode,
      })),
    ).toEqual([
      { nomorPesanan: saldo.nomorPesanan, metode: "Saldo" },
      { nomorPesanan: qris.nomorPesanan, metode: "QRIS" },
    ]);
    expect(hanyaSaldo.pesanan.map((p) => p.nomorPesanan)).toEqual([
      saldo.nomorPesanan,
    ]);
    expect(hanyaSaldo.jumlah).toBe(1);
  });
});

describe("pilihanSaringanLaporan (PRD §14.6)", () => {
  it("pilihan Produk memuat Produk nonaktif beserta Kategori-nya", async () => {
    const kategoriId = await sisipkanKategori({
      nama: `Game ${randomUUID().slice(0, 8)}`,
    });
    const nama = `Nonaktif ${randomUUID().slice(0, 8)}`;
    const produkId = await sisipkanProduk({
      nama,
      kategoriId,
      aktif: false,
      varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
    });

    const pilihan = await pilihanSaringanLaporan();

    expect(pilihan.kategori).toContainEqual({
      id: kategoriId,
      nama: expect.any(String),
    });
    expect(pilihan.produk).toContainEqual({
      id: produkId,
      nama,
      kategoriId,
      aktif: false,
    });
  });
});

describe("grafikLaporan (PRD §14.6, §14.7)", () => {
  it("nilai setiap batang sama dengan Pendapatan dan jumlah Pesanan Selesai kelompoknya, termasuk Pesanan tanpa Harga modal, dan hari tanpa Pesanan Selesai bernilai 0", async () => {
    const { produkId, varianId } = await produkUji();
    await sisipkanContohPrd(varianId, "2032-08-10");
    // Tanpa Harga modal, dengan rincian contoh PRD §5.5 dari sisipkanPesanan: Total bayar Rp 45.123, Pendapatan
    // Rp 45.000 tanpa Kode unik (§9.3 ▶ Keputusan 2026-11-23).
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      biayaTransaksi: 0,
      waktuBayar: new Date("2032-08-12T10:00:00+07:00"),
    });
    // Bukan Pesanan Selesai: tidak dihitung.
    await sisipkanPesanan({
      varianId,
      status: "Bermasalah",
      waktuBayar: new Date("2032-08-11T10:00:00+07:00"),
    });

    const grafik = await grafikLaporan({
      periode: "Harian",
      dari: "2032-08-10",
      sampai: "2032-08-12",
      produkId,
    });

    expect(
      grafik.kelompok.map(({ mulai, akhir, pendapatan, pesananSelesai }) => ({
        mulai,
        akhir,
        pendapatan,
        pesananSelesai,
      })),
    ).toEqual([
      {
        mulai: "2032-08-10",
        akhir: "2032-08-10",
        pendapatan: 230000,
        pesananSelesai: 3,
      },
      {
        mulai: "2032-08-11",
        akhir: "2032-08-11",
        pendapatan: 0,
        pesananSelesai: 0,
      },
      {
        mulai: "2032-08-12",
        akhir: "2032-08-12",
        pendapatan: 45000,
        pesananSelesai: 1,
      },
    ]);
    // Pesanan tanpa Harga modal tidak masuk laba (PRD §14.2).
    expect(grafik.kelompok.map((k) => k.labaKotor)).toEqual([65000, 0, 0]);
  });

  it("titik hari contoh PRD §14.5 bernilai Laba kotor Rp 65.000 dan Laba bersih Rp 49.051", async () => {
    const { varianId } = await produkUji();
    await sisipkanContohPrd(varianId, "2032-09-01");
    await tambahBiayaOperasional({
      tanggal: "2032-09-01",
      keterangan: `Iklan ${randomUUID().slice(0, 8)}`,
      nominal: 10000,
    });

    const grafik = await grafikLaporan({
      periode: "Harian",
      dari: "2032-09-01",
      sampai: "2032-09-01",
    });

    expect(grafik.kelompok).toHaveLength(1);
    expect(grafik.kelompok[0]).toMatchObject({
      labaKotor: 65000,
      labaBersih: 49051,
    });
  });

  it("pada periode Mingguan, Biaya operasional hari Selasa masuk ke minggu yang memuat Selasa itu, dan tidak dikurangkan saat saringan Produk aktif", async () => {
    const { produkId, varianId } = await produkUji();
    // Rabu 6 sampai Jumat 22 Oktober 2032: minggu 6–10, 11–17, dan 18–22 Oktober.
    await sisipkanContohPrd(varianId, "2032-10-13");
    // Selasa 12 Oktober 2032.
    await tambahBiayaOperasional({
      tanggal: "2032-10-12",
      keterangan: `Sewa server ${randomUUID().slice(0, 8)}`,
      nominal: 10000,
    });
    const saringan = {
      periode: "Mingguan" as const,
      dari: "2032-10-06",
      sampai: "2032-10-22",
    };

    const semua = await grafikLaporan(saringan);
    const perProduk = await grafikLaporan({ ...saringan, produkId });

    expect(
      semua.kelompok.map(({ mulai, akhir, labaKotor, labaBersih }) => ({
        mulai,
        akhir,
        labaKotor,
        labaBersih,
      })),
    ).toEqual([
      { mulai: "2032-10-06", akhir: "2032-10-10", labaKotor: 0, labaBersih: 0 },
      {
        mulai: "2032-10-11",
        akhir: "2032-10-17",
        labaKotor: 65000,
        labaBersih: 49051,
      },
      { mulai: "2032-10-18", akhir: "2032-10-22", labaKotor: 0, labaBersih: 0 },
    ]);
    expect(perProduk.kelompok.map((k) => k.labaBersih)).toEqual([0, 59051, 0]);
  });

  it("Biaya transaksi Top up dikurangkan pada kelompok yang memuat waktu bayar Top up tanpa menambahkan Kode unik Top up, kecuali saat saringan Metode aktif", async () => {
    const { varianId } = await produkUji();
    await sisipkanContohPrd(varianId, "2033-04-10");
    await topUpContohPrd("2033-04-11T10:00:00+07:00");
    const saringan = {
      periode: "Harian" as const,
      dari: "2033-04-10",
      sampai: "2033-04-12",
    };

    const semua = await grafikLaporan(saringan);
    const qris = await grafikLaporan({ ...saringan, metode: "QRIS" });

    // 11 April: −1.052, tanpa Kode unik Top up Rp 200 (PRD §14.6 ▶ Keputusan 2026-11-23,
    // tests/golden/laba-top-up-tanpa-kode-unik.json, "Hanya Top up tanpa Pesanan").
    expect(semua.kelompok.map((k) => k.labaBersih)).toEqual([59051, -1052, 0]);
    expect(qris.kelompok.map((k) => k.labaBersih)).toEqual([59051, 0, 0]);
  });

  it("saringan Metode Saldo dan QRIS membatasi Produk terlaris dan Pendapatan per Kategori ke Pesanan bermetode itu", async () => {
    const kategoriId = await sisipkanKategori({
      nama: `Metode grafik ${randomUUID().slice(0, 8)}`,
    });
    const viaQris = await produkUji({ nama: "Lewat QRIS", kategoriId });
    const viaSaldo = await produkUji({ nama: "Lewat saldo", kategoriId });
    // Rincian contoh PRD §5.5 dari sisipkanPesanan: Total bayar Rp 45.123, Pendapatan Rp 45.000.
    await sisipkanPesanan({
      varianId: viaQris.varianId,
      status: "Selesai",
      biayaTransaksi: 0,
      waktuBayar: new Date("2033-06-06T09:00:00+07:00"),
    });
    await pesananSaldoContohPrd(viaSaldo.varianId, "2033-06-06T10:00:00+07:00");
    const saringan = {
      periode: "Harian" as const,
      dari: "2033-06-06",
      sampai: "2033-06-06",
      kategoriId,
    };

    const saldo = await grafikLaporan({ ...saringan, metode: "Saldo" });
    const qris = await grafikLaporan({ ...saringan, metode: "QRIS" });

    expect(saldo.produkTerlaris.map((p) => [p.produkId, p.pendapatan])).toEqual(
      [[viaSaldo.produkId, 50000]],
    );
    expect(
      saldo.pendapatanPerKategori.map((k) => [k.kategoriId, k.pendapatan]),
    ).toEqual([[kategoriId, 50000]]);
    expect(qris.produkTerlaris.map((p) => [p.produkId, p.pendapatan])).toEqual([
      [viaQris.produkId, 45000],
    ]);
    expect(
      qris.pendapatanPerKategori.map((k) => [k.kategoriId, k.pendapatan]),
    ).toEqual([[kategoriId, 45000]]);
  });

  it("Laba negatif tetap negatif di kelompoknya", async () => {
    const { produkId, varianId } = await produkUji();
    // Contoh tests/golden/laba-tanpa-kode-unik.json: Harga modal Rp 60.000 di atas Harga jual Rp 50.000.
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      rincian: {
        hargaJual: 50000,
        potonganVoucher: 5000,
        kodeUnik: 100,
        totalBayar: 45100,
      },
      hargaModal: 60000,
      biayaTransaksi: 0,
      waktuBayar: new Date("2032-08-20T09:00:00+07:00"),
    });

    const grafik = await grafikLaporan({
      periode: "Bulanan",
      dari: "2032-08-20",
      sampai: "2032-08-20",
      produkId,
    });

    // −Rp 10.000 − potongan voucher Rp 5.000, tanpa Kode unik Rp 100.
    expect(grafik.kelompok[0]).toMatchObject({
      labaKotor: -10000,
      labaBersih: -15000,
    });
  });

  it("dengan 12 Produk terjual, Produk terlaris hanya memuat 10 Produk dengan urutan dan Pendapatan fixture, Pesanan dijumlahkan dari semua Varian", async () => {
    const kategoriId = await sisipkanKategori({
      nama: `Terlaris ${randomUUID().slice(0, 8)}`,
    });
    const [kasus] = goldenProdukTerlaris.kasus;
    // Fixture memuat 11 Produk. Produk ke-12 punya 1 Pesanan Selesai dengan Pendapatan di bawah semua Produk
    // ber-1 Pesanan di fixture, jadi menurut PRD §14.7 urutannya di bawah 10 besar dan hasilnya tetap fixture.
    const pesananSelesai = [
      ...kasus.input.pesananSelesai,
      {
        produk: "Produk kedua belas",
        varian: "1 Bulan",
        totalBayar: 10000,
        hargaJual: 10000,
        potonganVoucher: 0,
        kodeUnik: 0,
      },
    ];
    // Satu Produk per nama, dengan Varian-nya masing-masing.
    const varianPerProduk = new Map<string, Set<string>>();
    for (const p of pesananSelesai) {
      varianPerProduk.set(
        p.produk,
        (varianPerProduk.get(p.produk) ?? new Set()).add(p.varian),
      );
    }
    expect(varianPerProduk.size).toBe(12);
    const idVarian = new Map<string, string>();
    for (const [nama, semuaVarian] of varianPerProduk) {
      const produkId = await sisipkanProduk({
        nama,
        kategoriId,
        varian: [...semuaVarian].map((v) => ({ nama: v, hargaJual: 50000 })),
      });
      for (const v of await db
        .select({ id: varian.id, nama: varian.nama })
        .from(varian)
        .where(eq(varian.produkId, produkId))) {
        idVarian.set(`${nama}|${v.nama}`, v.id);
      }
    }
    for (const [i, p] of pesananSelesai.entries()) {
      await sisipkanPesanan({
        varianId: idVarian.get(`${p.produk}|${p.varian}`)!,
        status: "Selesai",
        rincian: {
          hargaJual: p.hargaJual,
          potonganVoucher: p.potonganVoucher,
          kodeUnik: p.kodeUnik,
          totalBayar: p.totalBayar,
        },
        biayaTransaksi: 0,
        waktuBayar: new Date(
          `2032-11-10T08:${String(i).padStart(2, "0")}:00+07:00`,
        ),
      });
    }
    // Bukan Pesanan Selesai, dan Pesanan Selesai di luar rentang: tidak dihitung.
    await sisipkanPesanan({
      varianId: idVarian.get("WeTV VIP|1 Bulan")!,
      status: "Bermasalah",
      waktuBayar: new Date("2032-11-10T12:00:00+07:00"),
    });
    await sisipkanPesanan({
      varianId: idVarian.get("WeTV VIP|1 Bulan")!,
      status: "Selesai",
      biayaTransaksi: 0,
      waktuBayar: new Date("2032-11-11T00:00:00+07:00"),
    });

    const grafik = await grafikLaporan({
      periode: "Harian",
      dari: "2032-11-10",
      sampai: "2032-11-10",
      kategoriId,
    });

    expect(
      grafik.produkTerlaris.map(
        ({ namaProduk, pesananSelesai, pendapatan }) => ({
          produk: namaProduk,
          pesananSelesai,
          pendapatan,
        }),
      ),
    ).toEqual(kasus.output.terlaris);
  });

  it("jumlah Pendapatan per Kategori sama dengan Pendapatan rincian angka, Kategori tanpa Pesanan Selesai dalam rentang tidak tampil, dan saringan Kategori atau Produk ikut berlaku", async () => {
    const besar = await produkUji({ nama: "Kategori besar" });
    const besarLain = await produkUji({ nama: "Kategori besar lain" });
    const kecil = await produkUji({ nama: "Kategori kecil" });
    const kosong = await produkUji({ nama: "Kategori kosong" });
    // Kategori besar: contoh PRD §14.5 (Pendapatan Rp 230.000) dan satu Pesanan tanpa Harga modal (Rp 45.000) di dua
    // Produk.
    await sisipkanContohPrd(besar.varianId, "2032-12-01");
    await sisipkanPesanan({
      varianId: besarLain.varianId,
      status: "Selesai",
      biayaTransaksi: 0,
      waktuBayar: new Date("2032-12-01T22:00:00+07:00"),
    });
    // Kategori kecil: satu Pesanan Selesai dengan Total bayar Rp 45.123, Pendapatan Rp 45.000.
    await sisipkanPesanan({
      varianId: kecil.varianId,
      status: "Selesai",
      hargaModal: 35000,
      biayaTransaksi: 0,
      waktuBayar: new Date("2032-12-01T10:00:00+07:00"),
    });
    // Kategori kosong: hanya Pesanan Bermasalah dalam rentang, dan Pesanan Selesai sehari sesudahnya.
    await sisipkanPesanan({
      varianId: kosong.varianId,
      status: "Bermasalah",
      waktuBayar: new Date("2032-12-01T11:00:00+07:00"),
    });
    await sisipkanPesanan({
      varianId: kosong.varianId,
      status: "Selesai",
      biayaTransaksi: 0,
      waktuBayar: new Date("2032-12-02T00:00:00+07:00"),
    });
    // Produk kedua dipindah ke Kategori Produk pertama: Pesanan-nya ikut Kategori itu.
    const [{ kategoriId: kategoriBesar }] = await db
      .select({ kategoriId: produk.kategoriId })
      .from(produk)
      .where(eq(produk.id, besar.produkId));
    await db
      .update(produk)
      .set({ kategoriId: kategoriBesar })
      .where(eq(produk.id, besarLain.produkId));
    const [{ nama: namaKategoriBesar }] = await db
      .select({ nama: kategori.nama })
      .from(kategori)
      .where(eq(kategori.id, kategoriBesar));

    const saringan = {
      periode: "Harian" as const,
      dari: "2032-12-01",
      sampai: "2032-12-01",
    };
    const grafik = await grafikLaporan(saringan);
    const rincian = await rincianLaporan(saringan);

    expect(
      grafik.pendapatanPerKategori.map(
        ({ namaKategori, pendapatan, pesananSelesai }) => ({
          namaKategori,
          pendapatan,
          pesananSelesai,
        }),
      ),
    ).toEqual([
      {
        namaKategori: namaKategoriBesar,
        pendapatan: 275000,
        pesananSelesai: 4,
      },
      {
        namaKategori: expect.stringMatching(/^Streaming /),
        pendapatan: 45000,
        pesananSelesai: 1,
      },
    ]);
    expect(rincian.pendapatan).toBe(320000);
    expect(
      grafik.pendapatanPerKategori.reduce((n, k) => n + k.pendapatan, 0),
    ).toBe(rincian.pendapatan);

    const perProduk = await grafikLaporan({
      ...saringan,
      produkId: besarLain.produkId,
    });
    expect(
      perProduk.pendapatanPerKategori.map((k) => [k.kategoriId, k.pendapatan]),
    ).toEqual([[kategoriBesar, 45000]]);
    expect(
      perProduk.produkTerlaris.map((p) => [p.produkId, p.pesananSelesai]),
    ).toEqual([[besarLain.produkId, 1]]);
  });
});
