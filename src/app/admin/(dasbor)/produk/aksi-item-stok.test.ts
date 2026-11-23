import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { db, koneksi } from "@/server/db";
import { itemStok, varian as tabelVarian } from "@/server/db/schema";
import { bukaItemStok } from "@/server/enkripsi-item-stok";
import {
  bacaStokVarian,
  daftarItemStokVarian,
  daftarVarianItemStok,
} from "@/server/item-stok";
import { buatKategori, daftarKategori } from "@/server/kategori";
import { buatProduk, daftarProduk } from "@/server/produk";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import { isiItemStokUji, sisipkanProduk } from "@/server/uji-katalog";
import { sisipkanPesanan } from "@/server/uji-pesanan";
import { PNG } from "@/server/uji-unggahan";
import { daftarVarian, tambahVarian } from "@/server/varian";

import {
  aksiHapusItemStok,
  aksiHapusSemuaItemStokTersedia,
  aksiTambahItemStok,
  aksiTempelItemStok,
  aksiUbahItemStok,
} from "./aksi-item-stok";

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
 * Akhiran unik untuk isi Item stok. Item stok yang sama persis dengan Item stok lain di seluruh toko ditolak
 * (PRD §4.2 ▶ Keputusan 2026-11-22), padahal database test dipakai bersama oleh semua test. Jadi email di contoh
 * baris PRD dan UAT diberi akhiran ini, misalnya `budi-1a2b3c4d@mail.com`.
 */
const akhiranUnik = () => randomUUID().slice(0, 8);

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
    gratis: false,
    batasPerMember: null,
    formatItemStok,
  });
  const [produk] = (await daftarProduk()).filter((p) => p.nama === nama);
  await tambahVarian({
    produkId: produk.id,
    nama: "1 Bulan",
    hargaJual: 50_000,
    hargaNormal: 75_000,
    hargaModal: 35_000,
    aktif: true,
  });
  const [varian] = await daftarVarian(produk.id);
  return { produkId: produk.id, varianId: varian.id, namaProduk: nama };
}

/** Baris mentah tabel item_stok sebuah Varian, persis seperti yang tersimpan di database. */
async function barisMentah(varianId: string) {
  return koneksi<
    { isi_terenkripsi: string; sidik_jari: string; status: string }[]
  >`select isi_terenkripsi, sidik_jari, status from item_stok where varian_id = ${varianId}`;
}

const stok = async (varianId: string) =>
  (await bacaStokVarian(varianId)).stokVarian;

// Lima baris UAT-D1 (PRD §4.2), dengan akhiran unik di setiap email bila Item stok-nya disimpan.
const tempelanUatD1 = (akhiran: string) =>
  [
    `a-${akhiran}@mail.com|pass1|Profil 1`,
    `b-${akhiran}@mail.com|pass2|Profil 2`,
    `c-${akhiran}@mail.com|pass3`,
    `a-${akhiran}@mail.com|pass1|Profil 1`,
    `d-${akhiran}@mail.com|pass4|Profil 4`,
  ].join("\n");
const TEMPELAN_UAT_D1 = tempelanUatD1("uji");

/**
 * Pesan form bila Item stok kembar dengan Item stok di letak itu, misalnya "Netflix Premium – 3 Bulan
 * (Tersedia)" (PRD §4.2 ▶ Keputusan 2026-11-22).
 */
