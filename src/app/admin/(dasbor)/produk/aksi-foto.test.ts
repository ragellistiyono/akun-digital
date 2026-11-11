import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { afterAll, describe, expect, it, vi } from "vitest";

import { koneksi } from "@/server/db";
import { buatKategori, daftarKategori } from "@/server/kategori";
import { bacaProduk, buatProduk, daftarProduk } from "@/server/produk";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import {
  adaBerkasBerisi,
  FOLDER_UNGGAHAN_TEST,
  PNG,
  pngUnik,
} from "@/server/uji-unggahan";

import {
  aksiHapusFotoProduk,
  aksiPindahkanFotoProduk,
  aksiUnggahFotoProduk,
} from "./aksi-foto";

// Test integrasi Server Action dengan database app_test dan folder unggahan dari .env.ci. Header
// permintaan yang dibaca aksi lewat next/headers diganti dengan cookie milik pengunjung di setiap test.
// refresh() dari next/cache hanya bisa berjalan di dalam Server Action yang dijalankan Next.js, jadi
// diganti tiruan yang mencatat pemanggilannya.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

function sebagaiPengunjung(kepala: Headers) {
  vi.mocked(headers).mockResolvedValue(kepala);
}

function formulir(isian: Record<string, string | File>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) data.set(nama, nilai);
  return data;
}

/** Nama unik per test, karena database test dipakai bersama oleh semua test. */
const namaUnik = (nama: string) => `${nama} ${randomUUID().slice(0, 8)}`;

/** Produk baru tanpa foto, dibuat langsung lewat modul server. */
async function produkBaru() {
  const namaKategori = namaUnik("Streaming");
  await buatKategori({
    nama: namaKategori,
    ikon: new File([PNG], "ikon.png", { type: "image/png" }),
  });
  const [kategori] = (await daftarKategori()).filter(
    (k) => k.nama === namaKategori,
  );
  const nama = namaUnik("Netflix Premium");
  await buatProduk({
    nama,
    kategoriId: kategori.id,
    deskripsi: "Akun Netflix Premium untuk satu profil.",
    ketentuanGaransi: "Garansi 30 hari sejak Item stok diterima.",
    unggulan: false,
    aktif: true,
    formatItemStok: ["Email", "Password", "Profil"],
  });
  const [produk] = (await daftarProduk()).filter((p) => p.nama === nama);
  return produk.id;
}

/** Nama berkas foto Produk menurut urutannya. */
async function fotoProduk(id: string) {
  return (await bacaProduk(id))?.foto;
}

/** Isi berkas sebuah foto di folder unggahan test. */
function isiFoto(nama: string) {
  return readFile(path.join(FOLDER_UNGGAHAN_TEST, nama));
}

const fotoPng = (isi: Buffer<ArrayBuffer>) =>
  new File([isi], "foto.png", { type: "image/png" });

/** Admin mengunggah satu foto ke Produk; hasilnya keadaan yang dikembalikan ke form. */
function unggah(id: string, foto: File) {
  return aksiUnggahFotoProduk({}, formulir({ id, foto }));
}

/** Produk dengan sejumlah foto yang diunggah Admin, beserta isi setiap foto menurut urutannya. */
async function produkBerfoto(jumlah: number) {
  const id = await produkBaru();
  sebagaiPengunjung(await cookieAdminBaru());
  const isi = Array.from({ length: jumlah }, () => pngUnik());
  for (const satu of isi) {
    expect(await unggah(id, fotoPng(satu))).toEqual({});
  }
  const foto = (await fotoProduk(id)) ?? [];
  return { id, foto, isi };
}

afterAll(async () => {
  await koneksi.end();
});

