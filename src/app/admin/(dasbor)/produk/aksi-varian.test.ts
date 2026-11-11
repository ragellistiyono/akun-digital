import { randomUUID } from "node:crypto";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { afterAll, describe, expect, it, vi } from "vitest";

import { koneksi } from "@/server/db";
import { buatKategori, daftarKategori } from "@/server/kategori";
import { buatProduk, daftarProduk } from "@/server/produk";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import { PNG } from "@/server/uji-unggahan";
import { daftarVarian, tambahVarian } from "@/server/varian";

import { aksiTambahVarian, aksiUbahVarian } from "./aksi-varian";

// Test integrasi Server Action dengan database app_test dari .env.ci. Header permintaan yang dibaca
// aksi lewat next/headers diganti dengan cookie milik pengunjung di setiap test. refresh() dari
// next/cache hanya bisa berjalan di dalam Server Action yang dijalankan Next.js, jadi diganti tiruan.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

function sebagaiPengunjung(kepala: Headers) {
  vi.mocked(headers).mockResolvedValue(kepala);
}

/** FormData seperti yang dikirim form Varian. Isian undefined tidak terkirim, seperti kotak centang kosong. */
function formulir(isian: Record<string, string | undefined>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) {
    if (nilai !== undefined) data.set(nama, nilai);
  }
  return data;
}

/** Nama unik per test, karena database test dipakai bersama oleh semua test. */
const namaUnik = (nama: string) => `${nama} ${randomUUID().slice(0, 8)}`;

/** Produk Netflix Premium baru tanpa Varian, dibuat langsung lewat modul server. */
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

const keadaanKosong = () => ({
  nama: "",
  hargaJual: "",
  hargaNormal: "",
  aktif: true,
});

/** Isian form Tambah Varian untuk Varian "1 Bulan" seharga Rp 50.000 dari PRD §3.2. */
const isianSatuBulan = (produkId: string) => ({
  produkId,
  nama: "1 Bulan",
  hargaJual: "50.000",
  hargaNormal: "75.000",
  aktif: "on",
});

afterAll(async () => {
  await koneksi.end();
});

describe("menambah Varian (PRD §3.2, §3.5)", () => {
  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan Varian tidak dibuat", async () => {
    const produkId = await produkBaru();
    sebagaiPengunjung(new Headers());

    await expect(
      aksiTambahVarian(keadaanKosong(), formulir(isianSatuBulan(produkId))),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await daftarVarian(produkId)).toEqual([]);
  });

  it("Admin menambah Varian 1 Bulan dengan Harga jual Rp 50.000 dan Harga normal Rp 75.000", async () => {
    const produkId = await produkBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(refresh).mockClear();

    const keadaan = await aksiTambahVarian(
      keadaanKosong(),
      formulir({ ...isianSatuBulan(produkId), nama: " 1 Bulan " }),
    );

    expect(keadaan).toEqual({ ...keadaanKosong(), tersimpan: true });
    expect(refresh).toHaveBeenCalledOnce();
    expect(await daftarVarian(produkId)).toEqual([
      {
        id: expect.any(String),
        nama: "1 Bulan",
        hargaJual: 50_000,
        hargaNormal: 75_000,
        aktif: true,
      },
    ]);
  });
});

