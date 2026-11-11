import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { afterAll, describe, expect, it, vi } from "vitest";

import { koneksi } from "@/server/db";
import { buatKategori, daftarKategori } from "@/server/kategori";
import { bacaProduk, daftarProduk } from "@/server/produk";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import { PNG } from "@/server/uji-unggahan";

import { aksiBuatProduk, aksiUbahProduk } from "./aksi";

// Test integrasi Server Action dengan database app_test dari .env.ci. Header permintaan yang dibaca
// aksi lewat next/headers diganti dengan cookie milik pengunjung di setiap test.
vi.mock("next/headers", () => ({ headers: vi.fn() }));

function sebagaiPengunjung(kepala: Headers) {
  vi.mocked(headers).mockResolvedValue(kepala);
}

type IsianFormulir = Record<string, string | string[]>;

/** FormData seperti yang dikirim form Produk. Isian berupa daftar (kolom) dikirim berulang. */
function formulir(isian: IsianFormulir) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) {
    for (const satu of Array.isArray(nilai) ? nilai : [nilai]) {
      data.append(nama, satu);
    }
  }
  return data;
}

/** Nama unik per test, karena database test dipakai bersama oleh semua test. */
const namaUnik = (nama: string) => `${nama} ${randomUUID().slice(0, 8)}`;

/** Kategori baru yang dibuat langsung lewat modul server, untuk tempat Produk. */
async function kategoriBaru(nama = namaUnik("Streaming")) {
  await buatKategori({
    nama,
    ikon: new File([PNG], "ikon.png", { type: "image/png" }),
  });
  const [ada] = (await daftarKategori()).filter((k) => k.nama === nama);
  return ada;
}

async function produkBernama(nama: string) {
  const ditemukan = (await daftarProduk()).filter((p) => p.nama === nama);
  return Promise.all(ditemukan.map((p) => bacaProduk(p.id)));
}

/** Isian lengkap Produk Netflix Premium dari issue T07, untuk Kategori yang diberikan. */
function isianNetflix(kategoriId: string, nama: string): IsianFormulir {
  return {
    nama,
    kategoriId,
    deskripsi: "Akun Netflix Premium untuk satu profil.",
    ketentuanGaransi: "Garansi 30 hari sejak Item stok diterima.",
    unggulan: "on",
    aktif: "on",
    kolom: ["Email", "Password", "Profil"],
  };
}

/** Netflix Premium yang sudah ada, dibuat lewat aksi oleh Admin. */
async function netflixAda() {
  const streaming = await kategoriBaru();
  const nama = namaUnik("Netflix Premium");
  sebagaiPengunjung(await cookieAdminBaru());
  await expect(
    aksiBuatProduk(keadaanAwal(), formulir(isianNetflix(streaming.id, nama))),
  ).rejects.toSatisfy(arahKe("/admin/produk"));
  const [ada] = await produkBernama(nama);
  if (!ada) throw new Error(`Produk ${nama} tidak terbuat untuk test.`);
  return ada;
}

/** Isian form ubah untuk Produk yang sudah ada, tanpa perubahan. */
function isianUbah(ada: NonNullable<Awaited<ReturnType<typeof bacaProduk>>>) {
  const isian: IsianFormulir = {
    id: ada.id,
    nama: ada.nama,
    kategoriId: ada.kategoriId,
    deskripsi: ada.deskripsi,
    ketentuanGaransi: ada.ketentuanGaransi,
  };
  if (ada.unggulan) isian.unggulan = "on";
  if (ada.aktif) isian.aktif = "on";
  return isian;
}

const keadaanAwal = () => ({
  nama: "",
  kategoriId: "",
  deskripsi: "",
  ketentuanGaransi: "",
  unggulan: false,
  aktif: true,
  formatItemStok: [""],
});

afterAll(async () => {
  await koneksi.end();
});

describe("membuat Produk (PRD §3.2, §4.1)", () => {
  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan Produk tidak dibuat", async () => {
    const streaming = await kategoriBaru();
    const nama = namaUnik("Netflix Premium");
    sebagaiPengunjung(new Headers());

    await expect(
      aksiBuatProduk(keadaanAwal(), formulir(isianNetflix(streaming.id, nama))),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await produkBernama(nama)).toEqual([]);
  });

  it("Admin membuat Netflix Premium di Kategori Streaming dengan Format Item stok Email, Password, Profil dan tanda Produk Unggulan", async () => {
    const streaming = await kategoriBaru();
    const nama = namaUnik("Netflix Premium");
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiBuatProduk(
        keadaanAwal(),
        formulir({
          ...isianNetflix(streaming.id, `  ${nama} `),
          kolom: [" Email", "Password ", "Profil"],
        }),
      ),
    ).rejects.toSatisfy(arahKe("/admin/produk"));

    expect(await produkBernama(nama)).toEqual([
      {
        id: expect.any(String),
        nama,
        kategoriId: streaming.id,
        deskripsi: "Akun Netflix Premium untuk satu profil.",
        ketentuanGaransi: "Garansi 30 hari sejak Item stok diterima.",
        unggulan: true,
        aktif: true,
        formatItemStok: ["Email", "Password", "Profil"],
      },
    ]);
  });
});