const pesanKembar = (letak: string) =>
  `Sudah ada di ${letak}. Item stok yang sama persis tidak boleh ada dua kali di toko, jadi tidak disimpan. Periksa lagi isinya, lalu simpan Item stok yang belum ada.`;

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
    const akhiran = akhiranUnik();

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: tempelanUatD1(akhiran) }),
    );

    expect(keadaan).toEqual({
      teks: "",
      hasil: {
        ringkasan: "3 tersimpan, 2 ditolak",
        ditolak: [
          {
            baris: 3,
            teks: `c-${akhiran}@mail.com|pass3`,
            keterangan:
              "Jumlah kolomnya salah: 2 kolom, padahal Format Item stok punya 3 kolom (Email, Password, Profil).",
          },
          {
            baris: 4,
            teks: `a-${akhiran}@mail.com|pass1|Profil 1`,
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
    const akhiran = akhiranUnik();

    await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: tempelanUatD1(akhiran) }),
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
      [`a-${akhiran}@mail.com`, "pass1", "Profil 1"],
      [`b-${akhiran}@mail.com`, "pass2", "Profil 2"],
      [`d-${akhiran}@mail.com`, "pass4", "Profil 4"],
    ]);
  });

  it("baris yang sama persis dengan Item stok yang sudah ada di Varian itu ditolak dengan menyebut letaknya, dan baris lain tetap disimpan", async () => {
    const { produkId, varianId, namaProduk } = await varianBaru(["Kode"]);
    sebagaiPengunjung(await cookieAdminBaru());
    const [kode1, kode2] = [
      `KODE-111-${akhiranUnik()}`,
      `KODE-222-${akhiranUnik()}`,
    ];
    await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: kode1 }),
    );

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: `${kode1}\n${kode2}` }),
    );

    expect(keadaan.hasil).toEqual({
      ringkasan: "1 tersimpan, 1 ditolak",
      ditolak: [
        {
          baris: 1,
          teks: kode1,
          keterangan: `Sudah ada di ${namaProduk} – 1 Bulan (Tersedia).`,
        },
      ],
    });
    expect(await stok(varianId)).toBe(2);
  });

  // UAT-D5 langkah 1 (PRD §4.2 ▶ Keputusan 2026-11-22): baris pertama sama persis dengan Item stok Tersedia
  // Netflix Premium 3 Bulan dari persiapan M6, yang ada di Produk lain.
  it("baris yang sama persis dengan Item stok Varian lain di Produk lain ditolak dengan menyebut letaknya, dan baris lain tetap tersimpan (UAT-D5)", async () => {
    const akhiran = akhiranUnik();
    const netflix = namaUnik("Netflix Premium");
    await sisipkanProduk({
      nama: netflix,
      formatItemStok: ["Email", "Password", "Profil"],
      varian: [{ nama: "3 Bulan", hargaJual: 135_000 }],
    });
    const [netflix3Bulan] = (await daftarVarianItemStok()).filter(
      (v) => v.namaProduk === netflix,
    );
    const kembar = `uji-kembar-${akhiran}@mail.com|pass9|Profil 1`;
    const youtube = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({
        produkId: netflix3Bulan.produkId,
        varianId: netflix3Bulan.varianId,
        teks: kembar,
      }),
    );

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({
        produkId: youtube.produkId,
        varianId: youtube.varianId,
        teks: `${kembar}\nuji-baru-${akhiran}@mail.com|pass9|Profil 1`,
      }),
    );

    expect(keadaan.hasil).toEqual({
      ringkasan: "1 tersimpan, 1 ditolak",
      ditolak: [
        {
          baris: 1,
          teks: kembar,
          keterangan: `Sudah ada di ${netflix} – 3 Bulan (Tersedia).`,
        },
      ],
    });
    expect(await stok(youtube.varianId)).toBe(1);
  });

  it("Item stok Terkirim dan Ditahan di Varian lain juga dihitung sudah ada", async () => {
    const akhiran = akhiranUnik();
    const lain = await varianTigaStatus();
    const { produkId, varianId } = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({
        produkId,
        varianId,
        teks: [lain.isi.siti, lain.isi.andi]
          .map((nilai) => nilai.join("|"))
          .concat(`baru-${akhiran}@mail.com|pass9|Profil 1`)
          .join("\n"),
      }),
    );

    expect(keadaan.hasil?.ringkasan).toBe("1 tersimpan, 2 ditolak");
    expect(keadaan.hasil?.ditolak.map((satu) => satu.keterangan)).toEqual([
      `Sudah ada di ${lain.namaProduk} – 1 Bulan (Ditahan).`,
      `Sudah ada di ${lain.namaProduk} – 1 Bulan (Terkirim).`,
    ]);
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

describe("menu Item stok (PRD §4.2 ▶ Keputusan 2026-11-20)", () => {
  it("Varian nonaktif tampil Nonaktif di daftar Varian, dan Item stok tetap bisa ditempel ke Varian itu", async () => {
    const produkId = await sisipkanProduk({
      nama: namaUnik("Uji Nonaktif"),
      formatItemStok: ["Kode"],
      varian: [{ nama: "Paket Lama", hargaJual: 20_000, aktif: false }],
    });
    const [{ id: varianId }] = await db
      .select({ id: tabelVarian.id })
      .from(tabelVarian)
      .where(eq(tabelVarian.produkId, produkId));
    const barisDaftar = async () =>
      (await daftarVarianItemStok()).find((v) => v.varianId === varianId);
    sebagaiPengunjung(await cookieAdminBaru());

    expect(await barisDaftar()).toMatchObject({
      varianAktif: false,
      stok: { jumlahPerStatus: { Tersedia: 0, Ditahan: 0, Terkirim: 0 } },
    });

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({
        produkId,
        varianId,
        teks: "KODE-NONAKTIF-1\nKODE-NONAKTIF-2",
      }),
    );

    expect(keadaan.hasil).toEqual({
      ringkasan: "2 tersimpan, 0 ditolak",
      ditolak: [],
    });
    expect(await barisDaftar()).toMatchObject({
      varianAktif: false,
      stok: { jumlahPerStatus: { Tersedia: 2, Ditahan: 0, Terkirim: 0 } },
    });
  });
});

