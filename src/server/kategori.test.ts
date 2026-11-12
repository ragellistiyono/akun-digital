import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { koneksi } from "./db";
import {
  buatKategori,
  daftarKategori,
  hapusKategori,
  ubahKategori,
} from "./kategori";
import { sisipkanProduk } from "./uji-katalog";
import { adaBerkasBerisi, pngUnik } from "./uji-unggahan";

// Test integrasi dengan database app_test dan folder unggahan dari .env.ci. PostgreSQL menolak teks
// yang memuat karakter NUL, jadi nama seperti itu dipakai untuk membuat penulisan database gagal.
const NAMA_DITOLAK_DATABASE = "Streaming\u0000";

const namaUnik = (nama: string) => `${nama} ${randomUUID().slice(0, 8)}`;
const gambar = (isi: Buffer<ArrayBuffer>) =>
  new File([isi], "ikon.png", { type: "image/png" });

async function kategoriBernama(nama: string) {
  return (await daftarKategori()).filter((k) => k.nama === nama);
}

afterAll(async () => {
  await koneksi.end();
});

describe("nama Kategori unik saat dua penyimpanan terjadi bersamaan (PRD §3.1)", () => {
  // Kategori yang kalah tidak meninggalkan berkas ikon, jadi tepat satu dari kedua isi ikon tersimpan.
  async function jumlahIkonTersimpan(isi: Buffer[]) {
    const ada = await Promise.all(isi.map(adaBerkasBerisi));
    return ada.filter(Boolean).length;
  }

  const namaSama = (nama: string) => async () =>
    (await daftarKategori()).filter(
      (k) => k.nama.trim().toLowerCase() === nama.toLowerCase(),
    );

  it("dua Kategori baru dengan nama yang sama: hanya satu yang dibuat", async () => {
    const nama = namaUnik("Streaming");
    const isi = [pngUnik(), pngUnik()];

    const hasil = await Promise.all([
      buatKategori({ nama, ikon: gambar(isi[0]) }),
      buatKategori({ nama: nama.toLowerCase(), ikon: gambar(isi[1]) }),
    ]);

    expect(hasil.map((h) => h.hasil).sort()).toEqual([
      "dibuat",
      "nama-dipakai",
    ]);
    expect(await namaSama(nama)()).toHaveLength(1);
    expect(await jumlahIkonTersimpan(isi)).toBe(1);
  });

  it("dua Kategori yang diganti namanya menjadi nama yang sama: hanya satu yang berganti", async () => {
    const isiLama = [pngUnik(), pngUnik()];
    const asal = [namaUnik("Musik"), namaUnik("Game")];
    await buatKategori({ nama: asal[0], ikon: gambar(isiLama[0]) });
    await buatKategori({ nama: asal[1], ikon: gambar(isiLama[1]) });
    const [musik] = await kategoriBernama(asal[0]);
    const [game] = await kategoriBernama(asal[1]);
    const nama = namaUnik("Streaming");
    const isiPengganti = [pngUnik(), pngUnik()];

    const hasil = await Promise.all([
      ubahKategori({ id: musik.id, nama, ikon: gambar(isiPengganti[0]) }),
      ubahKategori({
        id: game.id,
        nama: nama.toUpperCase(),
        ikon: gambar(isiPengganti[1]),
      }),
    ]);

    expect(hasil.map((h) => h.hasil).sort()).toEqual([
      "diubah",
      "nama-dipakai",
    ]);
    expect(await namaSama(nama)()).toHaveLength(1);
    // Kategori yang kalah tetap memakai nama dan ikon lamanya.
    const tetap = (await daftarKategori()).filter(
      (k) => k.id === musik.id || k.id === game.id,
    );
    expect(tetap).toContainEqual(hasil[0].hasil === "diubah" ? game : musik);
    expect(await jumlahIkonTersimpan(isiPengganti)).toBe(1);
    expect(await jumlahIkonTersimpan(isiLama)).toBe(1);
  });
});