describe("Harga jual di form Tambah Varian (PRD §3.2, UAT-C4)", () => {
  for (const [hargaJual, tersimpan] of [
    ["1.000", 1_000],
    ["499.000", 499_000],
    ["1000", 1_000],
    ["Rp 499.000", 499_000],
  ] as const) {
    it(`Harga jual "${hargaJual}" diterima sebagai Rp ${tersimpan}`, async () => {
      const produkId = await produkBaru();
      sebagaiPengunjung(await cookieAdminBaru());

      const keadaan = await aksiTambahVarian(
        keadaanKosong(),
        formulir({ ...isianSatuBulan(produkId), hargaJual, hargaNormal: "" }),
      );

      expect(keadaan.galat).toBeUndefined();
      expect(await daftarVarian(produkId)).toEqual([
        {
          id: expect.any(String),
          nama: "1 Bulan",
          hargaJual: tersimpan,
          hargaNormal: null,
          aktif: true,
        },
      ]);
    });
  }

  for (const [hargaJual, pesan] of [
    [
      "999",
      "Harga jual kurang dari Rp 1.000. Isi Harga jual minimal Rp 1.000.",
    ],
    ["0", "Harga jual kurang dari Rp 1.000. Isi Harga jual minimal Rp 1.000."],
    [
      "499.001",
      "Harga jual lebih dari Rp 499.000, batas tagihan QRIS. Isi Harga jual paling banyak Rp 499.000.",
    ],
    [
      "1.500,5",
      "Harga jual harus rupiah bulat, tanpa sen. Hapus angka di belakang koma.",
    ],
    [
      "",
      "Harga jual belum diisi. Ketik Harga jual dalam rupiah, misalnya 50.000.",
    ],
    [
      "lima puluh ribu",
      "Harga jual tidak terbaca sebagai rupiah. Ketik angkanya saja, misalnya 50000 atau 50.000.",
    ],
    [
      "-5.000",
      "Harga jual tidak terbaca sebagai rupiah. Ketik angkanya saja, misalnya 50000 atau 50.000.",
    ],
  ] as const) {
    it(`Harga jual "${hargaJual}" ditolak dengan pesan, dan Varian tidak dibuat`, async () => {
      const produkId = await produkBaru();
      sebagaiPengunjung(await cookieAdminBaru());

      const keadaan = await aksiTambahVarian(
        keadaanKosong(),
        formulir({ ...isianSatuBulan(produkId), hargaJual, hargaNormal: "" }),
      );

      expect(keadaan).toEqual({
        nama: "1 Bulan",
        hargaJual,
        hargaNormal: "",
        aktif: true,
        galat: { hargaJual: pesan },
      });
      expect(await daftarVarian(produkId)).toEqual([]);
    });
  }
});

describe("Harga normal di form Tambah Varian (PRD §3.5, UAT-C4)", () => {
  it("Harga normal boleh di atas Rp 499.000, karena tidak dibatasi maksimum", async () => {
    const produkId = await produkBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiTambahVarian(
      keadaanKosong(),
      formulir({
        ...isianSatuBulan(produkId),
        hargaJual: "499.000",
        hargaNormal: "600.000",
      }),
    );

    expect(keadaan.galat).toBeUndefined();
    expect(await daftarVarian(produkId)).toEqual([
      expect.objectContaining({ hargaJual: 499_000, hargaNormal: 600_000 }),
    ]);
  });

  for (const [hargaJual, hargaNormal, pesan] of [
    [
      "135.000",
      "135.000",
      "Harga normal tidak lebih besar dari Harga jual Rp 135.000. Isi Harga normal di atas Harga jual, atau kosongkan bila tidak ada harga pembanding.",
    ],
    [
      "50.000",
      "40.000",
      "Harga normal tidak lebih besar dari Harga jual Rp 50.000. Isi Harga normal di atas Harga jual, atau kosongkan bila tidak ada harga pembanding.",
    ],
    [
      "50.000",
      "75.000,5",
      "Harga normal harus rupiah bulat, tanpa sen. Hapus angka di belakang koma.",
    ],
    [
      "50.000",
      "tujuh lima",
      "Harga normal tidak terbaca sebagai rupiah. Ketik angkanya saja, misalnya 75.000, atau kosongkan.",
    ],
    [
      "50.000",
      "10.000.000.000.000.000",
      "Harga normal terlalu besar untuk disimpan. Periksa lagi angkanya.",
    ],
  ] as const) {
    it(`Harga normal "${hargaNormal}" untuk Harga jual "${hargaJual}" ditolak dengan pesan, dan Varian tidak dibuat`, async () => {
      const produkId = await produkBaru();
      sebagaiPengunjung(await cookieAdminBaru());

      const keadaan = await aksiTambahVarian(
        keadaanKosong(),
        formulir({ ...isianSatuBulan(produkId), hargaJual, hargaNormal }),
      );

      expect(keadaan).toEqual({
        nama: "1 Bulan",
        hargaJual,
        hargaNormal,
        aktif: true,
        galat: { hargaNormal: pesan },
      });
      expect(await daftarVarian(produkId)).toEqual([]);
    });
  }
});