describe("form satu Item stok (PRD §4.2)", () => {
  /** Contoh Item stok PRD §4.2, dengan akhiran unik di emailnya. */
  const budiUnik = () => [
    `budi-${akhiranUnik()}@mail.com`,
    "rahasia123",
    "Profil 2",
  ];

  it("Admin menyimpan satu Item stok berstatus Tersedia, dan spasi di awal dan akhir kolom dibuang", async () => {
    const { produkId, varianId } = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(refresh).mockClear();
    const budi = budiUnik();

    const keadaan = await aksiTambahItemStok(
      keadaanFormKosong(),
      formulir({
        produkId,
        varianId,
        nilai: [` ${budi[0]} `, "rahasia123", "Profil 2"],
      }),
    );

    expect(keadaan).toEqual({ nilai: ["", "", ""], tersimpan: true });
    expect(refresh).toHaveBeenCalledOnce();
    expect(await stok(varianId)).toBe(1);
    const [baris] = await barisMentah(varianId);
    expect(baris.status).toBe("Tersedia");
    expect(baris.isi_terenkripsi).not.toMatch(/budi|rahasia123|Profil 2/);
    expect(bukaItemStok(baris.isi_terenkripsi)).toEqual(budi);
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

  it("Item stok yang sama persis dengan Item stok yang sudah ada, termasuk dari tempelan, ditolak dengan pesan yang menyebut letaknya", async () => {
    const { produkId, varianId, namaProduk } = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    const budi = budiUnik();
    await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: budi.join("|") }),
    );

    const keadaan = await aksiTambahItemStok(
      keadaanFormKosong(),
      formulir({ produkId, varianId, nilai: budi }),
    );

    expect(keadaan).toEqual({
      nilai: budi,
      galat: { umum: pesanKembar(`${namaProduk} – 1 Bulan (Tersedia)`) },
    });
    expect(await stok(varianId)).toBe(1);
  });

  // PRD §4.2 ▶ Keputusan 2026-11-22: form satu Item stok menolak Item stok kembar dari Produk lain dengan pesan
  // yang sama seperti tempelan.
  it("Item stok kembar dengan Item stok Terkirim di Produk lain ditolak dengan pesan yang menyebut letaknya, dan tidak disimpan", async () => {
    const lain = await varianTigaStatus();
    const { produkId, varianId } = await varianBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiTambahItemStok(
      keadaanFormKosong(),
      formulir({ produkId, varianId, nilai: lain.isi.andi }),
    );

    expect(keadaan).toEqual({
      nilai: lain.isi.andi,
      galat: {
        umum: pesanKembar(`${lain.namaProduk} – 1 Bulan (Terkirim)`),
      },
    });
    expect(await barisMentah(varianId)).toEqual([]);
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

// Mengubah dan menghapus Item stok (PRD §4.4, issue T27, UAT-D3).

const FORMAT = ["Email", "Password", "Profil"];

/**
 * Varian "1 Bulan" baru milik Produk baru [CONTOH] dengan Format Item stok `Email`, `Password`, `Profil`,
 * dibuat langsung di database, berisi satu Item stok untuk setiap status: budi Tersedia, siti Ditahan oleh
 * Pesanan Menunggu Pembayaran, dan andi Terkirim ke Pesanan Selesai. Isinya contoh baris PRD §4.2 dengan
 * akhiran unik di emailnya. Nama Produknya bukan Netflix, supaya tidak mengubah hasil pencarian "netflix" di
 * test e2e yang memakai database yang sama. Hasilnya id Produk, nama Produk, id Varian, id Item stok per status
 * yang dibaca lewat daftar Item stok (PRD §9.7), isi setiap Item stok, dan daftar awalnya (isiDaftar).
 */
async function varianTigaStatus() {
  const akhiran = akhiranUnik();
  const isi = {
    budi: [`budi-${akhiran}@mail.com`, "rahasia123", "Profil 2"],
    siti: [`siti-${akhiran}@mail.com`, "rahasia456", "Profil 3"],
    andi: [`andi-${akhiran}@mail.com`, "rahasia789", "Profil 1"],
  };
  const namaProduk = `Ubah Item stok ${akhiran}`;
  const produkId = await sisipkanProduk({
    nama: namaProduk,
    formatItemStok: FORMAT,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: tabelVarian.id })
    .from(tabelVarian)
    .where(eq(tabelVarian.produkId, produkId));
  await db.insert(itemStok).values({ varianId, ...isiItemStokUji(isi.budi) });
  await sisipkanPesanan({
    varianId,
    status: "Menunggu Pembayaran",
    itemStok: { status: "Ditahan", nilai: isi.siti },
  });
  await sisipkanPesanan({
    varianId,
    status: "Selesai",
    itemStok: {
      status: "Terkirim",
      nilai: isi.andi,
      formatSaatTerkirim: FORMAT,
    },
  });

  const daftar = await daftarItemStokVarian({ varianId });
  const idBerstatus = (status: string) => {
    const [satu] = daftar.filter((item) => item.status === status);
    return satu.id;
  };
  return {
    produkId,
    namaProduk,
    varianId,
    tersedia: idBerstatus("Tersedia"),
    ditahan: idBerstatus("Ditahan"),
    terkirim: idBerstatus("Terkirim"),
    isi,
    daftarAwal: [
      { status: "Tersedia", nilai: isi.budi },
      { status: "Ditahan", nilai: isi.siti },
      { status: "Terkirim", nilai: isi.andi },
    ],
  };
}

/** Status dan isi setiap Item stok Varian itu menurut daftar Item stok, tanpa id. */
async function isiDaftar(varianId: string) {
  return (await daftarItemStokVarian({ varianId })).map(
    ({ status, kolom }) => ({ status, nilai: kolom.map((k) => k.nilai) }),
  );
}

const keadaanUbah = (nilai: string[]) => ({ nilai });
const keadaanHapus = () => ({});

describe("mengubah Item stok (PRD §4.4)", () => {
  it("Admin mengubah Item stok Tersedia, isi barunya tersimpan terenkripsi, dan statusnya tetap Tersedia (UAT-D3 langkah 1)", async () => {
    const { produkId, varianId, tersedia, isi } = await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(refresh).mockClear();
    const email = `budi.baru-${akhiranUnik()}@mail.com`;

    const keadaan = await aksiUbahItemStok(
      keadaanUbah(isi.budi),
      formulir({
        produkId,
        varianId,
        itemStokId: tersedia,
        nilai: [` ${email} `, "sandiBaru99", "Profil 5"],
      }),
    );

    // Spasi di awal dan akhir kolom dibuang, seperti saat Item stok diisi (PRD §4.2 ▶ Keputusan).
    const baru = [email, "sandiBaru99", "Profil 5"];
    expect(keadaan).toEqual({ nilai: baru, tersimpan: true });
    expect(refresh).toHaveBeenCalledOnce();
    expect(await isiDaftar(varianId)).toEqual([
      { status: "Tersedia", nilai: baru },
      { status: "Ditahan", nilai: isi.siti },
      { status: "Terkirim", nilai: isi.andi },
    ]);
    expect(await stok(varianId)).toBe(1);

    // Isinya tetap terenkripsi di database (PRD §12), dan bisa dibuka lagi dengan ITEM_STOK_KEY yang sama.
    const [baris] = (await barisMentah(varianId)).filter(
      (satu) => satu.status === "Tersedia",
    );
    for (const kolom of [baris.isi_terenkripsi, baris.sidik_jari]) {
      expect(kolom).not.toMatch(/budi|sandiBaru99|Profil 5/);
    }
    expect(bukaItemStok(baris.isi_terenkripsi)).toEqual(baru);
  });

  it("setelah diubah, isi lama boleh diisi lagi dan isi baru dikenali sebagai Item stok yang sudah ada (PRD §4.2)", async () => {
    const { produkId, namaProduk, varianId, tersedia, isi } =
      await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());
    const baru = `budi.baru-${akhiranUnik()}@mail.com|sandiBaru99|Profil 5`;
    await aksiUbahItemStok(
      keadaanUbah(isi.budi),
      formulir({
        produkId,
        varianId,
        itemStokId: tersedia,
        nilai: baru.split("|"),
      }),
    );

    const keadaan = await aksiTempelItemStok(
      keadaanTempelKosong(),
      formulir({ produkId, varianId, teks: `${isi.budi.join("|")}\n${baru}` }),
    );

    expect(keadaan.hasil).toEqual({
      ringkasan: "1 tersimpan, 1 ditolak",
      ditolak: [
        {
          baris: 2,
          teks: baru,
          keterangan: `Sudah ada di ${namaProduk} – 1 Bulan (Tersedia).`,
        },
      ],
    });
  });

  it("menyimpan isi yang sama dengan isinya sendiri tidak dianggap sama persis dengan Item stok lain", async () => {
    const { produkId, varianId, tersedia, isi, daftarAwal } =
      await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahItemStok(
      keadaanUbah(isi.budi),
      formulir({
        produkId,
        varianId,
        itemStokId: tersedia,
        nilai: [`${isi.budi[0]} `, isi.budi[1], isi.budi[2]],
      }),
    );

    expect(keadaan).toEqual({ nilai: isi.budi, tersimpan: true });
    expect(await isiDaftar(varianId)).toEqual(daftarAwal);
  });

  it("kolom kosong ditolak dengan pesan di setiap kolom itu, dan Item stok tidak berubah (aturan T10)", async () => {
    const { produkId, varianId, tersedia, isi, daftarAwal } =
      await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahItemStok(
      keadaanUbah(isi.budi),
      formulir({
        produkId,
        varianId,
        itemStokId: tersedia,
        nilai: [isi.budi[0], " ", ""],
      }),
    );

    expect(keadaan).toEqual({
      nilai: [isi.budi[0], " ", ""],
      galat: {
        kolom: [
          null,
          "Password belum diisi. Ketik Password untuk Item stok ini.",
          "Profil belum diisi. Ketik Profil untuk Item stok ini.",
        ],
      },
    });
    expect(await isiDaftar(varianId)).toEqual(daftarAwal);
  });

  it.each(["Ditahan", "Terkirim"] as const)(
    "isi yang sama persis dengan Item stok %s di Varian itu ditolak dengan pesan yang menyebut letaknya, dan Item stok tidak berubah",
    async (status) => {
      const { produkId, namaProduk, varianId, tersedia, isi, daftarAwal } =
        await varianTigaStatus();
      sebagaiPengunjung(await cookieAdminBaru());
      const nilai = status === "Ditahan" ? isi.siti : isi.andi;

      const keadaan = await aksiUbahItemStok(
        keadaanUbah(isi.budi),
        formulir({ produkId, varianId, itemStokId: tersedia, nilai }),
      );

      expect(keadaan).toEqual({
        nilai,
        galat: { umum: pesanKembar(`${namaProduk} – 1 Bulan (${status})`) },
      });
      expect(await isiDaftar(varianId)).toEqual(daftarAwal);
    },
  );

  // UAT-D5 langkah 3 (PRD §4.2 ▶ Keputusan 2026-11-22): ubah Item stok Tersedia menjadi isi Item stok Tersedia
  // Varian lain di Produk lain.
  it("isi yang sama persis dengan Item stok Varian lain di Produk lain ditolak dengan pesan yang menyebut letaknya, dan Item stok tidak berubah (UAT-D5)", async () => {
    const lain = await varianTigaStatus();
    const { produkId, varianId, tersedia, isi, daftarAwal } =
      await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahItemStok(
      keadaanUbah(isi.budi),
      formulir({
        produkId,
        varianId,
        itemStokId: tersedia,
        nilai: lain.isi.budi,
      }),
    );

    expect(keadaan).toEqual({
      nilai: lain.isi.budi,
      galat: {
        umum: pesanKembar(`${lain.namaProduk} – 1 Bulan (Tersedia)`),
      },
    });
    expect(await isiDaftar(varianId)).toEqual(daftarAwal);
  });

  it.each([
    [
      "ditahan",
      "Item stok ini tidak diubah, karena berstatus Ditahan: Item stok ini sedang disisihkan untuk Pesanan yang menunggu pembayaran. Hanya Item stok Tersedia yang bisa diubah atau dihapus. Muat ulang halaman untuk melihat status terbarunya.",
    ],
    [
      "terkirim",
      "Item stok ini tidak diubah, karena berstatus Terkirim: Item stok ini sudah dikirim ke sebuah Pesanan. Hanya Item stok Tersedia yang bisa diubah atau dihapus. Muat ulang halaman untuk melihat status terbarunya.",
    ],
  ] as const)(
    "server menolak mengubah Item stok %s, dan Item stok tidak berubah (UAT-D3 langkah 2)",
    async (status, pesan) => {
      const ids = await varianTigaStatus();
      sebagaiPengunjung(await cookieAdminBaru());
      const nilai = ["baru@mail.com", "sandiBaru99", "Profil 9"];

      const keadaan = await aksiUbahItemStok(
        keadaanUbah(nilai),
        formulir({
          produkId: ids.produkId,
          varianId: ids.varianId,
          itemStokId: ids[status],
          nilai,
        }),
      );

      expect(keadaan).toEqual({ nilai, galat: { umum: pesan } });
      expect(await isiDaftar(ids.varianId)).toEqual(ids.daftarAwal);
    },
  );

  it("Item stok milik Varian lain ditolak dengan pesan, dan Item stok itu tidak berubah", async () => {
    const satu = await varianTigaStatus();
    const lain = await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());
    const nilai = ["baru@mail.com", "sandiBaru99", "Profil 9"];

    const keadaan = await aksiUbahItemStok(
      keadaanUbah(nilai),
      formulir({
        produkId: satu.produkId,
        varianId: satu.varianId,
        itemStokId: lain.tersedia,
        nilai,
      }),
    );

    expect(keadaan).toEqual({
      nilai,
      galat: {
        umum: "Item stok ini tidak ada lagi di Varian ini, mungkin baru saja dihapus Admin lain. Muat ulang halaman untuk melihat daftar Item stok terbaru.",
      },
    });
    expect(await isiDaftar(lain.varianId)).toEqual(lain.daftarAwal);
  });

  it("id Item stok yang tidak sah menghasilkan halaman tidak ditemukan", async () => {
    const { produkId, varianId, isi } = await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiUbahItemStok(
        keadaanUbah(isi.budi),
        formulir({
          produkId,
          varianId,
          itemStokId: "bukan-id",
          nilai: isi.budi,
        }),
      ),
    ).rejects.toSatisfy(tidakDitemukan);
  });

  it("tanpa ITEM_STOK_KEY, Item stok tidak diubah dan pesannya menyebut variabel itu", async () => {
    const { produkId, varianId, tersedia, daftarAwal } =
      await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());
    vi.stubEnv("ITEM_STOK_KEY", undefined);
    const nilai = ["baru@mail.com", "sandiBaru99", "Profil 9"];

    const keadaan = await aksiUbahItemStok(
      keadaanUbah(nilai),
      formulir({ produkId, varianId, itemStokId: tersedia, nilai }),
    );

    expect(keadaan).toEqual({
      nilai,
      galat: {
        umum: "ITEM_STOK_KEY belum diisi, jadi Item stok tidak bisa disimpan terenkripsi dan tidak disimpan. Isi ITEM_STOK_KEY di berkas .env server seperti contoh di .env.example, lalu jalankan ulang aplikasinya.",
      },
    });
    vi.unstubAllEnvs();
    expect(await isiDaftar(varianId)).toEqual(daftarAwal);
  });
});

