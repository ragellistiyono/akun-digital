import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { koneksi } from "./db";
import { daftarProdukBeranda } from "./katalog";
import { sisipkanProduk } from "./uji-katalog";

// Test integrasi dengan database app_test dari .env.ci. Database ini dipakai bersama test lain, jadi
// setiap Produk diberi nama unik dan hasilnya disaring menurut nama itu. Data Produknya mengikuti
// persiapan bersama di docs/UAT.md, yang bertanda [CONTOH].
afterAll(async () => {
  await koneksi.end();
});

const namaUnik = (nama: string) => `${nama} ${randomUUID().slice(0, 8)}`;

async function kartuBernama(nama: string) {
  const { semua, unggulan } = await daftarProdukBeranda();
  return {
    semua: semua.filter((k) => k.nama === nama),
    unggulan: unggulan.filter((k) => k.nama === nama),
  };
}

describe("daftarProdukBeranda", () => {
  // UAT persiapan bersama [CONTOH]: Netflix Premium.
  it("kartu Netflix Premium: Mulai Rp 50.000 dengan Harga normal Rp 75.000 dan Hemat 33% dari Varian 1 Bulan", async () => {
    const nama = namaUnik("Netflix Premium");
    const id = await sisipkanProduk({
      nama,
      unggulan: true,
      varian: [
        {
          nama: "3 Bulan",
          hargaJual: 135000,
          Tersedia: 4,
        },
        {
          nama: "1 Bulan",
          hargaJual: 50000,
          hargaNormal: 75000,
          Tersedia: 10,
        },
      ],
    });

    const { semua } = await kartuBernama(nama);

    expect(semua).toEqual([
      {
        id,
        nama,
        fotoSampul: null,
        mulai: true,
        harga: 50000,
        habis: false,
        hargaNormal: 75000,
        persenHemat: 33,
        varian: [
          {
            id: expect.any(String),
            nama: "1 Bulan",
            hargaJual: 50000,
            hargaNormal: 75000,
            habis: false,
          },
          {
            id: expect.any(String),
            nama: "3 Bulan",
            hargaJual: 135000,
            hargaNormal: null,
            habis: false,
          },
        ],
      },
    ]);
  });

  // UAT persiapan bersama [CONTOH] dan UAT-C5.
  it("kartu YouTube Premium: Mulai Rp 55.000 karena Varian Rp 20.000 habis", async () => {
    const nama = namaUnik("YouTube Premium");
    await sisipkanProduk({
      nama,
      varian: [
        { nama: "1 Bulan", hargaJual: 20000 },
        { nama: "3 Bulan", hargaJual: 55000, Tersedia: 3 },
      ],
    });

    const [kartu] = (await kartuBernama(nama)).semua;

    expect(kartu).toMatchObject({
      mulai: true,
      harga: 55000,
      habis: false,
      hargaNormal: null,
      persenHemat: null,
      varian: [
        { nama: "1 Bulan", habis: true },
        { nama: "3 Bulan", habis: false },
      ],
    });
  });

  it("kartu Uji Bayar: Rp 1.000 tanpa kata Mulai", async () => {
    const nama = namaUnik("Uji Bayar");
    await sisipkanProduk({
      nama,
      varian: [{ nama: "Uji", hargaJual: 1000, Tersedia: 10 }],
    });

    expect((await kartuBernama(nama)).semua).toMatchObject([
      { mulai: false, harga: 1000, habis: false },
    ]);
  });

  it("kartu Spotify Premium: Habis dengan harga Rp 25.000", async () => {
    const nama = namaUnik("Spotify Premium");
    await sisipkanProduk({
      nama,
      varian: [{ nama: "1 Bulan", hargaJual: 25000 }],
    });

    expect((await kartuBernama(nama)).semua).toMatchObject([
      { mulai: false, harga: 25000, habis: true },
    ]);
  });

  it("Stok Varian hanya menghitung Item stok Tersedia, jadi Item stok Ditahan dan Terkirim membuat Produk habis", async () => {
    const nama = namaUnik("Canva Pro");
    await sisipkanProduk({
      nama,
      varian: [
        {
          nama: "1 Bulan",
          hargaJual: 30000,
          hargaNormal: 40000,
          Ditahan: 2,
          Terkirim: 5,
        },
      ],
    });

    expect((await kartuBernama(nama)).semua).toMatchObject([
      { harga: 30000, habis: true, hargaNormal: 40000, persenHemat: 25 },
    ]);
  });

  it("Produk nonaktif tidak tampil", async () => {
    const nama = namaUnik("Game Lama");
    await sisipkanProduk({
      nama,
      aktif: false,
      varian: [{ nama: "1 Bulan", hargaJual: 15000, Tersedia: 2 }],
    });

    expect(await kartuBernama(nama)).toEqual({ semua: [], unggulan: [] });
  });

  it("Produk tanpa Varian aktif tidak tampil", async () => {
    const tanpaVarian = namaUnik("Disney Plus");
    const varianNonaktif = namaUnik("Vidio Platinum");
    await sisipkanProduk({ nama: tanpaVarian, varian: [] });
    await sisipkanProduk({
      nama: varianNonaktif,
      varian: [
        { nama: "1 Bulan", hargaJual: 15000, aktif: false, Tersedia: 2 },
      ],
    });

    expect((await kartuBernama(tanpaVarian)).semua).toEqual([]);
    expect((await kartuBernama(varianNonaktif)).semua).toEqual([]);
  });

  // tests/golden/harga-kartu-produk.json, kasus "Varian nonaktif lebih murah diabaikan".
  it("Varian nonaktif tidak ikut menentukan harga dan tidak tampil di daftar Varian", async () => {
    const nama = namaUnik("Netflix Premium");
    await sisipkanProduk({
      nama,
      varian: [
        { nama: "Promo", hargaJual: 10000, aktif: false, Tersedia: 9 },
        { nama: "1 Bulan", hargaJual: 50000, Tersedia: 2 },
        { nama: "3 Bulan", hargaJual: 135000, Tersedia: 1 },
      ],
    });

    const [kartu] = (await kartuBernama(nama)).semua;

    expect(kartu).toMatchObject({ mulai: true, harga: 50000, habis: false });
    expect(kartu.varian.map((v) => v.nama)).toEqual(["1 Bulan", "3 Bulan"]);
  });

  it("Produk Unggulan tampil di bagian Produk Unggulan dan juga di semua Produk", async () => {
    const unggulan = namaUnik("Netflix Premium");
    const biasa = namaUnik("Spotify Premium");
    await sisipkanProduk({
      nama: unggulan,
      unggulan: true,
      varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 1 }],
    });
    await sisipkanProduk({
      nama: biasa,
      varian: [{ nama: "1 Bulan", hargaJual: 25000, Tersedia: 1 }],
    });

    const hasilUnggulan = await kartuBernama(unggulan);
    const hasilBiasa = await kartuBernama(biasa);

    expect(hasilUnggulan.unggulan).toHaveLength(1);
    expect(hasilUnggulan.semua).toEqual(hasilUnggulan.unggulan);
    expect(hasilBiasa.unggulan).toEqual([]);
    expect(hasilBiasa.semua).toHaveLength(1);
  });

  it("foto sampul adalah alamat foto pertama Produk", async () => {
    const nama = namaUnik("Netflix Premium");
    await sisipkanProduk({
      nama,
      foto: ["sampul-uji.png", "kedua-uji.png"],
      varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 1 }],
    });

    expect((await kartuBernama(nama)).semua).toMatchObject([
      { fotoSampul: "/unggahan/sampul-uji.png" },
    ]);
  });

  it("kedua bagian urut menurut nama Produk", async () => {
    const akhiran = randomUUID().slice(0, 8);
    const nama = ["Zee Premium", "Apple Music", "Max"].map(
      (n) => `${n} ${akhiran}`,
    );
    for (const n of nama) {
      await sisipkanProduk({
        nama: n,
        unggulan: true,
        varian: [{ nama: "1 Bulan", hargaJual: 10000, Tersedia: 1 }],
      });
    }

    const { semua, unggulan } = await daftarProdukBeranda();
    const urutan = (kartu: { nama: string }[]) =>
      kartu.map((k) => k.nama).filter((n) => n.endsWith(akhiran));

    const harapan = [
      `Apple Music ${akhiran}`,
      `Max ${akhiran}`,
      `Zee Premium ${akhiran}`,
    ];
    expect(urutan(semua)).toEqual(harapan);
    expect(urutan(unggulan)).toEqual(harapan);
  });
});
