import { randomUUID } from "node:crypto";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { koneksi } from "@/server/db";
import { bukaItemStok } from "@/server/enkripsi-item-stok";
import { bacaStokVarian } from "@/server/item-stok";
import { buatKategori, daftarKategori } from "@/server/kategori";
import { buatProduk, daftarProduk } from "@/server/produk";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import { PNG } from "@/server/uji-unggahan";
import { daftarVarian, tambahVarian } from "@/server/varian";

import { aksiTambahItemStok, aksiTempelItemStok } from "./aksi-item-stok";

// Test integrasi Server Action dengan database app_test dari .env.ci, termasuk ITEM_STOK_KEY khusus
// test. Header permintaan yang dibaca aksi lewat next/headers diganti dengan cookie milik pengunjung
// di setiap test. refresh() dari next/cache hanya bisa berjalan di dalam Server Action yang dijalankan
// Next.js, jadi diganti tiruan.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

function sebagaiPengunjung(kepala: Headers) {
  vi.mocked(headers).mockResolvedValue(kepala);
}

/** FormData seperti yang dikirim form Item stok: isian bernama sama dikirim berurutan. */
function formulir(isian: Record<string, string | string[]>) {
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

/**
 * Varian "1 Bulan" baru tanpa Item stok, milik Produk Netflix Premium baru dengan Format Item stok
 * `Email`, `Password`, `Profil` (UAT-D1), dibuat langsung lewat modul server.
 */
async function varianBaru(formatItemStok = ["Email", "Password", "Profil"]) {
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
    formatItemStok,
  });
  const [produk] = (await daftarProduk()).filter((p) => p.nama === nama);
  await tambahVarian({
    produkId: produk.id,
    nama: "1 Bulan",
    hargaJual: 50_000,
    hargaNormal: 75_000,
    aktif: true,
  });
  const [varian] = await daftarVarian(produk.id);
  return { produkId: produk.id, varianId: varian.id };
}

/** Baris mentah tabel item_stok sebuah Varian, persis seperti yang tersimpan di database. */
async function barisMentah(varianId: string) {
  return koneksi<
    { isi_terenkripsi: string; sidik_jari: string; status: string }[]
  >`select isi_terenkripsi, sidik_jari, status from item_stok where varian_id = ${varianId}`;
}

const stok = async (varianId: string) =>
  (await bacaStokVarian(varianId)).stokVarian;

// Lima baris UAT-D1 (PRD §4.2).
const TEMPELAN_UAT_D1 = [
  "a@mail.com|pass1|Profil 1",
  "b@mail.com|pass2|Profil 2",
  "c@mail.com|pass3",
  "a@mail.com|pass1|Profil 1",
  "d@mail.com|pass4|Profil 4",
].join("\n");

const keadaanTempelKosong = () => ({ teks: "" });
const keadaanFormKosong = () => ({ nilai: ["", "", ""] });

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await koneksi.end();
});