describe("menghapus Item stok (PRD §4.4)", () => {
  it("Admin menghapus Item stok Tersedia, dan Stok Varian berkurang satu", async () => {
    const { produkId, varianId, tersedia, isi } = await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(refresh).mockClear();
    expect(await stok(varianId)).toBe(1);

    const keadaan = await aksiHapusItemStok(
      keadaanHapus(),
      formulir({ produkId, varianId, itemStokId: tersedia }),
    );

    expect(keadaan).toEqual({});
    expect(refresh).toHaveBeenCalledOnce();
    expect(await isiDaftar(varianId)).toEqual([
      { status: "Ditahan", nilai: isi.siti },
      { status: "Terkirim", nilai: isi.andi },
    ]);
    expect(await stok(varianId)).toBe(0);
  });

  it.each([
    [
      "ditahan",
      "Item stok ini tidak dihapus, karena berstatus Ditahan: Item stok ini sedang disisihkan untuk Pesanan yang menunggu pembayaran. Hanya Item stok Tersedia yang bisa diubah atau dihapus. Muat ulang halaman untuk melihat status terbarunya.",
    ],
    [
      "terkirim",
      "Item stok ini tidak dihapus, karena berstatus Terkirim: Item stok ini sudah dikirim ke sebuah Pesanan. Hanya Item stok Tersedia yang bisa diubah atau dihapus. Muat ulang halaman untuk melihat status terbarunya.",
    ],
  ] as const)(
    "server menolak menghapus Item stok %s, dan Item stok tetap ada (UAT-D3 langkah 3)",
    async (status, pesan) => {
      const ids = await varianTigaStatus();
      sebagaiPengunjung(await cookieAdminBaru());

      const keadaan = await aksiHapusItemStok(
        keadaanHapus(),
        formulir({
          produkId: ids.produkId,
          varianId: ids.varianId,
          itemStokId: ids[status],
        }),
      );

      expect(keadaan).toEqual({ galat: pesan });
      expect(await isiDaftar(ids.varianId)).toEqual(ids.daftarAwal);
    },
  );

  it("Item stok milik Produk lain ditolak dengan pesan, dan Item stok itu tetap ada", async () => {
    const satu = await varianTigaStatus();
    const lain = await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiHapusItemStok(
      keadaanHapus(),
      formulir({
        produkId: satu.produkId,
        varianId: lain.varianId,
        itemStokId: lain.tersedia,
      }),
    );

    expect(keadaan).toEqual({
      galat:
        "Item stok ini tidak ada lagi di Varian ini, mungkin baru saja dihapus Admin lain. Muat ulang halaman untuk melihat daftar Item stok terbaru.",
    });
    expect(await isiDaftar(lain.varianId)).toEqual(lain.daftarAwal);
  });

  it("id Item stok yang tidak sah menghasilkan halaman tidak ditemukan", async () => {
    const { produkId, varianId } = await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiHapusItemStok(
        keadaanHapus(),
        formulir({ produkId, varianId, itemStokId: "bukan-id" }),
      ),
    ).rejects.toSatisfy(tidakDitemukan);
  });
});