describe("berkas ikon saat Kategori tidak bisa ditulis", () => {
  it("membuat Kategori: gambar ikon yang baru disimpan dihapus lagi", async () => {
    const isi = pngUnik();

    await expect(
      buatKategori({ nama: NAMA_DITOLAK_DATABASE, ikon: gambar(isi) }),
    ).rejects.toThrow();

    expect(await adaBerkasBerisi(isi)).toBe(false);
  });

  it("mengubah Kategori: gambar ikon pengganti dihapus lagi, dan ikon lama tetap ada", async () => {
    const isiLama = pngUnik();
    const nama = namaUnik("Streaming");
    await buatKategori({ nama, ikon: gambar(isiLama) });
    const [lama] = await kategoriBernama(nama);
    const isiPengganti = pngUnik();

    await expect(
      ubahKategori({
        id: lama.id,
        nama: NAMA_DITOLAK_DATABASE,
        ikon: gambar(isiPengganti),
      }),
    ).rejects.toThrow();

    expect(await adaBerkasBerisi(isiPengganti)).toBe(false);
    expect(await adaBerkasBerisi(isiLama)).toBe(true);
    expect(await kategoriBernama(nama)).toEqual([lama]);
  });

  it("Kategori yang tidak ada: gambar ikon pengganti tidak tertinggal", async () => {
    const isi = pngUnik();

    expect(
      await ubahKategori({
        id: randomUUID(),
        nama: namaUnik("Film"),
        ikon: gambar(isi),
      }),
    ).toEqual({ hasil: "tidak-ada" });

    expect(await adaBerkasBerisi(isi)).toBe(false);
  });
});

// Issue T29 (PRD §3.1): Kategori yang masih berisi Produk, termasuk Produk nonaktif, tidak bisa dihapus.
describe("hapusKategori", () => {
  it("Kategori Game yang berisi Produk nonaktif ditolak, dan Kategori beserta ikonnya tetap ada (UAT-C6 langkah 1)", async () => {
    const isi = pngUnik();
    const nama = namaUnik("Game");
    await buatKategori({ nama, ikon: gambar(isi) });
    const [game] = await kategoriBernama(nama);
    await sisipkanProduk({
      nama: namaUnik("Game Lama"),
      kategoriId: game.id,
      aktif: false,
      varian: [{ nama: "1 Bulan", hargaJual: 15000, Tersedia: 2 }],
    });

    expect(await hapusKategori(game.id)).toEqual({
      hasil: "berisi-produk",
      jumlahProduk: 1,
    });

    expect(await kategoriBernama(nama)).toEqual([game]);
    expect(await adaBerkasBerisi(isi)).toBe(true);
  });

  it("Kategori Streaming yang berisi Produk aktif ditolak dengan jumlah semua Produknya, termasuk yang nonaktif", async () => {
    const nama = namaUnik("Streaming");
    await buatKategori({ nama, ikon: gambar(pngUnik()) });
    const [streaming] = await kategoriBernama(nama);
    for (const aktif of [true, true, false]) {
      await sisipkanProduk({
        nama: namaUnik("Netflix Premium"),
        kategoriId: streaming.id,
        aktif,
        varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
      });
    }

    expect(await hapusKategori(streaming.id)).toEqual({
      hasil: "berisi-produk",
      jumlahProduk: 3,
    });
    expect(await kategoriBernama(nama)).toEqual([streaming]);
  });

  it("Kategori yang kosong dihapus beserta berkas gambar ikonnya", async () => {
    const isi = pngUnik();
    const nama = namaUnik("Film");
    await buatKategori({ nama, ikon: gambar(isi) });
    const [film] = await kategoriBernama(nama);

    expect(await hapusKategori(film.id)).toEqual({ hasil: "dihapus" });

    expect(await kategoriBernama(nama)).toEqual([]);
    expect(await adaBerkasBerisi(isi)).toBe(false);
  });

  it("Kategori yang tidak ada tidak menghapus apa pun", async () => {
    expect(await hapusKategori(randomUUID())).toEqual({ hasil: "tidak-ada" });
  });
});
