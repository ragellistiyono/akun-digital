import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { daftarPesanan } from "@/server/daftar-pesanan";
import { db, koneksi } from "@/server/db";
import { varian } from "@/server/db/schema";
import { bacaDetailPesanan } from "@/server/detail-pesanan";
import { kirimEmailPesananSelesai } from "@/server/email-pesanan-selesai";
import { emailTiruanKe } from "@/server/email-tiruan";
import { bacaStokVarian } from "@/server/item-stok";
import {
  kerjakanEmailPesananSelesai,
  pekerjaanEmailPesananSelesai,
} from "@/server/pekerjaan-latar";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import { sisipkanProduk } from "@/server/uji-katalog";
import { sisipkanPesanan } from "@/server/uji-pesanan";

import {
  aksiKirimUlangEmail,
  aksiKoreksiEmail,
  aksiSelesaikanBermasalah,
} from "./aksi";

// Test integrasi Server Action dengan database app_test, dan email tiruan dari .env.ci (EMAIL_MODE=tiruan).
// Header permintaan yang dibaca aksi lewat next/headers diganti dengan cookie milik pengunjung di setiap
// test. refresh() dan revalidatePath() dari next/cache hanya bisa berjalan di dalam Server Action yang
// dijalankan Next.js, jadi diganti tiruan. Pekerja pg-boss tidak berjalan di proses test, jadi test menjalankan sendiri pekerjaan
// email yang dijadwalkan aksi.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));

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

/** Varian "1 Bulan" sebuah Produk [CONTOH] baru dengan Stok Varian itu. */
async function varianBerstok(stok: number) {
  const produkId = await sisipkanProduk({
    nama: `Selesaikan ${randomUUID().slice(0, 8)}`,
    formatItemStok: FORMAT,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: stok }],
  });
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return id;
}

/** Status Pesanan itu menurut detail Pesanan di dasbor admin. */
async function statusPesanan(nomorPesanan: string) {
  return (await bacaDetailPesanan(nomorPesanan))?.status;
}

