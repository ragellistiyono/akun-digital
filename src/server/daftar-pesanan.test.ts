import { randomInt, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import kesamaanEmail from "../../tests/golden/kesamaan-email.json";

import { daftarPesanan, jumlahPesananBermasalah } from "./daftar-pesanan";
import { db, koneksi } from "./db";
import { pesanan, varian } from "./db/schema";
import { sisipkanProduk } from "./uji-katalog";
import { sisipkanPesanan } from "./uji-pesanan";

// Test integrasi dengan database app_test dari .env.ci. Database itu dipakai bersama test lain yang
// berjalan bersamaan dan bisa berisi ribuan Pesanan sisa run sebelumnya, jadi setiap test hanya memeriksa
// Pesanan miliknya sendiri, yang dikenali lewat email unik per test.

let varianId = "";
const NAMA_PRODUK = `Daftar Pesanan ${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: NAMA_PRODUK,
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

/** Nomor Pesanan di hasil daftar, sesuai urutannya. */
const nomor = (hasil: Awaited<ReturnType<typeof daftarPesanan>>) =>
  hasil.pesanan.map((p) => p.nomorPesanan);

describe("daftarPesanan: saringan status dan tanggal (PRD §9.1, §9.5)", () => {
  it("status Selesai dengan tanggal 11 Nov 2026 hanya memuat Pesanan Selesai yang dibuat hari itu menurut WIB", async () => {
    const email = emailUnik();
    const pesananUji = (status: "Selesai" | "Bermasalah", dibuatPada: string) =>
      sisipkanPesanan({
        varianId,
        status,
        email,
        dibuatPada: new Date(dibuatPada),
      });
    const pukul2330Wib = await pesananUji("Selesai", "2026-11-11T16:30:00Z");
    const pukul0000Wib = await pesananUji(
      "Selesai",
      "2026-11-11T00:00:00+07:00",
    );
    await pesananUji("Selesai", "2026-11-12T00:30:00+07:00");
    await pesananUji("Selesai", "2026-11-10T23:59:59+07:00");
    await pesananUji("Bermasalah", "2026-11-11T12:00:00+07:00");

    const hasil = await daftarPesanan({
      status: "Selesai",
      dari: "2026-11-11",
      sampai: "2026-11-11",
      cari: email,
    });

    expect(nomor(hasil)).toEqual([
      pukul2330Wib.nomorPesanan,
      pukul0000Wib.nomorPesanan,
    ]);
  });
});

/**
 * Email itu dengan akhiran unik tepat sebelum "@", misalnya "Budi@Mail.com" menjadi "Budi+3f9a…@Mail.com".
 * Akhirannya huruf kecil dan angka, jadi kesamaan dua email dalam kasus golden tetap sama, sedangkan Pesanan
 * sisa run sebelumnya dengan email yang sama tidak ikut terbaca.
 */
const denganAkhiran = (email: string, akhiran: string) =>
  email.replace("@", `+${akhiran}@`);

describe("daftarPesanan: pencarian menurut email (PRD §7.4, tests/golden/kesamaan-email.json)", () => {
  for (const kasus of kesamaanEmail.kasus) {
    it(`${kasus.nama}: Pesanan beremail "${kasus.input.a}" ${kasus.output.sama ? "ditemukan" : "tidak ditemukan"} dengan pencarian "${kasus.input.b}"`, async () => {
      const akhiran = randomUUID();
      const dipesan = await sisipkanPesanan({
        varianId,
        status: "Selesai",
        email: denganAkhiran(kasus.input.a, akhiran),
      });

      const hasil = await daftarPesanan({
        cari: denganAkhiran(kasus.input.b, akhiran),
      });

      expect(nomor(hasil)).toEqual(
        kasus.output.sama ? [dipesan.nomorPesanan] : [],
      );
    });
  }

  it('mencari "BUDI@mail.com" menemukan Pesanan budi@mail.com (contoh issue T24)', async () => {
    const akhiran = randomUUID();
    const dipesan = await sisipkanPesanan({
      varianId,
      status: "Selesai",
      email: denganAkhiran("budi@mail.com", akhiran),
    });

    const hasil = await daftarPesanan({
      cari: denganAkhiran("BUDI@mail.com", akhiran.toUpperCase()),
    });

    expect(nomor(hasil)).toEqual([dipesan.nomorPesanan]);
  });
});

describe("daftarPesanan: pencarian menurut Nomor Pesanan (PRD §9.6)", () => {
  it("mencari sebuah Nomor Pesanan menemukan tepat Pesanan itu", async () => {
    const dicari = await sisipkanPesanan({ varianId, status: "Selesai" });
    await sisipkanPesanan({ varianId, status: "Selesai" });

    const hasil = await daftarPesanan({ cari: dicari.nomorPesanan });

    expect(nomor(hasil)).toEqual([dicari.nomorPesanan]);
  });

  it("Nomor Pesanan yang diketik dengan huruf kecil dan spasi di ujung tetap menemukan Pesanan itu", async () => {
    const dicari = await sisipkanPesanan({ varianId, status: "Bermasalah" });

    const hasil = await daftarPesanan({
      cari: `  ${dicari.nomorPesanan.toLowerCase()} `,
    });

    expect(nomor(hasil)).toEqual([dicari.nomorPesanan]);
  });
});

/**
 * Tanggal WIB "YYYY-MM-DD" acak pada abad ke-20, yang tidak dipakai test lain. Kata cari pendek seperti
 * "budi" cocok dengan ribuan Pesanan sisa test lain, sedangkan satu halaman hanya memuat 50 Pesanan, jadi
 * test pencarian sebagian hanya membaca Pesanan yang dibuat pada tanggal ini lewat saringan tanggal.
 */
function tanggalSendiri() {
  const hari = randomInt(36_500);
  return new Date(Date.UTC(1900, 0, 1) + hari * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** Pesanan Selesai beremail itu yang dibuat pukul 12.00 WIB pada tanggal itu. */
const pesananPadaTanggal = (tanggal: string, email: string) =>
  sisipkanPesanan({
    varianId,
    status: "Selesai",
    email,
    dibuatPada: new Date(`${tanggal}T12:00:00+07:00`),
  });

describe("daftarPesanan: pencarian sebagian (PRD §9.5, ▶ Keputusan 2026-11-12)", () => {
  it('mencari "budi" dan "BUDI" menemukan Pesanan budi@mail.com', async () => {
    const tanggal = tanggalSendiri();
    const budi = await pesananPadaTanggal(tanggal, "budi@mail.com");
    const siti = await pesananPadaTanggal(tanggal, "siti@mail.com");

    for (const cari of ["budi", "BUDI"]) {
      const hasil = nomor(
        await daftarPesanan({ cari, dari: tanggal, sampai: tanggal }),
      );

      expect(hasil).toContain(budi.nomorPesanan);
      expect(hasil).not.toContain(siti.nomorPesanan);
    }
  });

  it('mencari "7K3P" atau "7k3p" menemukan Pesanan MIWE-7K3P9Q', async () => {
    // Nomor Pesanan unik, jadi Pesanan contoh ini sisa run sebelumnya dihapus dulu. Pesanan itu tidak
    // punya Item stok, dan Riwayat status-nya ikut terhapus.
    await db.delete(pesanan).where(eq(pesanan.nomorPesanan, "MIWE-7K3P9Q"));
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      nomorPesanan: "MIWE-7K3P9Q",
    });
    const lain = await sisipkanPesanan({ varianId, status: "Selesai" });

    for (const cari of ["7K3P", "7k3p"]) {
      const hasil = nomor(await daftarPesanan({ cari }));

      expect(hasil).toContain("MIWE-7K3P9Q");
      expect(hasil).not.toContain(lain.nomorPesanan);
    }
  });

  it("% dan _ di kata cari tidak dianggap pola, jadi tidak menemukan semua Pesanan", async () => {
    const tanggal = tanggalSendiri();
    const budi = await pesananPadaTanggal(tanggal, "budi@mail.com");

    for (const cari of ["%", "_", "b%@mail.com", "bud_@mail.com"]) {
      const hasil = nomor(
        await daftarPesanan({ cari, dari: tanggal, sampai: tanggal }),
      );

      expect(hasil, `kata cari "${cari}"`).not.toContain(budi.nomorPesanan);
    }
  });

  it("% dan _ di kata cari dicocokkan sebagai huruf biasa", async () => {
    const tanggal = tanggalSendiri();
    const diskon = await pesananPadaTanggal(tanggal, "diskon_50%@mail.com");

    for (const cari of ["%", "_", "_50%@"]) {
      const hasil = nomor(
        await daftarPesanan({ cari, dari: tanggal, sampai: tanggal }),
      );

      expect(hasil, `kata cari "${cari}"`).toContain(diskon.nomorPesanan);
    }
  });
});

describe("daftarPesanan: isi setiap baris (PRD §9.5)", () => {
  it("memuat Nomor Pesanan, waktu dibuat, email, Produk dan Varian, Total bayar, status, dan tanda Email gagal", async () => {
    const email = emailUnik();
    const dipesan = await sisipkanPesanan({
      varianId,
      status: "Selesai",
      email,
      dibuatPada: new Date("2026-11-11T16:30:00Z"),
      emailGagal: true,
    });

    const hasil = await daftarPesanan({ cari: dipesan.nomorPesanan });

    // Rincian sisipkanPesanan adalah contoh PRD §5.5: Total bayar Rp 45.123.
    expect(hasil.pesanan).toEqual([
      {
        nomorPesanan: dipesan.nomorPesanan,
        waktuDibuat: new Date("2026-11-11T16:30:00Z"),
        email,
        namaProduk: NAMA_PRODUK,
        namaVarian: "1 Bulan",
        totalBayar: 45123,
        status: "Selesai",
        emailGagal: true,
      },
    ]);
  });
});

describe("daftarPesanan: urutan dan halaman", () => {
  it("Pesanan yang terbaru dibuat tampil di atas, 50 Pesanan per halaman, beserta jumlah semua Pesanan yang cocok", async () => {
    const email = emailUnik();
    const semua: string[] = [];
    // 51 Pesanan yang dibuat berselang satu menit mulai 11 Nov 2026 08.00 WIB, yang paling lama lebih dulu.
    for (let menit = 0; menit < 51; menit++) {
      const { nomorPesanan } = await sisipkanPesanan({
        varianId,
        status: "Selesai",
        email,
        dibuatPada: new Date(
          new Date("2026-11-11T08:00:00+07:00").getTime() + menit * 60_000,
        ),
      });
      semua.push(nomorPesanan);
    }
    const terbaruDulu = semua.toReversed();

    const halaman1 = await daftarPesanan({ cari: email });
    const halaman2 = await daftarPesanan({ cari: email, halaman: 2 });
    const halaman3 = await daftarPesanan({ cari: email, halaman: 3 });

    expect(halaman1).toMatchObject({
      jumlah: 51,
      halaman: 1,
      jumlahHalaman: 2,
    });
    expect(nomor(halaman1)).toEqual(terbaruDulu.slice(0, 50));
    expect(halaman2).toMatchObject({
      jumlah: 51,
      halaman: 2,
      jumlahHalaman: 2,
    });
    expect(nomor(halaman2)).toEqual([semua[0]]);
    expect(nomor(halaman3)).toEqual([]);
  });

  it("tanpa Pesanan yang cocok, jumlahnya 0 dan tetap ada satu halaman", async () => {
    const hasil = await daftarPesanan({ cari: emailUnik() });

    expect(hasil).toEqual({
      pesanan: [],
      jumlah: 0,
      halaman: 1,
      jumlahHalaman: 1,
    });
  });
});

// PRD §5.9: Pesanan Bermasalah tampil menonjol di dasbor admin. Jumlahnya dihitung dari semua Pesanan, dan
// test lain yang berjalan bersamaan bisa membuat Pesanan Bermasalah di sela kedua bacaan, jadi test ini
// diulang bila angkanya terganggu.
describe("jumlahPesananBermasalah (PRD §5.9)", () => {
  it(
    "berkurang satu setelah satu Pesanan Bermasalah berpindah status",
    { retry: 3 },
    async () => {
      const { id } = await sisipkanPesanan({ varianId, status: "Bermasalah" });
      const sebelum = await jumlahPesananBermasalah();

      await db
        .update(pesanan)
        .set({ status: "Dana Dikembalikan" })
        .where(eq(pesanan.id, id));

      expect(sebelum).toBeGreaterThanOrEqual(1);
      expect(await jumlahPesananBermasalah()).toBe(sebelum - 1);
    },
  );
});
