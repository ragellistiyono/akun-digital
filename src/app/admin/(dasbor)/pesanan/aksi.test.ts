import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { daftarPesanan } from "@/server/daftar-pesanan";
import { db, koneksi } from "@/server/db";
import { varian } from "@/server/db/schema";
import { kirimEmailPesananSelesai } from "@/server/email-pesanan-selesai";
import { emailTiruanKe } from "@/server/email-tiruan";
import {
  kerjakanEmailPesananSelesai,
  pekerjaanEmailPesananSelesai,
} from "@/server/pekerjaan-latar";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import { sisipkanProduk } from "@/server/uji-katalog";
import { sisipkanPesanan } from "@/server/uji-pesanan";

import { aksiKirimUlangEmail, aksiKoreksiEmail } from "./aksi";

// Test integrasi Server Action dengan database app_test, dan email tiruan dari .env.ci (EMAIL_MODE=tiruan).
// Header permintaan yang dibaca aksi lewat next/headers diganti dengan cookie milik pengunjung di setiap
// test. refresh() dari next/cache hanya bisa berjalan di dalam Server Action yang dijalankan Next.js, jadi
// diganti tiruan. Pekerja pg-boss tidak berjalan di proses test, jadi test menjalankan sendiri pekerjaan
// email yang dijadwalkan aksi.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

function sebagaiPengunjung(kepala: Headers) {
  vi.mocked(headers).mockResolvedValue(kepala);
}

function formulir(isian: Record<string, string>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) data.set(nama, nilai);
  return data;
}

/**
 * Format dan isi Item stok seperti di prototipe (docs/design/prototipe) [CONTOH]. Kolom Email-nya diberi
 * akhiran unik, karena Item stok yang sama persis ditolak di Varian yang sama (PRD §4.2).
 */
const FORMAT = ["Email", "Password", "Profil"];
const isiItemStokUnik = () => [
  `miwe.akun-${randomUUID().slice(0, 8)}@contoh.id`,
  "Senja-7419",
  "Profil 3",
];

let varianId = "";

beforeAll(async () => {
  // Produk [CONTOH] dengan akhiran unik, karena database test dipakai bersama oleh semua test.
  const produkId = await sisipkanProduk({
    nama: `Kirim Ulang ${randomUUID().slice(0, 8)}`,
    formatItemStok: FORMAT,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
});

afterAll(async () => {
  await koneksi.end();
});

const emailUnik = () => `budi-${randomUUID()}@example.test`;

/** Pesanan Selesai dengan Item stok Terkirim, berincian contoh PRD §5.5. */
function pesananSelesai(email = emailUnik()) {
  return sisipkanPesanan({
    varianId,
    status: "Selesai",
    email,
    itemStok: {
      status: "Terkirim",
      nilai: isiItemStokUnik(),
      formatSaatTerkirim: FORMAT,
    },
  });
}

/** Menjalankan setiap pekerjaan email "Pesanan selesai" yang dijadwalkan untuk Pesanan itu, satu kali. */
async function jalankanPekerjaanEmail(pesananId: string) {
  for (const pekerjaan of await pekerjaanEmailPesananSelesai(pesananId)) {
    expect(await kerjakanEmailPesananSelesai(pekerjaan)).toMatchObject({
      status: "completed",
    });
  }
}

describe('kirim ulang email "Pesanan selesai" (PRD §6.4)', () => {
  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan tidak ada email yang dijadwalkan", async () => {
    const dipesan = await pesananSelesai();
    sebagaiPengunjung(new Headers());

    await expect(
      aksiKirimUlangEmail({}, formulir({ pesananId: dipesan.id })),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);
  });

  // UAT-F2 langkah 1: Email A menerima salinan kedua.
  it("Admin mengirim ulang email: tepat satu email lagi terkirim ke email Pesanan, berisi Pesanan yang sama", async () => {
    const email = emailUnik();
    const dipesan = await pesananSelesai(email);
    // Email pertama, yang dikirim saat Pesanan menjadi Selesai (T23).
    await kirimEmailPesananSelesai(dipesan.id);
    expect(emailTiruanKe(email)).toHaveLength(1);
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiKirimUlangEmail(
      {},
      formulir({ pesananId: dipesan.id }),
    );
    await jalankanPekerjaanEmail(dipesan.id);

    expect(keadaan.galat).toBeUndefined();
    expect(keadaan.pesan).toContain(email);
    const terkirim = emailTiruanKe(email);
    expect(terkirim).toHaveLength(2);
    expect(terkirim[1].subjek).toBe(`Pesanan selesai: ${dipesan.nomorPesanan}`);
    expect(terkirim[1].teks).toBe(terkirim[0].teks);
    expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toHaveLength(1);
  });

  // Issue T25: kirim ulang tidak tersedia untuk Pesanan selain Selesai.
  for (const status of [
    "Menunggu Pembayaran",
    "Kedaluwarsa",
    "Dibatalkan",
    "Bermasalah",
    "Dana Dikembalikan",
  ] as const) {
    it(`kirim ulang untuk Pesanan ${status} ditolak dengan pesan yang menyebut sebabnya, dan tidak ada email yang dijadwalkan`, async () => {
      const dipesan = await sisipkanPesanan({ varianId, status });
      sebagaiPengunjung(await cookieAdminBaru());

      const keadaan = await aksiKirimUlangEmail(
        {},
        formulir({ pesananId: dipesan.id }),
      );

      expect(keadaan).toEqual({
        galat: `Email "Pesanan selesai" tidak dikirim ulang, karena Pesanan ini berstatus ${status}, padahal kirim ulang hanya tersedia untuk Pesanan Selesai. Muat ulang halaman untuk melihat status terbarunya.`,
      });
      expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);
    });
  }

  it("Pesanan yang tidak ada menampilkan halaman tidak ditemukan", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiKirimUlangEmail({}, formulir({ pesananId: randomUUID() })),
    ).rejects.toSatisfy(tidakDitemukan);
  });
});

