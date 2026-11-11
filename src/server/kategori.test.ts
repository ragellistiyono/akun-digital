import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { koneksi } from "./db";
import { buatKategori, daftarKategori, ubahKategori } from "./kategori";
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