describe("menyelesaikan Pesanan Bermasalah (PRD §5.9)", () => {
  // Issue T26: Tamu tidak bisa menjalankan aksi ini.
  for (const cara of ["kirim-item-stok", "dana-dikembalikan"]) {
    it(`Tamu tanpa sesi Admin yang mengirim ${cara} diarahkan ke halaman login, dan Pesanan tetap Bermasalah tanpa Item stok`, async () => {
      const varianId = await varianBerstok(1);
      const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });
      sebagaiPengunjung(new Headers());

      await expect(
        aksiSelesaikanBermasalah({}, formulir({ pesananId: dipesan.id, cara })),
      ).rejects.toSatisfy(arahKe("/admin"));

      expect(await statusPesanan(dipesan.nomorPesanan)).toBe("Bermasalah");
      expect((await bacaStokVarian(varianId)).stokVarian).toBe(1);
      expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);
    });
  }

  // UAT-E6 langkah 1: Pesanan pertama menjadi Selesai, mendapat satu Item stok dari Varian yang sama, dan
  // emailnya terkirim.
  it('Admin menekan "Kirim Item stok": Pesanan Selesai, satu Item stok Terkirim, email "Pesanan selesai" terkirim, dan dasbor admin dimuat ulang', async () => {
    const varianId = await varianBerstok(2);
    const email = emailUnik();
    const dipesan = await sisipkanPesanan({
      varianId,
      status: "Bermasalah",
      email,
    });
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(revalidatePath).mockClear();

    const keadaan = await aksiSelesaikanBermasalah(
      {},
      formulir({ pesananId: dipesan.id, cara: "kirim-item-stok" }),
    );
    await jalankanPekerjaanEmail(dipesan.id);

    expect(keadaan).toEqual({});
    expect(await statusPesanan(dipesan.nomorPesanan)).toBe("Selesai");
    expect((await bacaStokVarian(varianId)).jumlahPerStatus).toEqual({
      Tersedia: 1,
      Ditahan: 0,
      Terkirim: 1,
    });
    const terkirim = emailTiruanKe(email);
    expect(terkirim).toHaveLength(1);
    expect(terkirim[0].subjek).toBe(`Pesanan selesai: ${dipesan.nomorPesanan}`);
    // Jumlah Pesanan Bermasalah di menu dihitung di layout dasbor admin, jadi layout itu ikut dimuat ulang.
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  // UAT-E6 langkah 2: Pesanan kedua menjadi Dana Dikembalikan.
  it('Admin menekan "Tandai Dana Dikembalikan": Pesanan Dana Dikembalikan tanpa Item stok', async () => {
    const varianId = await varianBerstok(1);
    const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(revalidatePath).mockClear();

    const keadaan = await aksiSelesaikanBermasalah(
      {},
      formulir({ pesananId: dipesan.id, cara: "dana-dikembalikan" }),
    );

    expect(keadaan).toEqual({});
    expect(await statusPesanan(dipesan.nomorPesanan)).toBe("Dana Dikembalikan");
    expect((await bacaStokVarian(varianId)).stokVarian).toBe(1);
    expect(await pekerjaanEmailPesananSelesai(dipesan.id)).toEqual([]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  // Issue T26: bila Stok Varian 0, aksi ditolak dengan pesan untuk mengisi stok dulu.
  it("Kirim Item stok saat Stok Varian 0 ditolak dengan pesan untuk mengisi stok dulu, dan Pesanan tetap Bermasalah", async () => {
    const varianId = await varianBerstok(0);
    const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiSelesaikanBermasalah(
      {},
      formulir({ pesananId: dipesan.id, cara: "kirim-item-stok" }),
    );

    expect(keadaan).toEqual({
      galat:
        'Item stok tidak dikirim, karena Stok Varian Pesanan ini 0, jadi Pesanan tetap Bermasalah. Isi Item stok Varian itu dulu di menu Produk, lalu tekan "Kirim Item stok" lagi. Item stok dari Varian lain tidak bisa dipakai.',
    });
    expect(await statusPesanan(dipesan.nomorPesanan)).toBe("Bermasalah");
  });

  // Issue T26: kedua aksi tidak tersedia untuk Pesanan selain Bermasalah.
  it("aksi untuk Pesanan yang sudah Selesai ditolak dengan pesan yang menyebut statusnya, dan Pesanan tidak berubah", async () => {
    const varianId = await varianBerstok(1);
    const dipesan = await sisipkanPesanan({ varianId, status: "Selesai" });
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiSelesaikanBermasalah(
      {},
      formulir({ pesananId: dipesan.id, cara: "dana-dikembalikan" }),
    );

    expect(keadaan).toEqual({
      galat:
        'Pesanan ini tidak diubah, karena berstatus Selesai, padahal "Kirim Item stok" dan "Tandai Dana Dikembalikan" hanya tersedia untuk Pesanan Bermasalah. Muat ulang halaman untuk melihat status terbarunya.',
    });
    expect(await statusPesanan(dipesan.nomorPesanan)).toBe("Selesai");
    expect((await bacaStokVarian(varianId)).stokVarian).toBe(1);
  });

  it("pilihan penyelesaian yang tidak dikenal ditolak, dan Pesanan tidak berubah", async () => {
    const varianId = await varianBerstok(1);
    const dipesan = await sisipkanPesanan({ varianId, status: "Bermasalah" });
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiSelesaikanBermasalah(
      {},
      formulir({ pesananId: dipesan.id, cara: "hapus" }),
    );

    expect(keadaan).toEqual({
      galat:
        'Pilihan penyelesaian tidak dikenal, jadi Pesanan ini tidak diubah. Muat ulang halaman, lalu tekan "Kirim Item stok" atau "Tandai Dana Dikembalikan".',
    });
    expect(await statusPesanan(dipesan.nomorPesanan)).toBe("Bermasalah");
  });

  it("Pesanan yang tidak ada menampilkan halaman tidak ditemukan", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiSelesaikanBermasalah(
        {},
        formulir({ pesananId: randomUUID(), cara: "kirim-item-stok" }),
      ),
    ).rejects.toSatisfy(tidakDitemukan);
  });
});