describe("menempel banyak Item stok (PRD §4.2, UAT-D1)", () => {
  it("lima baris UAT-D1 menghasilkan 3 tersimpan, 2 ditolak, dan Stok Varian bertambah 3", async () => {
    const { produkId, varianId } = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(refresh).mockClear();
    expect(await stok(varianId)).toBe(0);

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: TEMPELAN_UAT_D1 }),
    );

    expect(keadaan).toEqual({
      teks: "",
      hasil: {
        ringkasan: "3 tersimpan, 2 ditolak",
        ditolak: [
          {
            baris: 3,
            teks: "c@mail.com|pass3",
            keterangan:
              "Jumlah kolomnya salah: 2 kolom, padahal Format Item stok punya 3 kolom (Email, Password, Profil).",
          },
          {
            baris: 4,
            teks: "a@mail.com|pass1|Profil 1",
            keterangan: "Kembar dengan baris 1 di tempelan ini.",
          },
        ],
      },
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(await stok(varianId)).toBe(3);
  });

  it("Item stok baru berstatus Tersedia, dan isinya tidak tersimpan sebagai teks asli (PRD §12)", async () => {
    const { produkId, varianId } = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: TEMPELAN_UAT_D1 }),
    );

    const semua = await barisMentah(varianId);
    expect(semua).toHaveLength(3);
    for (const baris of semua) {
      expect(baris.status).toBe("Tersedia");
      for (const kolom of [baris.isi_terenkripsi, baris.sidik_jari]) {
        expect(kolom).not.toMatch(/@mail\.com|pass\d|Profil/);
      }
    }
    // Isi yang terenkripsi bisa dibuka lagi dengan ITEM_STOK_KEY yang sama.
    expect(
      semua.map((baris) => bukaItemStok(baris.isi_terenkripsi)).sort(),
    ).toEqual([
      ["a@mail.com", "pass1", "Profil 1"],
      ["b@mail.com", "pass2", "Profil 2"],
      ["d@mail.com", "pass4", "Profil 4"],
    ]);
  });

  it("baris yang sama persis dengan Item stok yang sudah ada di Varian itu ditolak, dan baris lain tetap disimpan", async () => {
    const { produkId, varianId } = await varianBaru(["Kode"]);
    sebagaiPengunjung(await cookieAdminBaru());
    await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: "KODE-111" }),
    );

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: "KODE-111\nKODE-222" }),
    );

    expect(keadaan.hasil).toEqual({
      ringkasan: "1 tersimpan, 1 ditolak",
      ditolak: [
        {
          baris: 1,
          teks: "KODE-111",
          keterangan:
            "Sama persis dengan Item stok yang sudah ada di Varian ini.",
        },
      ],
    });
    expect(await stok(varianId)).toBe(2);
  });

  it("Item stok yang sama di Varian lain tidak dihitung sudah ada", async () => {
    const satu = await varianBaru(["Kode"]);
    const dua = await varianBaru(["Kode"]);
    sebagaiPengunjung(await cookieAdminBaru());
    await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ ...satu, teks: "KODE-111" }),
    );

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ ...dua, teks: "KODE-111" }),
    );

    expect(keadaan.hasil?.ringkasan).toBe("1 tersimpan, 0 ditolak");
  });

  it("menyebut nama kolom yang kosong", async () => {
    const { produkId, varianId } = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: "\n|rahasia123|" }),
    );

    expect(keadaan.hasil).toEqual({
      ringkasan: "0 tersimpan, 1 ditolak",
      ditolak: [
        {
          baris: 2,
          teks: "|rahasia123|",
          keterangan: "Kolom Email dan Profil kosong.",
        },
      ],
    });
  });

  it("tempelan tanpa baris berisi ditolak dengan pesan", async () => {
    const { produkId, varianId } = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: " \n\n " }),
    );

    expect(keadaan).toEqual({
      teks: " \n\n ",
      galat:
        "Belum ada baris yang ditempel. Tempel satu baris untuk setiap Item stok, dengan kolom dipisah |.",
    });
  });

  it("Varian milik Produk lain menghasilkan halaman tidak ditemukan, dan tidak ada Item stok tersimpan", async () => {
    const { varianId } = await varianBaru();
    const lain = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiTempelItemStok(
        keadaanTempelKosong(),
        formulir({
          produkId: lain.produkId,
          varianId,
          teks: TEMPELAN_UAT_D1,
        }),
      ),
    ).rejects.toSatisfy(tidakDitemukan);
    expect(await stok(varianId)).toBe(0);
  });

  for (const varianId of [randomUUID(), "bukan-id"]) {
    it(`Varian "${varianId}" yang tidak ada menghasilkan halaman tidak ditemukan`, async () => {
      const { produkId } = await varianBaru();
      sebagaiPengunjung(await cookieAdminBaru());

      await expect(
        aksiTempelItemStok(
          keadaanTempelKosong(),
          formulir({ produkId, varianId, teks: TEMPELAN_UAT_D1 }),
        ),
      ).rejects.toSatisfy(tidakDitemukan);
    });
  }
});

describe("form satu Item stok (PRD §4.2)", () => {
  const isian = (ids: { produkId: string; varianId: string }) => ({
    ...ids,
    nilai: ["budi@mail.com", "rahasia123", "Profil 2"],
  });

  it("Admin menyimpan satu Item stok berstatus Tersedia, dan spasi di awal dan akhir kolom dibuang", async () => {
    const ids = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(refresh).mockClear();

    const keadaan = await aksiTambahItemStok(
      keadaanFormKosong(),
      formulir({
        ...ids,
        nilai: [" budi@mail.com ", "rahasia123", "Profil 2"],
      }),
    );

    expect(keadaan).toEqual({ nilai: ["", "", ""], tersimpan: true });
    expect(refresh).toHaveBeenCalledOnce();
    expect(await stok(ids.varianId)).toBe(1);
    const [baris] = await barisMentah(ids.varianId);
    expect(baris.status).toBe("Tersedia");
    expect(baris.isi_terenkripsi).not.toMatch(/budi|rahasia123|Profil 2/);
    expect(bukaItemStok(baris.isi_terenkripsi)).toEqual([
      "budi@mail.com",
      "rahasia123",
      "Profil 2",
    ]);
  });

  it("kolom kosong ditolak dengan pesan di setiap kolom itu, dan Item stok tidak disimpan", async () => {
    const ids = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiTambahItemStok(
      keadaanFormKosong(),
      formulir({ ...ids, nilai: ["budi@mail.com", " ", ""] }),
    );

    expect(keadaan).toEqual({
      nilai: ["budi@mail.com", " ", ""],
      galat: {
        kolom: [
          null,
          "Password belum diisi. Ketik Password untuk Item stok ini.",
          "Profil belum diisi. Ketik Profil untuk Item stok ini.",
        ],
      },
    });
    expect(await stok(ids.varianId)).toBe(0);
  });

  it("Item stok yang sama persis dengan Item stok yang sudah ada, termasuk dari tempelan, ditolak dengan pesan", async () => {
    const ids = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ ...ids, teks: "budi@mail.com|rahasia123|Profil 2" }),
    );

    const keadaan = await aksiTambahItemStok(
      keadaanFormKosong(),
      formulir(isian(ids)),
    );

    expect(keadaan).toEqual({
      nilai: ["budi@mail.com", "rahasia123", "Profil 2"],
      galat: {
        umum: "Item stok ini sama persis dengan Item stok yang sudah ada di Varian ini, jadi tidak disimpan. Periksa lagi isinya, lalu simpan Item stok yang belum ada.",
      },
    });
    expect(await stok(ids.varianId)).toBe(1);
  });

  it("isian yang jumlah kolomnya tidak sama dengan Format Item stok ditolak dengan pesan", async () => {
    const ids = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiTambahItemStok(
      keadaanFormKosong(),
      formulir({ ...ids, nilai: ["budi@mail.com", "rahasia123"] }),
    );

    expect(keadaan.galat).toEqual({
      umum: "Format Item stok Produk ini berubah sejak halaman dibuka. Muat ulang halaman, lalu isi Item stok lagi.",
    });
    expect(await stok(ids.varianId)).toBe(0);
  });
});

