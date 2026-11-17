import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import kesamaanEmail from "../../tests/golden/kesamaan-email.json";

import { db, koneksi } from "./db";
import { varian } from "./db/schema";
import { koreksiEmailPesanan } from "./detail-pesanan";
import { riwayatPesanan } from "./riwayat-pesanan";
import { sisipkanProduk } from "./uji-katalog";
import { sisipkanPesanan } from "./uji-pesanan";

// Test integrasi dengan database app_test dari .env.ci. Database itu dipakai bersama test lain yang berjalan
// bersamaan, jadi setiap test memakai email dengan akhiran unik, supaya Pesanan milik test lain tidak ikut
// terbaca di Riwayat Pesanan-nya.

let varianId = "";
const NAMA_PRODUK = `Riwayat Pesanan ${randomUUID().slice(0, 8)}`;

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

/**
 * Email itu dengan akhiran unik tepat sebelum "@", misalnya "Budi@Mail.com" menjadi "Budi+3f9a…@Mail.com".
 * Akhirannya huruf kecil dan angka, jadi kesamaan dua email dalam kasus golden tetap sama.
 */
const denganAkhiran = (email: string, akhiran: string) =>
  email.replace("@", `+${akhiran}@`);

/** Nomor Pesanan di Riwayat Pesanan, sesuai urutannya. */
const nomor = (riwayat: Awaited<ReturnType<typeof riwayatPesanan>>) =>
  riwayat.map((p) => p.nomorPesanan);

describe("riwayatPesanan: kesamaan email (PRD §7.4, tests/golden/kesamaan-email.json)", () => {
  for (const kasus of kesamaanEmail.kasus) {
    it(`${kasus.nama}: Pesanan beremail "${kasus.input.a}" ${kasus.output.sama ? "ada" : "tidak ada"} di Riwayat Pesanan Member "${kasus.input.b}"`, async () => {
      const akhiran = randomUUID();
      const dipesan = await sisipkanPesanan({
        varianId,
        status: "Selesai",
        email: denganAkhiran(kasus.input.a, akhiran),
      });

      const riwayat = await riwayatPesanan(
        denganAkhiran(kasus.input.b, akhiran),
      );

      expect(nomor(riwayat)).toEqual(
        kasus.output.sama ? [dipesan.nomorPesanan] : [],
      );
    });
  }
});

describe("riwayatPesanan: isi dan urutan (PRD §7.4)", () => {
  it("memuat Pesanan semua status milik Member, terbaru di atas, beserta Tautan, Produk, Varian, Total bayar, dan waktu dibuatnya", async () => {
    const akhiran = randomUUID();
    const emailMember = denganAkhiran("budi@mail.com", akhiran);
    const emailTamu = denganAkhiran("BUDI@Mail.com", akhiran);
    const pesananPada = (
      status:
        | "Selesai"
        | "Menunggu Pembayaran"
        | "Bermasalah"
        | "Kedaluwarsa"
        | "Dibatalkan"
        | "Dana Dikembalikan",
      dibuatPada: string,
      email = emailMember,
    ) =>
      sisipkanPesanan({
        varianId,
        status,
        email,
        dibuatPada: new Date(dibuatPada),
      });

    const kembali = await pesananPada(
      "Dana Dikembalikan",
      "2026-11-02T21:10:00+07:00",
    );
    const batal = await pesananPada("Dibatalkan", "2026-11-08T13:22:00+07:00");
    const selesaiTamu = await pesananPada(
      "Selesai",
      "2026-11-11T20:14:00+07:00",
      emailTamu,
    );
    const menunggu = await pesananPada(
      "Menunggu Pembayaran",
      "2026-11-11T19:52:00+07:00",
    );
    const kedaluwarsa = await pesananPada(
      "Kedaluwarsa",
      "2026-11-09T08:40:00+07:00",
    );
    const masalah = await pesananPada(
      "Bermasalah",
      "2026-11-10T22:05:00+07:00",
    );
    await pesananPada(
      "Selesai",
      "2026-11-12T10:00:00+07:00",
      denganAkhiran("siti@mail.com", akhiran),
    );

    const riwayat = await riwayatPesanan(emailMember);

    expect(nomor(riwayat)).toEqual([
      selesaiTamu.nomorPesanan,
      menunggu.nomorPesanan,
      masalah.nomorPesanan,
      kedaluwarsa.nomorPesanan,
      batal.nomorPesanan,
      kembali.nomorPesanan,
    ]);
    expect(riwayat[0]).toEqual({
      nomorPesanan: selesaiTamu.nomorPesanan,
      tautan: selesaiTamu.tautan,
      status: "Selesai",
      totalBayar: 45123,
      namaProduk: NAMA_PRODUK,
      namaVarian: "1 Bulan",
      waktuDibuat: new Date("2026-11-11T20:14:00+07:00"),
    });
  });

  it("Riwayat Pesanan Member tanpa Pesanan kosong", async () => {
    const riwayat = await riwayatPesanan(
      `tanpa-pesanan-${randomUUID()}@mail.com`,
    );

    expect(riwayat).toEqual([]);
  });
});

describe("riwayatPesanan: koreksi email (PRD §6.4, ADR-0003)", () => {
  it("setelah Admin mengoreksi email sebuah Pesanan menjadi email Member, Pesanan itu muncul di Riwayat Pesanan Member itu dan hilang dari Riwayat email lamanya", async () => {
    const akhiran = randomUUID();
    const emailMember = denganAkhiran("budi@mail.com", akhiran);
    const emailSalahKetik = denganAkhiran("budy@mail.com", akhiran);
    const dipesan = await sisipkanPesanan({
      varianId,
      status: "Bermasalah",
      email: emailSalahKetik,
    });
    expect(nomor(await riwayatPesanan(emailMember))).toEqual([]);

    await koreksiEmailPesanan({
      pesananId: dipesan.id,
      emailBaru: emailMember,
    });

    expect(nomor(await riwayatPesanan(emailMember))).toEqual([
      dipesan.nomorPesanan,
    ]);
    expect(nomor(await riwayatPesanan(emailSalahKetik))).toEqual([]);
  });
});
