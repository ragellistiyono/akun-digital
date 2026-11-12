import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { afterAll, describe, expect, it, vi } from "vitest";

import { db, koneksi } from "@/server/db";
import { itemStok, produk, varian } from "@/server/db/schema";
import { daftarItemStokVarian } from "@/server/item-stok";
import { buatKategori, daftarKategori } from "@/server/kategori";
import { bacaItemStokTerkirim } from "@/server/pesanan";
import { bacaProduk, daftarProduk } from "@/server/produk";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import { isiItemStokUji, sisipkanProduk } from "@/server/uji-katalog";
import { sisipkanPesanan } from "@/server/uji-pesanan";
import { PNG } from "@/server/uji-unggahan";

import {
  aksiBuatProduk,
  aksiHapusProduk,
  aksiUbahFormatItemStok,
  aksiUbahProduk,
} from "./aksi";

// Test integrasi Server Action dengan database app_test dari .env.ci, termasuk ITEM_STOK_KEY khusus test.
// Header permintaan yang dibaca aksi lewat next/headers diganti dengan cookie milik pengunjung di setiap
// test. refresh() dari next/cache hanya bisa berjalan di dalam Server Action yang dijalankan Next.js, jadi
// diganti tiruan.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

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
        // Produk baru belum punya foto; foto diunggah di halaman Ubah Produk (T08).
        foto: [],
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

  it("Format Item stok dengan nama kolom kembar tanpa membedakan huruf besar dan kecil (UAT-D4)", async () => {
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

    expect(keadaan.formatItemStok).toEqual(["Email", "Password", "email"]);
    expect(keadaan.galat).toEqual({
      formatItemStok:
        "Nama kolom 3 sudah dipakai kolom sebelumnya, tanpa membedakan huruf besar dan kecil. Ganti namanya supaya setiap kolom berbeda.",
      kolomDitolak: [3],
    });
    expect(await produkBernama(nama)).toEqual([]);
  });

  it("isian kolom berupa berkas dibaca sebagai nama kolom kosong pada urutannya", async () => {
    const streaming = await kategoriBaru();
    const nama = namaUnik("Netflix Premium");
    sebagaiPengunjung(await cookieAdminBaru());
    const data = formulir({
      ...isianNetflix(streaming.id, nama),
      kolom: ["Email"],
    });
    data.append("kolom", new File(["Password"], "kolom.txt"));
    data.append("kolom", "Profil");

    const keadaan = await aksiBuatProduk(keadaanAwal(), data);

    expect(keadaan.formatItemStok).toEqual(["Email", "", "Profil"]);
    expect(keadaan.galat).toEqual({
      formatItemStok:
        "Nama kolom 2 belum diisi. Isi namanya, atau hapus kolom itu.",
      kolomDitolak: [2],
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
        "Nama kolom 1, 3, dan 4 belum diisi. Isi namanya, atau hapus kolom itu. Nama kolom 5 sudah dipakai kolom sebelumnya, tanpa membedakan huruf besar dan kecil. Ganti namanya supaya setiap kolom berbeda.",
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
          // Format Item stok diubah lewat form-nya sendiri (aksiUbahFormatItemStok), jadi kolom yang
          // terkirim di form Produk diabaikan.
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
      foto: [],
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

const FORMAT = ["Email", "Password", "Profil"];

/**
 * Produk baru [CONTOH] dengan Format Item stok `Email`, `Password`, `Profil` (UAT-D2) dan Varian "1 Bulan" serta
 * "3 Bulan", masing-masing dengan jumlah Item stok Tersedia itu. Namanya bukan Netflix, supaya tidak mengubah
 * hasil pencarian "netflix" di test e2e yang memakai database yang sama. Hasilnya id Produk dan id kedua
 * Variannya menurut urutan itu.
 */
async function produkBerformat({
  tersedia = [0, 0],
}: { tersedia?: [number, number] } = {}) {
  const produkId = await sisipkanProduk({
    nama: namaUnik("Format Item stok"),
    formatItemStok: FORMAT,
    varian: [
      { nama: "1 Bulan", hargaJual: 50_000, Tersedia: tersedia[0] },
      { nama: "3 Bulan", hargaJual: 140_000, Tersedia: tersedia[1] },
    ],
  });
  const semuaVarian = await db
    .select({ id: varian.id, nama: varian.nama })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const idVarian = (nama: string) =>
    semuaVarian.find((v) => v.nama === nama)?.id ?? "";
  return {
    produkId,
    varianSatuBulan: idVarian("1 Bulan"),
    varianTigaBulan: idVarian("3 Bulan"),
  };
}

// Contoh isi Item stok untuk format `Email`, `Password`, `Profil` seperti contoh baris PRD §4.2.
const BUDI = ["budi@mail.com", "rahasia123", "Profil 2"];
const ANDI = ["andi@mail.com", "rahasia789", "Profil 1"];

/** Pesanan Selesai dengan Item stok Terkirim berisi ANDI, yang mencatat nama kolom Format saat itu. */
const pesananSelesai = (varianId: string) =>
  sisipkanPesanan({
    varianId,
    status: "Selesai",
    itemStok: { status: "Terkirim", nilai: ANDI, formatSaatTerkirim: FORMAT },
  });

/** Pesanan Menunggu Pembayaran yang menahan Item stok berisi BUDI. */
const pesananMenahan = (varianId: string) =>
  sisipkanPesanan({
    varianId,
    status: "Menunggu Pembayaran",
    itemStok: { status: "Ditahan", nilai: BUDI },
  });

/**
 * FormData form Format Item stok: setiap kolom lama dikirim dengan nomor kolom lamanya (null berarti kolom itu
 * dihapus), lalu kolom baru menurut urutannya.
 */
function formulirFormat(
  id: string,
  kolomLama: (string | null)[],
  kolomBaru: string[] = [],
) {
  const isian: IsianFormulir = { id, kolom: kolomBaru };
  kolomLama.forEach((nama, i) => {
    if (nama !== null) isian[`kolom-lama-${i + 1}`] = nama;
  });
  return formulir(isian);
}

/** Keadaan awal form Format Item stok untuk Format itu: setiap kolom membawa nomor kolom lamanya. */
const keadaanFormat = (format = FORMAT) => ({
  kolom: format.map((nama, i) => ({ nama, nomorLama: i + 1 })),
});

const formatSekarang = async (produkId: string) =>
  (await bacaProduk(produkId))?.formatItemStok;

/** Nama kolom setiap Item stok di daftar Item stok Varian itu, beserta statusnya. */
const namaKolomDaftar = async (varianId: string) =>
  (await daftarItemStokVarian({ varianId })).map(({ status, kolom }) => ({
    status,
    nama: kolom.map((k) => k.nama),
  }));

const pesanTidakBoleh = (
  perbuatan: string,
  tersedia: number,
  ditahan: number,
) =>
  `Kolom tidak bisa ${perbuatan}, karena Produk ini masih punya Item stok Tersedia atau Ditahan: ${tersedia} Tersedia dan ${ditahan} Ditahan. Kolom bisa ditambah atau dihapus setelah semua Item stok Produk ini Terkirim, atau setelah Item stok Tersedia-nya dihapus di halaman Varian. Nama kolom tetap bisa diganti kapan saja.`;

describe("mengubah Format Item stok (PRD §4.1, UAT-D2)", () => {
  it("Admin mengganti nama kolom Profil menjadi Nama Profil walaupun Produk punya Item stok Tersedia dan Ditahan; Item stok Tersedia dan Ditahan tampil dengan nama baru, Item stok Terkirim tetap dengan nama lama", async () => {
    const { produkId, varianSatuBulan } = await produkBerformat({
      tersedia: [1, 0],
    });
    await pesananMenahan(varianSatuBulan);
    const selesai = await pesananSelesai(varianSatuBulan);
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(refresh).mockClear();

    const keadaan = await aksiUbahFormatItemStok(
      keadaanFormat(),
      formulirFormat(produkId, ["Email", "Password", " Nama Profil "]),
    );

    expect(keadaan).toEqual({
      kolom: [
        { nama: "Email", nomorLama: 1 },
        { nama: "Password", nomorLama: 2 },
        { nama: "Nama Profil", nomorLama: 3 },
      ],
      tersimpan: true,
    });
    expect(refresh).toHaveBeenCalled();
    expect(await formatSekarang(produkId)).toEqual([
      "Email",
      "Password",
      "Nama Profil",
    ]);
    // Daftar Item stok di dasbor admin (PRD §9.7).
    expect(await namaKolomDaftar(varianSatuBulan)).toEqual([
      { status: "Tersedia", nama: ["Email", "Password", "Nama Profil"] },
      { status: "Ditahan", nama: ["Email", "Password", "Nama Profil"] },
      { status: "Terkirim", nama: FORMAT },
    ]);
    // Halaman Pesanan, email kirim ulang, dan detail Pesanan di dasbor admin membaca Item stok Terkirim lewat
    // bacaItemStokTerkirim, dengan nama kolom yang dicatat saat Terkirim.
    expect(await bacaItemStokTerkirim(selesai.id)).toEqual([
      { nama: "Email", nilai: ANDI[0] },
      { nama: "Password", nilai: ANDI[1] },
      { nama: "Profil", nilai: ANDI[2] },
    ]);
  });

  it("menambah kolom PIN ditolak selama Produk masih punya Item stok Tersedia di salah satu Variannya, dengan pesan sebabnya, dan Format Item stok tidak berubah", async () => {
    const { produkId, varianSatuBulan } = await produkBerformat({
      tersedia: [0, 3],
    });
    await pesananSelesai(varianSatuBulan);
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahFormatItemStok(
      keadaanFormat(),
      formulirFormat(produkId, FORMAT, ["PIN"]),
    );

    expect(keadaan).toEqual({
      kolom: [
        { nama: "Email", nomorLama: 1 },
        { nama: "Password", nomorLama: 2 },
        { nama: "Profil", nomorLama: 3 },
        { nama: "PIN", nomorLama: null },
      ],
      galat: { pesan: pesanTidakBoleh("ditambah", 3, 0), kolomDitolak: [] },
    });
    expect(await formatSekarang(produkId)).toEqual(FORMAT);
  });

  it("menghapus kolom ditolak selama Produk masih punya Item stok Ditahan", async () => {
    const { produkId, varianTigaBulan } = await produkBerformat();
    await pesananMenahan(varianTigaBulan);
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahFormatItemStok(
      keadaanFormat(),
      formulirFormat(produkId, ["Email", "Password", null]),
    );

    expect(keadaan.galat).toEqual({
      pesan: pesanTidakBoleh("dihapus", 0, 1),
      kolomDitolak: [],
    });
    expect(await formatSekarang(produkId)).toEqual(FORMAT);
  });

  it("ganti nama dan tambah kolom sekaligus selagi ada Item stok Tersedia ditolak seluruhnya, termasuk ganti namanya", async () => {
    const { produkId } = await produkBerformat({ tersedia: [2, 0] });
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahFormatItemStok(
      keadaanFormat(),
      formulirFormat(produkId, ["Email", "Password", "Nama Profil"], ["PIN"]),
    );

    expect(keadaan.galat?.pesan).toBe(pesanTidakBoleh("ditambah", 2, 0));
    expect(await formatSekarang(produkId)).toEqual(FORMAT);
  });

  it("menghapus Profil dan menambah PIN selagi ada Item stok Tersedia ditolak, karena itu menambah dan menghapus kolom", async () => {
    const { produkId } = await produkBerformat({ tersedia: [1, 0] });
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahFormatItemStok(
      keadaanFormat(),
      formulirFormat(produkId, ["Email", "Password", null], ["PIN"]),
    );

    expect(keadaan.galat?.pesan).toBe(
      pesanTidakBoleh("ditambah atau dihapus", 1, 0),
    );
    expect(await formatSekarang(produkId)).toEqual(FORMAT);
  });

  it("menambah kolom PIN diterima bila semua Item stok Produk itu sudah Terkirim, dan Item stok Terkirim tetap tampil dengan kolom lamanya", async () => {
    const { produkId, varianSatuBulan } = await produkBerformat();
    const selesai = await pesananSelesai(varianSatuBulan);
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahFormatItemStok(
      keadaanFormat(),
      formulirFormat(produkId, FORMAT, ["PIN"]),
    );

    expect(keadaan.tersimpan).toBe(true);
    expect(await formatSekarang(produkId)).toEqual([...FORMAT, "PIN"]);
    expect(await namaKolomDaftar(varianSatuBulan)).toEqual([
      { status: "Terkirim", nama: FORMAT },
    ]);
    expect(
      (await bacaItemStokTerkirim(selesai.id))?.map((k) => k.nama),
    ).toEqual(FORMAT);
  });

  it("menghapus kolom diterima bila Produk tidak punya Item stok sama sekali", async () => {
    const { produkId } = await produkBerformat();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahFormatItemStok(
      keadaanFormat(),
      formulirFormat(produkId, ["Email", null, "Profil"]),
    );

    expect(keadaan).toEqual({
      kolom: [
        { nama: "Email", nomorLama: 1 },
        { nama: "Profil", nomorLama: 3 },
      ],
      tersimpan: true,
    });
    expect(await formatSekarang(produkId)).toEqual(["Email", "Profil"]);
  });

  it("nama kolom yang kembar atau kosong ditolak dengan nomor kolomnya, seperti saat membuat Produk", async () => {
    const { produkId } = await produkBerformat({ tersedia: [1, 0] });
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahFormatItemStok(
      keadaanFormat(),
      formulirFormat(produkId, ["Email", " ", "email"]),
    );

    expect(keadaan).toEqual({
      kolom: [
        { nama: "Email", nomorLama: 1 },
        { nama: " ", nomorLama: 2 },
        { nama: "email", nomorLama: 3 },
      ],
      galat: {
        pesan:
          "Nama kolom 2 belum diisi. Isi namanya, atau hapus kolom itu. Nama kolom 3 sudah dipakai kolom sebelumnya, tanpa membedakan huruf besar dan kecil. Ganti namanya supaya setiap kolom berbeda.",
        kolomDitolak: [2, 3],
      },
    });
    expect(await formatSekarang(produkId)).toEqual(FORMAT);
  });

  it("Format Item stok tanpa kolom ditolak dengan pesan", async () => {
    const { produkId } = await produkBerformat();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahFormatItemStok(
      keadaanFormat(),
      formulirFormat(produkId, [null, null, null]),
    );

    expect(keadaan.galat).toEqual({
      pesan:
        "Format Item stok belum punya kolom. Pilih Tambah kolom, lalu isi nama kolomnya, misalnya Email.",
      kolomDitolak: [],
    });
    expect(await formatSekarang(produkId)).toEqual(FORMAT);
  });

  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan Format Item stok tidak berubah", async () => {
    const { produkId } = await produkBerformat();
    sebagaiPengunjung(new Headers());

    await expect(
      aksiUbahFormatItemStok(
        keadaanFormat(),
        formulirFormat(produkId, ["Email", "Password", "Nama Profil"]),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await formatSekarang(produkId)).toEqual(FORMAT);
  });

  for (const id of ["00000000-0000-4000-8000-000000000000", "bukan-id"]) {
    it(`Produk "${id}" yang tidak ada menghasilkan halaman tidak ditemukan`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());

      await expect(
        aksiUbahFormatItemStok(keadaanFormat(), formulirFormat(id, FORMAT)),
      ).rejects.toSatisfy(tidakDitemukan);
    });
  }

  // Pengisian Item stok (PRD §4.2) mengunci baris Varian dan Produknya dengan FOR UPDATE, lalu menyimpan Item
  // stok Tersedia dalam transaksi yang sama. Transaksi di bawah meniru pengisian itu, supaya bisa ditahan di
  // tengah jalan.
  it("menambah kolom selagi Admin lain sedang mengisi Item stok menunggu pengisian itu selesai, lalu ditolak karena Item stok barunya Tersedia", async () => {
    const { produkId, varianSatuBulan } = await produkBerformat();
    await pesananSelesai(varianSatuBulan);
    sebagaiPengunjung(await cookieAdminBaru());

    let lanjutkan = () => {};
    const tertahan = new Promise<void>((selesai) => (lanjutkan = selesai));
    let terkunci = () => {};
    const sudahTerkunci = new Promise<void>((selesai) => (terkunci = selesai));
    const pengisian = db.transaction(async (tx) => {
      await tx
        .select({ formatItemStok: produk.formatItemStok })
        .from(varian)
        .innerJoin(produk, eq(varian.produkId, produk.id))
        .where(eq(varian.id, varianSatuBulan))
        .for("update");
      await tx
        .insert(itemStok)
        .values({ varianId: varianSatuBulan, ...isiItemStokUji(BUDI) });
      terkunci();
      await tertahan;
    });
    await sudahTerkunci;

    let aksiSelesai = false;
    const hasilAksi = aksiUbahFormatItemStok(
      keadaanFormat(),
      formulirFormat(produkId, FORMAT, ["PIN"]),
    ).finally(() => (aksiSelesai = true));
    // Aksi menunggu pengisian selesai, bukan menghitung Item stok lebih dulu tanpa Item stok barunya.
    await new Promise((selesai) => setTimeout(selesai, 300));
    expect(aksiSelesai).toBe(false);

    lanjutkan();
    await pengisian;
    const keadaan = await hasilAksi;

    expect(keadaan.galat?.pesan).toBe(pesanTidakBoleh("ditambah", 1, 0));
    expect(await formatSekarang(produkId)).toEqual(FORMAT);
  });
});

// Issue T29 (PRD §3.7): Produk hanya bisa dihapus bila belum pernah tercatat di Pesanan berstatus apa pun.
describe("menghapus Produk (PRD §3.7)", () => {
  /** Netflix Premium [CONTOH] dengan Varian 1 Bulan dan 3 Bulan beserta Item stok Tersedia-nya. */
  async function netflixPremium() {
    const nama = namaUnik("Netflix Premium");
    const produkId = await sisipkanProduk({
      nama,
      formatItemStok: FORMAT,
      varian: [
        { nama: "1 Bulan", hargaJual: 50000, Tersedia: 10 },
        { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
      ],
    });
    const [satuBulan] = await db
      .select({ id: varian.id })
      .from(varian)
      .where(and(eq(varian.produkId, produkId), eq(varian.nama, "1 Bulan")));
    return { produkId, nama, satuBulan: satuBulan.id };
  }

  const pesanTidakBolehHapus = (jumlah: number) =>
    `Produk ini tidak bisa dihapus, karena sudah tercatat di ${jumlah} Pesanan. Pesanan berstatus apa pun dihitung, termasuk Kedaluwarsa dan Dibatalkan. Nonaktifkan Produk ini saja: hapus centang Aktif di form Produk, lalu simpan. Produk nonaktif hilang dari katalog dan tidak bisa dibeli, sedangkan Pesanan lamanya tetap tampil utuh.`;

  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan Produk yang belum pernah dipesan tetap ada", async () => {
    const { produkId } = await netflixPremium();
    sebagaiPengunjung(new Headers());

    await expect(
      aksiHapusProduk({}, formulir({ id: produkId })),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await bacaProduk(produkId)).not.toBeNull();
  });

  for (const status of ["Kedaluwarsa", "Dibatalkan"] as const) {
    it(`menghapus Netflix Premium yang pernah dipesan, walaupun Pesanannya ${status}, ditolak dengan pesan untuk menonaktifkannya (UAT-C6 langkah 3)`, async () => {
      const { produkId, satuBulan } = await netflixPremium();
      await sisipkanPesanan({ varianId: satuBulan, status });
      sebagaiPengunjung(await cookieAdminBaru());

      expect(await aksiHapusProduk({}, formulir({ id: produkId }))).toEqual({
        galat: pesanTidakBolehHapus(1),
      });

      expect(await bacaProduk(produkId)).not.toBeNull();
    });
  }

  it("Admin menghapus Produk yang belum pernah dipesan, lalu dibawa ke daftar Produk", async () => {
    const { produkId, nama } = await netflixPremium();
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiHapusProduk({}, formulir({ id: produkId })),
    ).rejects.toSatisfy(arahKe("/admin/produk"));

    expect(await bacaProduk(produkId)).toBeNull();
    expect(await produkBernama(nama)).toEqual([]);
  });

  for (const id of ["00000000-0000-4000-8000-000000000000", "bukan-id"]) {
    it(`Produk "${id}" yang tidak ada menghasilkan halaman tidak ditemukan`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());

      await expect(aksiHapusProduk({}, formulir({ id }))).rejects.toSatisfy(
        tidakDitemukan,
      );
    });
  }
});