/** Email Pesanan itu menurut daftar Pesanan di dasbor admin, yang dicari lewat Nomor Pesanan-nya. */
async function emailDiDaftar(nomorPesanan: string) {
  const { pesanan } = await daftarPesanan({ cari: nomorPesanan });
  return pesanan.map(({ email }) => email);
}

/** Nomor Pesanan yang ditemukan daftar Pesanan dengan pencarian itu. */
async function nomorDitemukan(cari: string) {
  const { pesanan } = await daftarPesanan({ cari });
  return pesanan.map(({ nomorPesanan }) => nomorPesanan);
}

describe("koreksi email Pesanan (PRD §6.4, ADR-0003)", () => {
  // UAT-F2 langkah 2: Email B menerima email Pesanan itu.
  it("Admin mengganti email Pesanan lalu mengirim ulang: email terkirim ke alamat baru, dan Pesanan itu pindah ke email baru", async () => {
    const emailLama = emailUnik();
    const emailBaru = emailUnik();
    const dipesan = await pesananSelesai(emailLama);
    await kirimEmailPesananSelesai(dipesan.id);
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiKoreksiEmail(
      { email: "" },
      formulir({ pesananId: dipesan.id, email: emailBaru }),
    );
    await jalankanPekerjaanEmail(dipesan.id);

    expect(keadaan.galat).toBeUndefined();
    expect(keadaan.pesan).toContain(emailBaru);
    const terkirim = emailTiruanKe(emailBaru);
    expect(terkirim).toHaveLength(1);
    expect(terkirim[0].subjek).toBe(`Pesanan selesai: ${dipesan.nomorPesanan}`);
    expect(emailTiruanKe(emailLama)).toHaveLength(1);
    expect(await emailDiDaftar(dipesan.nomorPesanan)).toEqual([emailBaru]);
    expect(await nomorDitemukan(emailBaru)).toEqual([dipesan.nomorPesanan]);
    expect(await nomorDitemukan(emailLama)).toEqual([]);
  });

  it("Tamu tanpa sesi Admin diarahkan ke halaman login, email Pesanan tidak berubah, dan tidak ada email yang dijadwalkan", async () => {
    const emailLama = emailUnik();
    const dipesan = await pesananSelesai(emailLama);
    sebagaiPengunjung(new Headers());

    await expect(
      aksiKoreksiEmail(
        { email: "" },
        formulir({ pesananId: dipesan.id, email: emailUnik() }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await emailDiDaftar(dipesan.nomorPesanan)).toEqual([emailLama]);
    expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);
  });

  it("email baru disimpan tanpa spasi di awal dan akhir", async () => {
    const emailBaru = emailUnik();
    const dipesan = await pesananSelesai();
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiKoreksiEmail(
      { email: "" },
      formulir({ pesananId: dipesan.id, email: `  ${emailBaru} ` }),
    );

    expect(keadaan.email).toBe(emailBaru);
    expect(await emailDiDaftar(dipesan.nomorPesanan)).toEqual([emailBaru]);
  });

  // Issue T25: email baru divalidasi dengan Zod.
  for (const { isian, pesan } of [
    {
      isian: "   ",
      pesan:
        "Email baru belum diisi. Tulis email Pembeli yang benar, misalnya nama@email.com, lalu tekan Simpan dan kirim ulang.",
    },
    {
      isian: "budi@",
      pesan:
        "Email baru belum lengkap atau salah tulis. Tulis email yang lengkap, misalnya nama@email.com, lalu tekan Simpan dan kirim ulang.",
    },
  ]) {
    it(`email baru "${isian}" ditolak dengan pesan yang menyebut sebabnya, email Pesanan tidak berubah, dan tidak ada email yang dijadwalkan`, async () => {
      const emailLama = emailUnik();
      const dipesan = await pesananSelesai(emailLama);
      sebagaiPengunjung(await cookieAdminBaru());

      const keadaan = await aksiKoreksiEmail(
        { email: "" },
        formulir({ pesananId: dipesan.id, email: isian }),
      );

      expect(keadaan).toEqual({ email: isian, galat: pesan });
      expect(await emailDiDaftar(dipesan.nomorPesanan)).toEqual([emailLama]);
      expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);
    });
  }

  it("koreksi email Pesanan Bermasalah ditolak, email Pesanan tidak berubah, dan tidak ada email yang dijadwalkan", async () => {
    const emailLama = emailUnik();
    const emailBaru = emailUnik();
    const dipesan = await sisipkanPesanan({
      varianId,
      status: "Bermasalah",
      email: emailLama,
    });
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiKoreksiEmail(
      { email: "" },
      formulir({ pesananId: dipesan.id, email: emailBaru }),
    );

    expect(keadaan).toEqual({
      email: emailBaru,
      galat:
        'Email Pesanan tidak diganti. Email "Pesanan selesai" tidak dikirim ulang, karena Pesanan ini berstatus Bermasalah, padahal kirim ulang hanya tersedia untuk Pesanan Selesai. Muat ulang halaman untuk melihat status terbarunya.',
    });
    expect(await emailDiDaftar(dipesan.nomorPesanan)).toEqual([emailLama]);
    expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);
  });
});