describe("isian lain di form Tambah Varian", () => {
  it("nama dan Harga jual kosong: kedua pesan tampil sekaligus, dan Varian tidak dibuat", async () => {
    const produkId = await produkBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiTambahVarian(
      keadaanKosong(),
      formulir({ produkId, nama: " ", hargaJual: "", hargaNormal: "" }),
    );

    expect(keadaan).toEqual({
      nama: " ",
      hargaJual: "",
      hargaNormal: "",
      aktif: false,
      galat: {
        nama: "Nama Varian belum diisi. Ketik nama Varian, misalnya 1 Bulan.",
        hargaJual:
          "Harga jual belum diisi. Ketik Harga jual dalam rupiah, misalnya 50.000.",
      },
    });
    expect(await daftarVarian(produkId)).toEqual([]);
  });

  it("Varian yang ditambahkan tanpa centang Aktif tersimpan nonaktif", async () => {
    const produkId = await produkBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    await aksiTambahVarian(
      keadaanKosong(),
      formulir({ ...isianSatuBulan(produkId), aktif: undefined }),
    );

    expect(await daftarVarian(produkId)).toEqual([
      expect.objectContaining({ nama: "1 Bulan", aktif: false }),
    ]);
  });

  for (const produkId of [randomUUID(), "bukan-id"]) {
    it(`Produk "${produkId}" yang tidak ada menghasilkan halaman tidak ditemukan`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());

      await expect(
        aksiTambahVarian(keadaanKosong(), formulir(isianSatuBulan(produkId))),
      ).rejects.toSatisfy(tidakDitemukan);
    });
  }
});

/**
 * Produk baru dengan Varian "3 Bulan" seharga Rp 135.000 dari PRD §3.2, dibuat langsung lewat modul
 * server, dengan sesi Admin yang sudah dipasang.
 */
async function varianTigaBulan() {
  const produkId = await produkBaru();
  await tambahVarian({
    produkId,
    nama: "3 Bulan",
    hargaJual: 135_000,
    hargaNormal: null,
    aktif: true,
  });
  const [varian] = await daftarVarian(produkId);
  sebagaiPengunjung(await cookieAdminBaru());
  return { produkId, varian };
}

/** Isian form Ubah Varian untuk Varian yang sudah ada, tanpa perubahan. */
function isianUbah(
  produkId: string,
  varian: Awaited<ReturnType<typeof daftarVarian>>[number],
) {
  const isian: Record<string, string> = {
    produkId,
    id: varian.id,
    nama: varian.nama,
    hargaJual: String(varian.hargaJual),
    hargaNormal: varian.hargaNormal === null ? "" : String(varian.hargaNormal),
  };
  if (varian.aktif) isian.aktif = "on";
  return isian;
}