describe("Produk yang ditolak dengan pesan dan tidak dibuat", () => {
  it("Produk tanpa Kategori", async () => {
    const nama = namaUnik("Netflix Premium");
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiBuatProduk(
      keadaanAwal(),
      formulir({ ...isianNetflix("", nama) }),
    );

    expect(keadaan).toEqual({
      nama,
      kategoriId: "",
      deskripsi: "Akun Netflix Premium untuk satu profil.",
      ketentuanGaransi: "Garansi 30 hari sejak Item stok diterima.",
      unggulan: true,
      aktif: true,
      formatItemStok: ["Email", "Password", "Profil"],
      galat: {
        kategoriId:
          "Kategori belum dipilih. Pilih satu Kategori untuk Produk ini.",
      },
    });
    expect(await produkBernama(nama)).toEqual([]);
  });

  it("Produk dengan Kategori yang sudah tidak ada", async () => {
    const nama = namaUnik("Netflix Premium");
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiBuatProduk(
      keadaanAwal(),
      formulir(isianNetflix(randomUUID(), nama)),
    );

    expect(keadaan.galat).toEqual({
      kategoriId:
        "Kategori yang dipilih sudah tidak ada. Pilih Kategori lain dari daftar.",
    });
    expect(await produkBernama(nama)).toEqual([]);
  });

  it("Format Item stok tanpa kolom", async () => {
    const streaming = await kategoriBaru();
    const nama = namaUnik("Netflix Premium");
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiBuatProduk(
      keadaanAwal(),
      formulir({ ...isianNetflix(streaming.id, nama), kolom: [] }),
    );

    expect(keadaan.formatItemStok).toEqual([]);
    expect(keadaan.galat).toEqual({
      formatItemStok:
        "Format Item stok belum punya kolom. Pilih Tambah kolom, lalu isi nama kolomnya, misalnya Email.",
      kolomDitolak: [],
    });
    expect(await produkBernama(nama)).toEqual([]);
  });

  it("Format Item stok dengan nama kolom kosong", async () => {
    const streaming = await kategoriBaru();
    const nama = namaUnik("Netflix Premium");
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiBuatProduk(
      keadaanAwal(),
      formulir({
        ...isianNetflix(streaming.id, nama),
        kolom: ["Email", "  ", "Profil"],
      }),
    );

    expect(keadaan.formatItemStok).toEqual(["Email", "  ", "Profil"]);
    expect(keadaan.galat).toEqual({
      formatItemStok:
        "Nama kolom 2 belum diisi. Isi namanya, atau hapus kolom itu.",
      kolomDitolak: [2],
    });
    expect(await produkBernama(nama)).toEqual([]);
  });

  it("Format Item stok dengan nama kolom kembar", async () => {
    const streaming = await kategoriBaru();
    const nama = namaUnik("Netflix Premium");
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiBuatProduk(
      keadaanAwal(),
      formulir({
        ...isianNetflix(streaming.id, nama),
        kolom: ["Email", "Password", "email"],
      }),
    );

    expect(keadaan.galat).toEqual({
      formatItemStok:
        "Nama kolom 3 sudah dipakai kolom sebelumnya. Ganti namanya supaya setiap kolom berbeda.",
      kolomDitolak: [3],
    });
    expect(await produkBernama(nama)).toEqual([]);
  });

  it("kolom kosong dan kembar sekaligus disebut dalam satu pesan", async () => {
    const streaming = await kategoriBaru();
    const nama = namaUnik("Netflix Premium");
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiBuatProduk(
      keadaanAwal(),
      formulir({
        ...isianNetflix(streaming.id, nama),
        kolom: ["", "Email", "", "", "Email"],
      }),
    );

    expect(keadaan.galat).toEqual({
      formatItemStok:
        "Nama kolom 1, 3, dan 4 belum diisi. Isi namanya, atau hapus kolom itu. Nama kolom 5 sudah dipakai kolom sebelumnya. Ganti namanya supaya setiap kolom berbeda.",
      kolomDitolak: [1, 3, 4, 5],
    });
    expect(await produkBernama(nama)).toEqual([]);
  });

  it("nama, deskripsi, ketentuan garansi, Kategori, dan Format Item stok kosong: semua pesan tampil sekaligus", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiBuatProduk(
      keadaanAwal(),
      formulir({
        nama: " ",
        kategoriId: "",
        deskripsi: "",
        ketentuanGaransi: "\n",
        kolom: [""],
      }),
    );

    expect(keadaan).toEqual({
      nama: " ",
      kategoriId: "",
      deskripsi: "",
      ketentuanGaransi: "\n",
      unggulan: false,
      aktif: false,
      formatItemStok: [""],
      galat: {
        nama: "Nama Produk belum diisi. Ketik nama Produk, misalnya Netflix Premium.",
        kategoriId:
          "Kategori belum dipilih. Pilih satu Kategori untuk Produk ini.",
        deskripsi:
          "Deskripsi belum diisi. Tulis penjelasan Produk ini untuk Pembeli.",
        ketentuanGaransi:
          "Ketentuan garansi belum diisi. Tulis ketentuan garansi yang berlaku untuk Produk ini.",
        formatItemStok:
          "Nama kolom 1 belum diisi. Isi namanya, atau hapus kolom itu.",
        kolomDitolak: [1],
      },
    });
  });
});