// PRD §4.4 ▶ Keputusan 2026-11-22 dan UAT-D6.
describe("hapus semua Item stok Tersedia (PRD §4.4)", () => {
  /** varianTigaStatus dengan dua Item stok Tersedia tambahan, jadi Varian itu punya 3 Tersedia. */
  async function varianTigaTersedia() {
    const ids = await varianTigaStatus();
    for (const nama of ["dewi", "eka"]) {
      await db.insert(itemStok).values({
        varianId: ids.varianId,
        ...isiItemStokUji([
          `${nama}-${akhiranUnik()}@mail.com`,
          "pass",
          "Profil 4",
        ]),
      });
    }
    return ids;
  }

  const hapusSemua = (ids: { produkId: string; varianId: string }) =>
    aksiHapusSemuaItemStokTersedia(
      keadaanHapus(),
      formulir({ produkId: ids.produkId, varianId: ids.varianId }),
    );

  it("menghapus semua Item stok Tersedia Varian itu, tanpa menyentuh Item stok Ditahan dan Terkirim maupun Varian lain, lalu menyebut jumlahnya", async () => {
    const ids = await varianTigaTersedia();
    const lain = await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(refresh).mockClear();
    expect(await stok(ids.varianId)).toBe(3);

    const keadaan = await hapusSemua(ids);

    expect(keadaan).toEqual({ pesan: "3 Item stok terhapus." });
    expect(refresh).toHaveBeenCalledOnce();
    expect(await isiDaftar(ids.varianId)).toEqual([
      { status: "Ditahan", nilai: ids.isi.siti },
      { status: "Terkirim", nilai: ids.isi.andi },
    ]);
    expect(await stok(ids.varianId)).toBe(0);
    expect(await isiDaftar(lain.varianId)).toEqual(lain.daftarAwal);
  });

  it("Item stok yang menjadi Ditahan setelah modal terbuka, sebelum penegasan disetujui, dilewati (UAT-D6)", async () => {
    const ids = await varianTigaTersedia();
    sebagaiPengunjung(await cookieAdminBaru());
    // Modal dibuka dengan 3 Item stok Tersedia, lalu checkout menahan Item stok budi sebelum Admin menyetujuinya.
    const { id: pesananId } = await sisipkanPesanan({
      varianId: ids.varianId,
      status: "Menunggu Pembayaran",
    });
    await db
      .update(itemStok)
      .set({ status: "Ditahan", pesananId })
      .where(eq(itemStok.id, ids.tersedia));

    const keadaan = await hapusSemua(ids);

    expect(keadaan).toEqual({ pesan: "2 Item stok terhapus." });
    expect(await isiDaftar(ids.varianId)).toEqual([
      { status: "Ditahan", nilai: ids.isi.budi },
      { status: "Ditahan", nilai: ids.isi.siti },
      { status: "Terkirim", nilai: ids.isi.andi },
    ]);
  });

  it("Varian milik Produk lain menghasilkan halaman tidak ditemukan, dan tidak ada Item stok yang terhapus", async () => {
    const ids = await varianTigaStatus();
    const lain = await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      hapusSemua({ produkId: lain.produkId, varianId: ids.varianId }),
    ).rejects.toSatisfy(tidakDitemukan);
    expect(await isiDaftar(ids.varianId)).toEqual(ids.daftarAwal);
  });

  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan tidak ada Item stok yang terhapus", async () => {
    const ids = await varianTigaStatus();
    sebagaiPengunjung(new Headers());

    await expect(hapusSemua(ids)).rejects.toSatisfy(arahKe("/admin"));
    expect(await isiDaftar(ids.varianId)).toEqual(ids.daftarAwal);
  });
});

