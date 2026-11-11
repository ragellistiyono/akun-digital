import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { koneksi } from "./db";
import {
  bacaHalamanProduk,
  daftarKategoriToko,
  daftarProdukBeranda,
} from "./katalog";
import { sisipkanKategori, sisipkanProduk } from "./uji-katalog";

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
            persenHemat: 33,
          },
          {
            id: expect.any(String),
            nama: "3 Bulan",
            hargaJual: 135000,
            hargaNormal: null,
            habis: false,
            persenHemat: null,
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

  // Issue T11-b, docs/DESIGN.md ▶ Keputusan 2026-11-11 (#53). Harga dari tests/golden/persen-hemat.json:
  // 30.000 → 20.000 dan 150.000 → 135.000 (Hemat 10%).
  it("daftar Varian kartu Produk Unggulan membawa Persen hemat per Varian, dan Varian habis tanpa Hemat", async () => {
    const nama = namaUnik("YouTube Premium");
    await sisipkanProduk({
      nama,
      unggulan: true,
      varian: [
        { nama: "1 Bulan", hargaJual: 20000, hargaNormal: 30000 },
        {
          nama: "3 Bulan",
          hargaJual: 135000,
          hargaNormal: 150000,
          Tersedia: 4,
        },
      ],
    });

    const [kartu] = (await kartuBernama(nama)).unggulan;

    expect(kartu.varian).toMatchObject([
      { nama: "1 Bulan", hargaNormal: 30000, habis: true, persenHemat: null },
      { nama: "3 Bulan", hargaNormal: 150000, habis: false, persenHemat: 10 },
    ]);
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

/**
 * Kategori persiapan bersama docs/UAT.md [CONTOH] dengan nama unik: Streaming berisi Netflix Premium,
 * Musik berisi Spotify Premium, Game hanya berisi Produk nonaktif, dan satu Kategori tanpa Produk.
 */
async function sisipkanKatalogUat() {
  const akhiran = randomUUID().slice(0, 8);
  const nama = {
    streaming: `Streaming ${akhiran}`,
    musik: `Musik ${akhiran}`,
    game: `Game ${akhiran}`,
    kosong: `Desain ${akhiran}`,
    netflix: `Netflix Premium ${akhiran}`,
    spotify: `Spotify Premium ${akhiran}`,
    gameLama: `Game Lama ${akhiran}`,
  };
  const id = {
    streaming: await sisipkanKategori({ nama: nama.streaming }),
    musik: await sisipkanKategori({ nama: nama.musik }),
    game: await sisipkanKategori({ nama: nama.game }),
    kosong: await sisipkanKategori({ nama: nama.kosong }),
  };
  await sisipkanProduk({
    nama: nama.netflix,
    kategoriId: id.streaming,
    unggulan: true,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 10 }],
  });
  await sisipkanProduk({
    nama: nama.spotify,
    kategoriId: id.musik,
    varian: [{ nama: "1 Bulan", hargaJual: 25000 }],
  });
  await sisipkanProduk({
    nama: nama.gameLama,
    kategoriId: id.game,
    aktif: false,
    varian: [{ nama: "1 Bulan", hargaJual: 15000, Tersedia: 2 }],
  });
  return { akhiran, nama, id };
}

const namaBerakhiran = (daftar: { nama: string }[], akhiran: string) =>
  daftar.map((d) => d.nama).filter((n) => n.endsWith(akhiran));

describe("daftarKategoriToko", () => {
  it("hanya Kategori yang berisi Produk di katalog yang tampil, urut menurut nama (PRD §3.1)", async () => {
    const { akhiran, nama, id } = await sisipkanKatalogUat();

    const kategori = await daftarKategoriToko();

    // Game hanya berisi Produk nonaktif, dan Desain tidak berisi Produk.
    expect(namaBerakhiran(kategori, akhiran)).toEqual([
      nama.musik,
      nama.streaming,
    ]);
    expect(kategori.find((k) => k.id === id.musik)).toEqual({
      id: id.musik,
      nama: nama.musik,
      alamatIkon: "/unggahan/ikon-uji.png",
    });
  });

  it("Kategori yang Produk aktifnya tidak punya Varian aktif tidak tampil, karena Produk itu tidak ada di katalog", async () => {
    const namaKategori = namaUnik("Vidio");
    const kategoriId = await sisipkanKategori({ nama: namaKategori });
    await sisipkanProduk({
      nama: namaUnik("Vidio Platinum"),
      kategoriId,
      varian: [{ nama: "1 Bulan", hargaJual: 15000, aktif: false }],
    });

    expect((await daftarKategoriToko()).map((k) => k.id)).not.toContain(
      kategoriId,
    );
  });
});

describe("daftarProdukBeranda dengan pencarian dan saringan", () => {
  it("deret Kategori Beranda sama dengan Kategori di tab Kategori", async () => {
    const { akhiran } = await sisipkanKatalogUat();

    const { kategori } = await daftarProdukBeranda();

    expect(namaBerakhiran(kategori, akhiran)).toEqual(
      namaBerakhiran(await daftarKategoriToko(), akhiran),
    );
  });

  // Issue T12: mencari "NETFLIX" memberi hasil yang sama dengan "netflix".
  it.each(["netflix", "NETFLIX"])(
    'mencari "%s" menampilkan Netflix Premium tanpa Spotify Premium',
    async (kataCari) => {
      const { akhiran, nama } = await sisipkanKatalogUat();

      const { semua, kategoriTerpilih } = await daftarProdukBeranda({
        kataCari,
        kategoriId: null,
      });

      expect(namaBerakhiran(semua, akhiran)).toEqual([nama.netflix]);
      expect(semua.every((k) => /netflix/i.test(k.nama))).toBe(true);
      expect(kategoriTerpilih).toBeNull();
    },
  );

  // UAT-C1: saringan Musik hanya menampilkan Spotify Premium.
  it("saringan Kategori Musik hanya menampilkan Spotify Premium", async () => {
    const { nama, id } = await sisipkanKatalogUat();

    const { semua, kategoriTerpilih } = await daftarProdukBeranda({
      kataCari: "",
      kategoriId: id.musik,
    });

    expect(semua.map((k) => k.nama)).toEqual([nama.spotify]);
    expect(kategoriTerpilih).toMatchObject({ id: id.musik, nama: nama.musik });
  });

  it("Kategori yang tidak tampil di toko tidak menyaring, jadi semua Produk tampil", async () => {
    const { akhiran, nama, id } = await sisipkanKatalogUat();

    const { semua, kategoriTerpilih } = await daftarProdukBeranda({
      kataCari: "",
      kategoriId: id.game,
    });

    expect(kategoriTerpilih).toBeNull();
    expect(namaBerakhiran(semua, akhiran)).toEqual([
      nama.netflix,
      nama.spotify,
    ]);
  });

  it("Produk Unggulan tidak ikut disaring", async () => {
    const { akhiran, nama, id } = await sisipkanKatalogUat();

    const { unggulan } = await daftarProdukBeranda({
      kataCari: "spotify",
      kategoriId: id.musik,
    });

    expect(namaBerakhiran(unggulan, akhiran)).toEqual([nama.netflix]);
  });
});

describe("bacaHalamanProduk", () => {
  // UAT persiapan bersama [CONTOH] dan UAT-C2–C4: Netflix Premium.
  it("Netflix Premium: nama, Kategori, foto, deskripsi, ketentuan garansi, dan kedua Varian beserta Stok Varian dan Persen hemat", async () => {
    const nama = namaUnik("Netflix Premium");
    const namaKategori = namaUnik("Streaming");
    const kategoriId = await sisipkanKategori({ nama: namaKategori });
    const id = await sisipkanProduk({
      nama,
      kategoriId,
      foto: ["sampul-uji.png", "kedua-uji.png"],
      deskripsi: "Akun Netflix Premium satu profil.",
      ketentuanGaransi: "Garansi 30 hari.",
      varian: [
        { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
        { nama: "1 Bulan", hargaJual: 50000, hargaNormal: 75000, Tersedia: 10 },
      ],
    });

    expect(await bacaHalamanProduk(id)).toEqual({
      id,
      nama,
      kategori: { id: kategoriId, nama: namaKategori },
      foto: ["/unggahan/sampul-uji.png", "/unggahan/kedua-uji.png"],
      deskripsi: "Akun Netflix Premium satu profil.",
      ketentuanGaransi: "Garansi 30 hari.",
      pilihanVarian: true,
      varian: [
        {
          id: expect.any(String),
          nama: "1 Bulan",
          hargaJual: 50000,
          hargaNormal: 75000,
          stokVarian: 10,
          habis: false,
          persenHemat: 33,
        },
        {
          id: expect.any(String),
          nama: "3 Bulan",
          hargaJual: 135000,
          hargaNormal: null,
          stokVarian: 4,
          habis: false,
          persenHemat: null,
        },
      ],
    });
  });

  it("Uji Bayar dengan satu Varian aktif tidak menampilkan pilihan Varian", async () => {
    const id = await sisipkanProduk({
      nama: namaUnik("Uji Bayar"),
      varian: [{ nama: "Uji", hargaJual: 1000, Tersedia: 10 }],
    });

    expect(await bacaHalamanProduk(id)).toMatchObject({
      pilihanVarian: false,
      varian: [{ nama: "Uji", hargaJual: 1000, stokVarian: 10, habis: false }],
    });
  });

  // tests/golden/stok-varian.json, kasus "Contoh PRD" dan "Semua ditahan".
  it("Stok Varian hanya menghitung Item stok Tersedia", async () => {
    const id = await sisipkanProduk({
      nama: namaUnik("Canva Pro"),
      varian: [
        {
          nama: "1 Bulan",
          hargaJual: 15000,
          Tersedia: 8,
          Ditahan: 2,
          Terkirim: 5,
        },
        { nama: "3 Bulan", hargaJual: 40000, Ditahan: 3 },
      ],
    });

    expect((await bacaHalamanProduk(id))?.varian).toMatchObject([
      { nama: "1 Bulan", stokVarian: 8, habis: false },
      { nama: "3 Bulan", stokVarian: 0, habis: true },
    ]);
  });

  it("Varian nonaktif tidak tampil", async () => {
    const id = await sisipkanProduk({
      nama: namaUnik("Disney Plus"),
      varian: [
        { nama: "Promo", hargaJual: 10000, aktif: false, Tersedia: 9 },
        { nama: "1 Bulan", hargaJual: 50000, Tersedia: 2 },
        { nama: "3 Bulan", hargaJual: 135000, Tersedia: 1 },
      ],
    });

    const halaman = await bacaHalamanProduk(id);

    expect(halaman?.varian.map((v) => v.nama)).toEqual(["1 Bulan", "3 Bulan"]);
  });

  it("Produk nonaktif, Produk tanpa Varian aktif, dan Produk yang tidak ada tidak punya Halaman Produk", async () => {
    const nonaktif = await sisipkanProduk({
      nama: namaUnik("Game Lama"),
      aktif: false,
      varian: [{ nama: "1 Bulan", hargaJual: 15000, Tersedia: 2 }],
    });
    const tanpaVarianAktif = await sisipkanProduk({
      nama: namaUnik("Vidio Platinum"),
      varian: [
        { nama: "1 Bulan", hargaJual: 15000, aktif: false, Tersedia: 2 },
      ],
    });

    expect(await bacaHalamanProduk(nonaktif)).toBeNull();
    expect(await bacaHalamanProduk(tanpaVarianAktif)).toBeNull();
    expect(await bacaHalamanProduk(randomUUID())).toBeNull();
  });
});