describe("mengunggah foto Produk (PRD §3.3)", () => {
  it("Admin mengunggah 5 foto, yang tersimpan berurutan, dan foto pertama menjadi sampul", async () => {
    const id = await produkBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(refresh).mockClear();
    const isi = Array.from({ length: 5 }, () => pngUnik());

    for (const satu of isi) {
      expect(await unggah(id, fotoPng(satu))).toEqual({});
    }

    const foto = (await fotoProduk(id)) ?? [];
    expect(foto).toHaveLength(5);
    for (const [urutan, nama] of foto.entries()) {
      expect(nama).toMatch(/^[0-9a-f-]{36}\.png$/);
      expect(await isiFoto(nama)).toEqual(isi[urutan]);
    }
    // Halaman Ubah Produk dimuat ulang setelah setiap unggahan, supaya foto barunya tampil.
    expect(refresh).toHaveBeenCalledTimes(5);
  });

  it("foto keenam ditolak dengan pesan, dan tidak tersimpan", async () => {
    const { id, foto } = await produkBerfoto(5);
    const keenam = pngUnik();

    const keadaan = await unggah(id, fotoPng(keenam));

    expect(keadaan).toEqual({
      galat:
        "Produk ini sudah punya 5 foto, jumlah paling banyak untuk satu Produk. Hapus salah satu foto dulu, lalu unggah foto baru.",
    });
    expect(await fotoProduk(id)).toEqual(foto);
    expect(await adaBerkasBerisi(keenam)).toBe(false);
  });

  it("berkas yang bukan gambar ditolak dengan pesan, dan tidak tersimpan", async () => {
    const id = await produkBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await unggah(
      id,
      new File(["%PDF-1.7 daftar harga"], "foto.png", { type: "image/png" }),
    );

    expect(keadaan).toEqual({
      galat:
        "Berkas ini bukan gambar PNG, JPEG, atau WebP. Pilih foto dengan salah satu jenis itu.",
    });
    expect(await fotoProduk(id)).toEqual([]);
  });

  it("gambar lebih dari 2 MB ditolak dengan pesan, dan tidak tersimpan", async () => {
    const id = await produkBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await unggah(id, fotoPng(pngUnik(2_097_153)));

    expect(keadaan).toEqual({
      galat:
        "Foto ini lebih besar dari 2 MB. Perkecil fotonya, lalu pilih lagi.",
    });
    expect(await fotoProduk(id)).toEqual([]);
  });

  it("tanpa berkas yang dipilih, Admin diminta memilih foto", async () => {
    const id = await produkBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    // Browser mengirim berkas kosong tanpa nama bila Admin tidak memilih berkas.
    const keadaan = await unggah(
      id,
      new File([], "", { type: "application/octet-stream" }),
    );

    expect(keadaan).toEqual({
      galat:
        "Foto belum dipilih. Pilih berkas gambar PNG, JPEG, atau WebP, lalu pilih Unggah foto.",
    });
    expect(await fotoProduk(id)).toEqual([]);
  });

  for (const id of ["00000000-0000-4000-8000-000000000000", "bukan-id"]) {
    it(`foto untuk Produk "${id}" yang tidak ada menghasilkan halaman tidak ditemukan, dan tidak tertinggal di folder unggahan`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());
      const isi = pngUnik();

      await expect(unggah(id, fotoPng(isi))).rejects.toSatisfy(tidakDitemukan);

      expect(await adaBerkasBerisi(isi)).toBe(false);
    });
  }
});