describe("mengubah Varian (PRD §3.2, §3.5, §3.7)", () => {
  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan Varian tidak berubah", async () => {
    const { produkId, varian } = await varianTigaBulan();
    sebagaiPengunjung(new Headers());

    await expect(
      aksiUbahVarian(
        keadaanKosong(),
        formulir({ ...isianUbah(produkId, varian), hargaJual: "100.000" }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await daftarVarian(produkId)).toEqual([varian]);
  });

  it("Admin mengubah nama, Harga jual, dan Harga normal", async () => {
    const { produkId, varian } = await varianTigaBulan();
    vi.mocked(refresh).mockClear();
    const isian = {
      ...isianUbah(produkId, varian),
      nama: "3 Bulan Hemat ",
      hargaJual: "499.000",
      hargaNormal: "600.000",
    };

    const keadaan = await aksiUbahVarian(keadaanKosong(), formulir(isian));

    expect(keadaan).toEqual({
      nama: "3 Bulan Hemat ",
      hargaJual: "499.000",
      hargaNormal: "600.000",
      aktif: true,
      tersimpan: true,
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(await daftarVarian(produkId)).toEqual([
      {
        id: varian.id,
        nama: "3 Bulan Hemat",
        hargaJual: 499_000,
        hargaNormal: 600_000,
        aktif: true,
      },
    ]);
  });

  it("Harga normal yang dikosongkan membuat Varian tanpa Harga normal", async () => {
    const { produkId, varian } = await varianTigaBulan();
    const isian = isianUbah(produkId, varian);
    await aksiUbahVarian(
      keadaanKosong(),
      formulir({ ...isian, hargaNormal: "150.000" }),
    );
    expect(await daftarVarian(produkId)).toEqual([
      { ...varian, hargaNormal: 150_000 },
    ]);

    await aksiUbahVarian(
      keadaanKosong(),
      formulir({ ...isian, hargaNormal: " " }),
    );

    expect(await daftarVarian(produkId)).toEqual([varian]);
  });

  it("Admin menonaktifkan Varian, lalu mengaktifkannya kembali", async () => {
    const { produkId, varian } = await varianTigaBulan();
    const tanpaAktif = { ...isianUbah(produkId, varian), aktif: undefined };

    await aksiUbahVarian(keadaanKosong(), formulir(tanpaAktif));
    expect(await daftarVarian(produkId)).toEqual([{ ...varian, aktif: false }]);

    await aksiUbahVarian(
      keadaanKosong(),
      formulir({ ...tanpaAktif, aktif: "on" }),
    );
    expect(await daftarVarian(produkId)).toEqual([varian]);
  });

  it("Harga normal Rp 135.000 untuk Harga jual Rp 135.000 ditolak dengan pesan, dan Varian tidak berubah (UAT-C4 langkah 2)", async () => {
    const { produkId, varian } = await varianTigaBulan();

    const keadaan = await aksiUbahVarian(
      keadaanKosong(),
      formulir({
        ...isianUbah(produkId, varian),
        hargaJual: "135.000",
        hargaNormal: "135.000",
      }),
    );

    expect(keadaan).toEqual({
      nama: "3 Bulan",
      hargaJual: "135.000",
      hargaNormal: "135.000",
      aktif: true,
      galat: {
        hargaNormal:
          "Harga normal tidak lebih besar dari Harga jual Rp 135.000. Isi Harga normal di atas Harga jual, atau kosongkan bila tidak ada harga pembanding.",
      },
    });
    expect(await daftarVarian(produkId)).toEqual([varian]);
  });

  it("Harga jual Rp 499.001 ditolak dengan pesan, dan Varian tidak berubah", async () => {
    const { produkId, varian } = await varianTigaBulan();

    const keadaan = await aksiUbahVarian(
      keadaanKosong(),
      formulir({ ...isianUbah(produkId, varian), hargaJual: "499.001" }),
    );

    expect(keadaan.galat).toEqual({
      hargaJual:
        "Harga jual lebih dari Rp 499.000, batas tagihan QRIS. Isi Harga jual paling banyak Rp 499.000.",
    });
    expect(await daftarVarian(produkId)).toEqual([varian]);
  });

  it("Varian milik Produk lain menghasilkan halaman tidak ditemukan, dan tidak berubah", async () => {
    const { produkId, varian } = await varianTigaBulan();
    const produkLain = await produkBaru();

    await expect(
      aksiUbahVarian(
        keadaanKosong(),
        formulir({
          ...isianUbah(produkId, varian),
          produkId: produkLain,
          nama: "1 Tahun",
        }),
      ),
    ).rejects.toSatisfy(tidakDitemukan);

    expect(await daftarVarian(produkId)).toEqual([varian]);
  });

  for (const id of [randomUUID(), "bukan-id"]) {
    it(`Varian "${id}" yang tidak ada menghasilkan halaman tidak ditemukan`, async () => {
      const { produkId, varian } = await varianTigaBulan();

      await expect(
        aksiUbahVarian(
          keadaanKosong(),
          formulir({ ...isianUbah(produkId, varian), id }),
        ),
      ).rejects.toSatisfy(tidakDitemukan);
    });
  }
});