describe("kewenangan (PRD §2.1)", () => {
  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan tempelan tidak disimpan", async () => {
    const { produkId, varianId } = await varianBaru();
    sebagaiPengunjung(new Headers());

    await expect(
      aksiTempelItemStok(
        keadaanTempelKosong(),
        formulir({ produkId, varianId, teks: TEMPELAN_UAT_D1 }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await barisMentah(varianId)).toEqual([]);
  });

  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan Item stok dari form tidak disimpan", async () => {
    const { produkId, varianId } = await varianBaru();
    sebagaiPengunjung(new Headers());

    await expect(
      aksiTambahItemStok(
        keadaanFormKosong(),
        formulir({
          produkId,
          varianId,
          nilai: ["budi@mail.com", "rahasia123", "Profil 2"],
        }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await barisMentah(varianId)).toEqual([]);
  });
});

describe("kunci enkripsi ITEM_STOK_KEY (PRD §12)", () => {
  const PESAN_BELUM_DIISI =
    "ITEM_STOK_KEY belum diisi, jadi Item stok tidak bisa disimpan terenkripsi dan tidak disimpan. Isi ITEM_STOK_KEY di berkas .env server seperti contoh di .env.example, lalu jalankan ulang aplikasinya.";

  for (const nilai of [undefined, ""]) {
    it(`tanpa ITEM_STOK_KEY (${JSON.stringify(nilai)}), tempelan tidak disimpan dan pesannya menyebut variabel itu`, async () => {
      const { produkId, varianId } = await varianBaru();
      sebagaiPengunjung(await cookieAdminBaru());
      vi.stubEnv("ITEM_STOK_KEY", nilai);

      const keadaan = await aksiTempelItemStok(
        keadaanTempelKosong(),
        formulir({ produkId, varianId, teks: TEMPELAN_UAT_D1 }),
      );

      expect(keadaan).toEqual({
        teks: TEMPELAN_UAT_D1,
        galat: PESAN_BELUM_DIISI,
      });
      expect(await barisMentah(varianId)).toEqual([]);
    });
  }

  it("tanpa ITEM_STOK_KEY, Item stok dari form tidak disimpan dan pesannya menyebut variabel itu", async () => {
    const { produkId, varianId } = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    vi.stubEnv("ITEM_STOK_KEY", undefined);
    const nilai = ["budi@mail.com", "rahasia123", "Profil 2"];

    const keadaan = await aksiTambahItemStok(
      keadaanFormKosong(),
      formulir({ produkId, varianId, nilai }),
    );

    expect(keadaan).toEqual({ nilai, galat: { umum: PESAN_BELUM_DIISI } });
    expect(await barisMentah(varianId)).toEqual([]);
  });

  it("ITEM_STOK_KEY yang bukan 32 byte dalam base64 ditolak dengan pesan, dan Item stok tidak disimpan", async () => {
    const { produkId, varianId } = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    vi.stubEnv("ITEM_STOK_KEY", "rahasia-pendek");

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: TEMPELAN_UAT_D1 }),
    );

    expect(keadaan.galat).toBe(
      "ITEM_STOK_KEY tidak berisi 32 byte acak dalam base64, jadi Item stok tidak disimpan. Isi ITEM_STOK_KEY di berkas .env server dengan hasil `openssl rand -base64 32`, lalu jalankan ulang aplikasinya.",
    );
    expect(await barisMentah(varianId)).toEqual([]);
  });
});
