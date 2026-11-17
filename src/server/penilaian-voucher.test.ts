import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auth } from "./auth/auth";
import { db, koneksi } from "./db";
import { produk, varian, voucher } from "./db/schema";
import { nilaiVoucher } from "./penilaian-voucher";
import { sisipkanKategori, sisipkanProduk } from "./uji-katalog";
import { sisipkanMember } from "./uji-member";
import { sisipkanPesanan } from "./uji-pesanan";
import { buatVoucher, type SyaratVoucher } from "./voucher";

// Test integrasi dengan database app_test dari .env.ci. Database itu dipakai bersama test lain, jadi setiap
// Voucher, Produk, Kategori, dan email di sini unik per berkas atau per test. Voucher-nya meniru Voucher seed
// "Persiapan bersama" di docs/UAT.md dengan kode unik. PRD §8.1–§8.5, §8.7, UAT-H1–UAT-H4.

const PASSWORD = "sandi-uji-member-123";
const SATU_HARI_MS = 24 * 60 * 60 * 1000;

const akhiran = () => randomUUID().slice(0, 8);

/** Kode Voucher unik dengan awalan itu, huruf besar dan angka saja. */
const kodeBaru = (awalan: string) =>
  `${awalan}${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;

const SYARAT_AWAL: SyaratVoucher = {
  jenisPotongan: "nominal",
  nilai: 5000,
  batasMaksimum: null,
  kuotaVoucher: null,
  batasPerEmail: 1,
  minimalHargaJual: null,
  mulai: null,
  berakhir: null,
  cakupan: { jenis: "semua" },
  khususMember: false,
  aktif: true,
};

/** Membuat Voucher dengan syarat itu, lalu mengembalikan id dan kodenya. Syarat lain seperti HEMAT5. */
async function voucherBaru(
  awalan: string,
  syarat: Partial<SyaratVoucher> = {},
) {
  const kode = kodeBaru(awalan);
  const hasil = await buatVoucher({ kode, ...SYARAT_AWAL, ...syarat });
  if (hasil.hasil !== "dibuat")
    throw new Error(`Voucher ${kode} tidak dibuat.`);
  const [{ id }] = await db
    .select({ id: voucher.id })
    .from(voucher)
    .where(eq(voucher.kode, kode));
  return { id, kode };
}

/** Id Varian pertama sebuah Produk. */
async function varianPertama(produkId: string) {
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return id;
}

/** Header permintaan berisi cookie sesi Member baru dengan email itu, seperti yang dikirim browser setelah login. */
async function cookieMemberBaru(email: string) {
  await sisipkanMember({ email, password: PASSWORD });
  const { headers } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((baris) => baris.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

/** Header permintaan Tamu, tanpa cookie sesi. */
const tamu = () => new Headers();

let streamingId = "";
let musikId = "";
let netflixId = "";
let netflix1Bulan = "";
let netflix3Bulan = "";
let ujiBayar = "";

beforeAll(async () => {
  streamingId = await sisipkanKategori({ nama: `Streaming ${akhiran()}` });
  musikId = await sisipkanKategori({ nama: `Musik ${akhiran()}` });
  netflixId = await sisipkanProduk({
    nama: `Netflix Premium ${akhiran()}`,
    kategoriId: streamingId,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  netflix1Bulan = await varianPertama(netflixId);
  netflix3Bulan = await varianPertama(
    await sisipkanProduk({
      nama: `Netflix Premium 3 Bulan ${akhiran()}`,
      kategoriId: streamingId,
      varian: [{ nama: "3 Bulan", hargaJual: 135000 }],
    }),
  );
  ujiBayar = await varianPertama(
    await sisipkanProduk({
      nama: `Uji Bayar ${akhiran()}`,
      kategoriId: streamingId,
      varian: [{ nama: "Uji", hargaJual: 1000 }],
    }),
  );
});

afterAll(async () => {
  await koneksi.end();
});

describe("nilaiVoucher: potongan voucher (PRD §8.1–§8.3, UAT-H1)", () => {
  it("HEMAT5 untuk Netflix Premium 1 Bulan diterima dengan potongan Rp 5.000", async () => {
    const hemat5 = await voucherBaru("HEMAT");

    const hasil = await nilaiVoucher({
      kode: hemat5.kode,
      varianId: netflix1Bulan,
      email: null,
      kepala: tamu(),
    });

    expect(hasil).toEqual({
      dipakai: true,
      alasan: null,
      pesan: null,
      hargaJual: 50000,
      potonganVoucher: 5000,
      hargaSetelahPotongan: 45000,
      voucherId: hemat5.id,
      kodeVoucher: hemat5.kode,
    });
  });

  it("HEMAT10 yang ditulis huruf kecil untuk Netflix Premium 3 Bulan diterima dengan potongan Rp 10.000", async () => {
    const hemat10 = await voucherBaru("HEMAT", {
      jenisPotongan: "persen",
      nilai: 10,
      batasMaksimum: 10000,
      minimalHargaJual: 50000,
    });

    const hasil = await nilaiVoucher({
      kode: hemat10.kode.toLowerCase(),
      varianId: netflix3Bulan,
      email: null,
      kepala: tamu(),
    });

    expect(hasil).toMatchObject({
      dipakai: true,
      potonganVoucher: 10000,
      kodeVoucher: hemat10.kode,
    });
  });

  it("hasilnya null bila Varian itu tidak ada", async () => {
    const hemat5 = await voucherBaru("HEMAT");

    expect(
      await nilaiVoucher({
        kode: hemat5.kode,
        varianId: randomUUID(),
        email: null,
        kepala: tamu(),
      }),
    ).toBeNull();
  });
});

describe("nilaiVoucher: pesan penolakan (PRD §8.7, UAT-H3)", () => {
  it('kode yang tidak ada ditolak dengan "Kode voucher tidak ditemukan"', async () => {
    const hasil = await nilaiVoucher({
      kode: kodeBaru("ASAL"),
      varianId: netflix1Bulan,
      email: null,
      kepala: tamu(),
    });

    expect(hasil).toMatchObject({
      dipakai: false,
      potonganVoucher: 0,
      pesan: "Kode voucher tidak ditemukan",
    });
  });

  it('MATI yang nonaktif ditolak dengan "Kode voucher tidak ditemukan"', async () => {
    const mati = await voucherBaru("MATI", { aktif: false });

    const hasil = await nilaiVoucher({
      kode: mati.kode,
      varianId: netflix1Bulan,
      email: null,
      kepala: tamu(),
    });

    expect(hasil?.pesan).toBe("Kode voucher tidak ditemukan");
  });

  it('Voucher yang waktu mulainya besok ditolak dengan "Voucher belum berlaku"', async () => {
    const besok = await voucherBaru("BESOK", {
      mulai: new Date(Date.now() + SATU_HARI_MS),
    });

    const hasil = await nilaiVoucher({
      kode: besok.kode,
      varianId: netflix1Bulan,
      email: null,
      kepala: tamu(),
    });

    expect(hasil?.pesan).toBe("Voucher belum berlaku");
  });

  it('LAMA yang berakhir kemarin ditolak dengan "Voucher sudah berakhir"', async () => {
    const lama = await voucherBaru("LAMA", {
      berakhir: new Date(Date.now() - SATU_HARI_MS),
    });

    const hasil = await nilaiVoucher({
      kode: lama.kode,
      varianId: netflix1Bulan,
      email: null,
      kepala: tamu(),
    });

    expect(hasil?.pesan).toBe("Voucher sudah berakhir");
  });

  it('SATUKALI yang kuotanya dipakai Pesanan Menunggu Pembayaran ditolak dengan "Kuota voucher habis" (UAT-H4 langkah 2)', async () => {
    const satukali = await voucherBaru("SATUKALI", {
      nilai: 2000,
      kuotaVoucher: 1,
    });
    await sisipkanPesanan({
      varianId: netflix1Bulan,
      status: "Menunggu Pembayaran",
      voucher: satukali,
    });

    const hasil = await nilaiVoucher({
      kode: satukali.kode,
      varianId: netflix1Bulan,
      email: `email-b-${randomUUID()}@example.test`,
      kepala: tamu(),
    });

    expect(hasil?.pesan).toBe("Kuota voucher habis");
  });

  it('HEMAT5 yang sudah dipakai email itu ditolak dengan "Anda sudah memakai voucher ini"', async () => {
    const hemat5 = await voucherBaru("HEMAT");
    const email = `email-a-${randomUUID()}@example.test`;
    await sisipkanPesanan({
      varianId: netflix1Bulan,
      status: "Selesai",
      email,
      voucher: hemat5,
    });

    const hasil = await nilaiVoucher({
      kode: hemat5.kode,
      varianId: netflix1Bulan,
      email,
      kepala: tamu(),
    });

    expect(hasil?.pesan).toBe("Anda sudah memakai voucher ini");
  });

  it('HEMAT10 untuk Uji Bayar (Rp 1.000) ditolak dengan "Minimal pembelian Rp 50.000"', async () => {
    const hemat10 = await voucherBaru("HEMAT", {
      jenisPotongan: "persen",
      nilai: 10,
      batasMaksimum: 10000,
      minimalHargaJual: 50000,
    });

    const hasil = await nilaiVoucher({
      kode: hemat10.kode,
      varianId: ujiBayar,
      email: null,
      kepala: tamu(),
    });

    expect(hasil?.pesan).toBe("Minimal pembelian Rp 50.000");
  });

  it('HEMAT5 yang dibatasi Kategori Musik ditolak untuk Netflix Premium dengan "Voucher tidak berlaku untuk produk ini"', async () => {
    const hemat5 = await voucherBaru("HEMAT", {
      cakupan: { jenis: "kategori", daftar: [musikId] },
    });

    const hasil = await nilaiVoucher({
      kode: hemat5.kode,
      varianId: netflix1Bulan,
      email: null,
      kepala: tamu(),
    });

    expect(hasil?.pesan).toBe("Voucher tidak berlaku untuk produk ini");
  });

  it('MEMBER20 sebagai Tamu ditolak dengan "Voucher khusus Member, silakan login"', async () => {
    const member20 = await voucherBaru("MEMBER", {
      jenisPotongan: "persen",
      nilai: 20,
      khususMember: true,
    });

    const hasil = await nilaiVoucher({
      kode: member20.kode,
      varianId: netflix1Bulan,
      email: null,
      kepala: tamu(),
    });

    expect(hasil).toMatchObject({
      dipakai: false,
      alasan: "khusus-member",
      pesan: "Voucher khusus Member, silakan login",
    });
  });

  it('HEMAT5 untuk Uji Bayar (Rp 1.000) ditolak dengan "Voucher tidak memberi potongan untuk produk ini" (UAT-H2 langkah 3)', async () => {
    const hemat5 = await voucherBaru("HEMAT");

    const hasil = await nilaiVoucher({
      kode: hemat5.kode,
      varianId: ujiBayar,
      email: null,
      kepala: tamu(),
    });

    expect(hasil).toMatchObject({
      dipakai: false,
      potonganVoucher: 0,
      pesan: "Voucher tidak memberi potongan untuk produk ini",
    });
  });
});

describe("nilaiVoucher: Batas per email (PRD §8.5, §8.7 ▶ Keputusan 2026-11-17)", () => {
  it("menghitung Pesanan dengan email yang sama tanpa membedakan huruf besar dan kecil (UAT-H4 langkah 5)", async () => {
    const hemat5 = await voucherBaru("HEMAT");
    const nama = `member-${randomUUID()}`;
    await sisipkanPesanan({
      varianId: ujiBayar,
      status: "Selesai",
      email: `${nama}@miwe.example`,
      voucher: hemat5,
    });

    const hasil = await nilaiVoucher({
      kode: hemat5.kode,
      varianId: netflix1Bulan,
      email: `${nama.toUpperCase()}@MIWE.example`,
      kepala: tamu(),
    });

    expect(hasil?.pesan).toBe("Anda sudah memakai voucher ini");
  });

  it("tanpa email, Voucher yang Batas per email-nya sudah terpakai oleh email lain tetap diterima", async () => {
    const hemat5 = await voucherBaru("HEMAT");
    await sisipkanPesanan({
      varianId: netflix1Bulan,
      status: "Selesai",
      voucher: hemat5,
    });

    const hasil = await nilaiVoucher({
      kode: hemat5.kode,
      varianId: netflix1Bulan,
      email: null,
      kepala: tamu(),
    });

    expect(hasil).toMatchObject({ dipakai: true, potonganVoucher: 5000 });
  });

  it("email yang hanya berisi spasi diperlakukan sebagai email kosong", async () => {
    const hemat5 = await voucherBaru("HEMAT");
    await sisipkanPesanan({
      varianId: netflix1Bulan,
      status: "Selesai",
      voucher: hemat5,
    });

    const hasil = await nilaiVoucher({
      kode: hemat5.kode,
      varianId: netflix1Bulan,
      email: "   ",
      kepala: tamu(),
    });

    expect(hasil).toMatchObject({ dipakai: true });
  });

  it("Member yang login memakai email Member-nya, bukan email yang dikirim", async () => {
    const hemat5 = await voucherBaru("HEMAT");
    const emailMember = `member-${randomUUID()}@example.test`;
    await sisipkanPesanan({
      varianId: netflix1Bulan,
      status: "Selesai",
      email: emailMember,
      voucher: hemat5,
    });

    const hasil = await nilaiVoucher({
      kode: hemat5.kode,
      varianId: netflix1Bulan,
      email: null,
      kepala: await cookieMemberBaru(emailMember),
    });

    expect(hasil?.pesan).toBe("Anda sudah memakai voucher ini");
  });
});

describe("nilaiVoucher: khusus Member (PRD §8.4, UAT-H3)", () => {
  it("MEMBER20 ditolak tanpa sesi Member dan diterima dengan sesi Member, dengan potongan Rp 10.000 untuk Netflix Premium 1 Bulan", async () => {
    const member20 = await voucherBaru("MEMBER", {
      jenisPotongan: "persen",
      nilai: 20,
      khususMember: true,
    });
    const kepalaMember = await cookieMemberBaru(
      `member-${randomUUID()}@example.test`,
    );

    const tanpaSesi = await nilaiVoucher({
      kode: member20.kode,
      varianId: netflix1Bulan,
      email: null,
      kepala: tamu(),
    });
    const denganSesi = await nilaiVoucher({
      kode: member20.kode,
      varianId: netflix1Bulan,
      email: null,
      kepala: kepalaMember,
    });

    expect(tanpaSesi?.pesan).toBe("Voucher khusus Member, silakan login");
    expect(denganSesi).toMatchObject({ dipakai: true, potonganVoucher: 10000 });
  });
});

describe("nilaiVoucher: Cakupan voucher (PRD §8.4 ▶ Keputusan 2026-11-17)", () => {
  it("Cakupan Kategori memakai Kategori Produk pada saat checkout, juga setelah Produk dipindah ke Kategori lain", async () => {
    const produkId = await sisipkanProduk({
      nama: `Produk Pindah ${akhiran()}`,
      kategoriId: streamingId,
      varian: [{ nama: "1 Bulan", hargaJual: 25000 }],
    });
    const varianId = await varianPertama(produkId);
    const khususMusik = await voucherBaru("MUSIK", {
      cakupan: { jenis: "kategori", daftar: [musikId] },
    });
    const nilai = () =>
      nilaiVoucher({
        kode: khususMusik.kode,
        varianId,
        email: null,
        kepala: tamu(),
      });

    const diStreaming = await nilai();
    await db
      .update(produk)
      .set({ kategoriId: musikId })
      .where(eq(produk.id, produkId));
    const diMusik = await nilai();
    await db
      .update(produk)
      .set({ kategoriId: streamingId })
      .where(eq(produk.id, produkId));
    const kembaliKeStreaming = await nilai();

    expect(diStreaming?.pesan).toBe("Voucher tidak berlaku untuk produk ini");
    expect(diMusik).toMatchObject({ dipakai: true, potonganVoucher: 5000 });
    expect(kembaliKeStreaming?.pesan).toBe(
      "Voucher tidak berlaku untuk produk ini",
    );
  });

  it("Cakupan Produk hanya berlaku untuk Produk di daftarnya", async () => {
    const khususNetflix = await voucherBaru("NETFLIX", {
      cakupan: { jenis: "produk", daftar: [netflixId] },
    });

    const untukNetflix = await nilaiVoucher({
      kode: khususNetflix.kode,
      varianId: netflix1Bulan,
      email: null,
      kepala: tamu(),
    });
    const untukLain = await nilaiVoucher({
      kode: khususNetflix.kode,
      varianId: netflix3Bulan,
      email: null,
      kepala: tamu(),
    });

    expect(untukNetflix).toMatchObject({ dipakai: true });
    expect(untukLain?.pesan).toBe("Voucher tidak berlaku untuk produk ini");
  });
});
