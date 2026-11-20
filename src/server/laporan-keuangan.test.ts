import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { tambahBiayaOperasional } from "./biaya-operasional";
import { db, koneksi } from "./db";
import { produk, varian } from "./db/schema";
import {
  pilihanSaringanLaporan,
  rincianLaporan,
  tabelPesananLaporan,
} from "./laporan-keuangan";
import { sisipkanKategori, sisipkanProduk } from "./uji-katalog";
import { sisipkanPesanan } from "./uji-pesanan";

// Test integrasi dengan database app_test (.env.ci), yang dipakai bersama test lain. Test lain membuat Pesanan
// yang dibayar dan Biaya operasional bertanggal sekitar waktu nyata, November 2026, atau tahun 2031, jadi setiap
// test di sini memakai rentang pada tanggal tersendiri di tahun 2032, atau menyaring ke Produk dan Kategori-nya
// sendiri.

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

describe("rincianLaporan (PRD §14.5, §14.6)", () => {
  it("rentang satu hari yang berisi contoh PRD §14.5 menghasilkan angka contoh itu sampai Laba bersih Rp 49.683", async () => {
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
      kodeUnik: rincian.kodeUnik,
      biayaTransaksi: rincian.biayaTransaksi,
      biayaOperasional: rincian.biayaOperasional,
      labaBersih: rincian.labaBersih,
      pesananTanpaHargaModal: rincian.pesananTanpaHargaModal,
    }).toEqual({
      pendapatan: 230632,
      pesananSelesai: 3,
      totalHargaModal: 170000,
      labaKotor: 65000,
      potonganVoucher: 5000,
      kodeUnik: 632,
      biayaTransaksi: 949,
      biayaOperasional: 10000,
      labaBersih: 49683,
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

    expect(perProduk.pendapatan).toBe(230632);
    expect(perProduk.biayaOperasional).toBeNull();
    expect(perProduk.labaBersih).toBe(59683);
    expect(perKategori.pendapatan).toBe(461264);
    expect(perKategori.biayaOperasional).toBeNull();
    expect(perKategori.labaBersih).toBe(119366);
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
    ).toBe(230632);
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
    // Kolom PRD §14.8, dengan rincian contoh PRD §5.5 dari sisipkanPesanan.
    expect(Object.keys(kedua.pesanan[0]).sort()).toEqual(
      [
        "nomorPesanan",
        "waktuBayar",
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