describe("mengubah Produk (PRD §3.2, §3.7)", () => {
  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan Produk tidak berubah", async () => {
    const ada = await netflixAda();
    sebagaiPengunjung(new Headers());

    await expect(
      aksiUbahProduk(
        keadaanAwal(),
        formulir({
          ...isianUbah(ada),
          nama: namaUnik("Disney Plus"),
          unggulan: [],
          aktif: [],
        }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await bacaProduk(ada.id)).toEqual(ada);
  });

  it("Admin menonaktifkan Produk, lalu mengaktifkannya kembali", async () => {
    const ada = await netflixAda();
    const tanpaAktif = { ...isianUbah(ada), aktif: [] };

    await expect(
      aksiUbahProduk(keadaanAwal(), formulir(tanpaAktif)),
    ).rejects.toSatisfy(arahKe("/admin/produk"));
    expect(await bacaProduk(ada.id)).toEqual({ ...ada, aktif: false });

    await expect(
      aksiUbahProduk(keadaanAwal(), formulir({ ...tanpaAktif, aktif: "on" })),
    ).rejects.toSatisfy(arahKe("/admin/produk"));
    expect(await bacaProduk(ada.id)).toEqual(ada);
  });

  it("Admin mengubah nama, Kategori, deskripsi, ketentuan garansi, dan tanda Produk Unggulan, sedangkan Format Item stok tetap", async () => {
    const ada = await netflixAda();
    const musik = await kategoriBaru(namaUnik("Musik"));
    const namaBaru = namaUnik("Spotify Premium");

    await expect(
      aksiUbahProduk(
        keadaanAwal(),
        formulir({
          ...isianUbah(ada),
          nama: ` ${namaBaru}`,
          kategoriId: musik.id,
          deskripsi: "Akun Spotify Premium.",
          ketentuanGaransi: "Garansi 7 hari.",
          unggulan: [],
          // Format Item stok belum bisa diubah (T28), jadi kolom yang terkirim diabaikan.
          kolom: ["Kode"],
        }),
      ),
    ).rejects.toSatisfy(arahKe("/admin/produk"));

    expect(await bacaProduk(ada.id)).toEqual({
      id: ada.id,
      nama: namaBaru,
      kategoriId: musik.id,
      deskripsi: "Akun Spotify Premium.",
      ketentuanGaransi: "Garansi 7 hari.",
      unggulan: false,
      aktif: true,
      formatItemStok: ["Email", "Password", "Profil"],
    });
  });

  it("Produk yang Kategorinya dikosongkan ditolak dengan pesan, dan tidak berubah", async () => {
    const ada = await netflixAda();

    const keadaan = await aksiUbahProduk(
      keadaanAwal(),
      formulir({ ...isianUbah(ada), kategoriId: "", nama: "" }),
    );

    expect(keadaan).toEqual({
      nama: "",
      kategoriId: "",
      deskripsi: ada.deskripsi,
      ketentuanGaransi: ada.ketentuanGaransi,
      unggulan: true,
      aktif: true,
      galat: {
        nama: "Nama Produk belum diisi. Ketik nama Produk, misalnya Netflix Premium.",
        kategoriId:
          "Kategori belum dipilih. Pilih satu Kategori untuk Produk ini.",
      },
    });
    expect(await bacaProduk(ada.id)).toEqual(ada);
  });

  it("Produk yang dipindah ke Kategori yang sudah tidak ada ditolak dengan pesan, dan tidak berubah", async () => {
    const ada = await netflixAda();

    const keadaan = await aksiUbahProduk(
      keadaanAwal(),
      formulir({ ...isianUbah(ada), kategoriId: randomUUID() }),
    );

    expect(keadaan.galat).toEqual({
      kategoriId:
        "Kategori yang dipilih sudah tidak ada. Pilih Kategori lain dari daftar.",
    });
    expect(await bacaProduk(ada.id)).toEqual(ada);
  });

  for (const id of ["00000000-0000-4000-8000-000000000000", "bukan-id"]) {
    it(`Produk "${id}" yang tidak ada menghasilkan halaman tidak ditemukan`, async () => {
      const streaming = await kategoriBaru();
      sebagaiPengunjung(await cookieAdminBaru());

      await expect(
        aksiUbahProduk(
          keadaanAwal(),
          formulir({
            ...isianNetflix(streaming.id, namaUnik("Netflix Premium")),
            id,
          }),
        ),
      ).rejects.toSatisfy(tidakDitemukan);
    });
  }
});