describe("mengatur urutan foto Produk (PRD §3.3)", () => {
  it("foto yang dipindah ke urutan pertama menjadi sampul", async () => {
    const { id, foto } = await produkBerfoto(3);
    vi.mocked(refresh).mockClear();

    await aksiPindahkanFotoProduk(formulir({ id, foto: foto[2], urutan: "1" }));

    expect(await fotoProduk(id)).toEqual([foto[2], foto[0], foto[1]]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("sampul yang dipindah ke urutan kedua digantikan foto berikutnya", async () => {
    const { id, foto } = await produkBerfoto(3);

    await aksiPindahkanFotoProduk(formulir({ id, foto: foto[0], urutan: "2" }));

    expect(await fotoProduk(id)).toEqual([foto[1], foto[0], foto[2]]);
  });

  for (const urutan of ["0", "4", "1,5", "satu"]) {
    it(`urutan "${urutan}" di luar urutan foto tidak mengubah apa pun`, async () => {
      const { id, foto } = await produkBerfoto(3);

      await aksiPindahkanFotoProduk(formulir({ id, foto: foto[1], urutan }));

      expect(await fotoProduk(id)).toEqual(foto);
    });
  }

  it("foto milik Produk lain tidak bisa dipindah ke Produk ini", async () => {
    const lain = await produkBerfoto(1);
    const { id, foto } = await produkBerfoto(2);

    await aksiPindahkanFotoProduk(
      formulir({ id, foto: lain.foto[0], urutan: "1" }),
    );

    expect(await fotoProduk(id)).toEqual(foto);
    expect(await fotoProduk(lain.id)).toEqual(lain.foto);
  });

  for (const id of ["00000000-0000-4000-8000-000000000000", "bukan-id"]) {
    it(`Produk "${id}" yang tidak ada menghasilkan halaman tidak ditemukan`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());

      await expect(
        aksiPindahkanFotoProduk(
          formulir({ id, foto: `${randomUUID()}.png`, urutan: "1" }),
        ),
      ).rejects.toSatisfy(tidakDitemukan);
    });
  }
});

describe("menghapus foto Produk (PRD §3.3)", () => {
  it("bila foto pertama dihapus, foto berikutnya menjadi sampul, dan berkasnya dihapus dari folder unggahan", async () => {
    const { id, foto, isi } = await produkBerfoto(3);
    vi.mocked(refresh).mockClear();

    await aksiHapusFotoProduk(formulir({ id, foto: foto[0] }));

    expect(await fotoProduk(id)).toEqual([foto[1], foto[2]]);
    expect(await adaBerkasBerisi(isi[0])).toBe(false);
    expect(await isiFoto(foto[1])).toEqual(isi[1]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("foto milik Produk lain tidak terhapus lewat Produk ini, dan berkasnya tetap ada", async () => {
    const lain = await produkBerfoto(1);
    const { id, foto } = await produkBerfoto(1);

    await aksiHapusFotoProduk(formulir({ id, foto: lain.foto[0] }));

    expect(await fotoProduk(id)).toEqual(foto);
    expect(await fotoProduk(lain.id)).toEqual(lain.foto);
    expect(await isiFoto(lain.foto[0])).toEqual(lain.isi[0]);
  });

  for (const id of ["00000000-0000-4000-8000-000000000000", "bukan-id"]) {
    it(`Produk "${id}" yang tidak ada menghasilkan halaman tidak ditemukan`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());

      await expect(
        aksiHapusFotoProduk(formulir({ id, foto: `${randomUUID()}.png` })),
      ).rejects.toSatisfy(tidakDitemukan);
    });
  }
});

describe("Tamu tidak bisa mengubah foto Produk", () => {
  it("mengunggah: Tamu diarahkan ke halaman login, dan fotonya tidak tersimpan", async () => {
    const { id, foto } = await produkBerfoto(1);
    sebagaiPengunjung(new Headers());
    const isi = pngUnik();

    await expect(unggah(id, fotoPng(isi))).rejects.toSatisfy(arahKe("/admin"));

    expect(await fotoProduk(id)).toEqual(foto);
    expect(await adaBerkasBerisi(isi)).toBe(false);
  });

  it("memindah: Tamu diarahkan ke halaman login, dan urutan foto tetap", async () => {
    const { id, foto } = await produkBerfoto(2);
    sebagaiPengunjung(new Headers());

    await expect(
      aksiPindahkanFotoProduk(formulir({ id, foto: foto[1], urutan: "1" })),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await fotoProduk(id)).toEqual(foto);
  });

  it("menghapus: Tamu diarahkan ke halaman login, dan foto beserta berkasnya tetap ada", async () => {
    const { id, foto, isi } = await produkBerfoto(1);
    sebagaiPengunjung(new Headers());

    await expect(
      aksiHapusFotoProduk(formulir({ id, foto: foto[0] })),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await fotoProduk(id)).toEqual(foto);
    expect(await isiFoto(foto[0])).toEqual(isi[0]);
  });
});