// Penahanan (PRD §5.3) mengunci Item stok Tersedia dengan FOR UPDATE SKIP LOCKED, lalu menjadikannya Ditahan
// dalam transaksi checkout yang sama. Transaksi di bawah meniru checkout itu, supaya bisa ditahan di tengah
// jalan.
describe("mengubah dan menghapus bersamaan dengan checkout", () => {
  /**
   * Menjalankan aksi selagi checkout lain sedang mengunci Item stok itu, lalu menyelesaikan checkout itu,
   * yang menjadikan Item stok itu Ditahan. Hasilnya keadaan yang dikembalikan aksi.
   */
  async function selagiCheckoutMenahan<K>(
    { varianId, tersedia }: { varianId: string; tersedia: string },
    aksi: () => Promise<K>,
  ) {
    const menahan = await sisipkanPesanan({
      varianId,
      status: "Menunggu Pembayaran",
    });
    let lanjutkan = () => {};
    const tertahan = new Promise<void>((selesai) => (lanjutkan = selesai));
    let terkunci = () => {};
    const sudahTerkunci = new Promise<void>((selesai) => (terkunci = selesai));

    const checkout = db.transaction(async (tx) => {
      await tx
        .select({ id: itemStok.id })
        .from(itemStok)
        .where(eq(itemStok.id, tersedia))
        .for("update", { skipLocked: true });
      terkunci();
      await tertahan;
      await tx
        .update(itemStok)
        .set({ status: "Ditahan", pesananId: menahan.id })
        .where(eq(itemStok.id, tersedia));
    });
    await sudahTerkunci;

    let aksiSelesai = false;
    const hasilAksi = aksi().finally(() => (aksiSelesai = true));
    // Aksi menunggu checkout selesai, bukan berjalan lebih dulu dengan status lama.
    await new Promise((selesai) => setTimeout(selesai, 300));
    expect(aksiSelesai).toBe(false);

    lanjutkan();
    await checkout;
    return hasilAksi;
  }

  it("menghapus Item stok yang sedang ditahan checkout lain menunggu checkout itu selesai, lalu ditolak karena Ditahan", async () => {
    const ids = await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await selagiCheckoutMenahan(ids, () =>
      aksiHapusItemStok(
        keadaanHapus(),
        formulir({
          produkId: ids.produkId,
          varianId: ids.varianId,
          itemStokId: ids.tersedia,
        }),
      ),
    );

    expect(keadaan.galat).toMatch(
      /^Item stok ini tidak dihapus, karena berstatus Ditahan/,
    );
    expect(await isiDaftar(ids.varianId)).toEqual([
      { status: "Ditahan", nilai: ids.isi.budi },
      { status: "Ditahan", nilai: ids.isi.siti },
      { status: "Terkirim", nilai: ids.isi.andi },
    ]);
  });

  it("hapus semua Item stok Tersedia menunggu checkout yang sedang menahan salah satunya, lalu melewati Item stok itu", async () => {
    const ids = await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await selagiCheckoutMenahan(ids, () =>
      aksiHapusSemuaItemStokTersedia(
        keadaanHapus(),
        formulir({ produkId: ids.produkId, varianId: ids.varianId }),
      ),
    );

    expect(keadaan).toEqual({ pesan: "0 Item stok terhapus." });
    expect(await isiDaftar(ids.varianId)).toEqual([
      { status: "Ditahan", nilai: ids.isi.budi },
      { status: "Ditahan", nilai: ids.isi.siti },
      { status: "Terkirim", nilai: ids.isi.andi },
    ]);
  });

  it("mengubah Item stok yang sedang ditahan checkout lain menunggu checkout itu selesai, lalu ditolak karena Ditahan", async () => {
    const ids = await varianTigaStatus();
    sebagaiPengunjung(await cookieAdminBaru());
    const nilai = ["baru@mail.com", "sandiBaru99", "Profil 9"];

    const keadaan = await selagiCheckoutMenahan(ids, () =>
      aksiUbahItemStok(
        keadaanUbah(nilai),
        formulir({
          produkId: ids.produkId,
          varianId: ids.varianId,
          itemStokId: ids.tersedia,
          nilai,
        }),
      ),
    );

    expect(keadaan.galat?.umum).toMatch(
      /^Item stok ini tidak diubah, karena berstatus Ditahan/,
    );
    expect(await isiDaftar(ids.varianId)).toEqual([
      { status: "Ditahan", nilai: ids.isi.budi },
      { status: "Ditahan", nilai: ids.isi.siti },
      { status: "Terkirim", nilai: ids.isi.andi },
    ]);
  });
});

// Issue T27: Tamu tidak bisa mengubah Item stok.
describe("kewenangan mengubah dan menghapus (PRD §2.1)", () => {
  it("Tamu tanpa sesi Admin yang mengubah Item stok diarahkan ke halaman login, dan Item stok tidak berubah", async () => {
    const { produkId, varianId, tersedia, isi, daftarAwal } =
      await varianTigaStatus();
    sebagaiPengunjung(new Headers());

    await expect(
      aksiUbahItemStok(
        keadaanUbah(isi.budi),
        formulir({
          produkId,
          varianId,
          itemStokId: tersedia,
          nilai: ["tamu@mail.com", "sandiTamu", "Profil 9"],
        }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await isiDaftar(varianId)).toEqual(daftarAwal);
  });

  it("Tamu tanpa sesi Admin yang menghapus Item stok diarahkan ke halaman login, dan Item stok tetap ada", async () => {
    const { produkId, varianId, tersedia, daftarAwal } =
      await varianTigaStatus();
    sebagaiPengunjung(new Headers());

    await expect(
      aksiHapusItemStok(
        keadaanHapus(),
        formulir({ produkId, varianId, itemStokId: tersedia }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await isiDaftar(varianId)).toEqual(daftarAwal);
  });
});
