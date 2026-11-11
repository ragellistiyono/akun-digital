import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { db, koneksi } from "@/server/db";
import { pesanan, varian } from "@/server/db/schema";
import { qrispyTiruan } from "@/server/qrispy-tiruan";
import { sisipkanProduk } from "@/server/uji-katalog";

import { aksiCheckout } from "./aksi";

// Test integrasi Server Action checkout dengan database app_test dan Qrispy tiruan dari .env.ci
// (QRISPY_MODE=tiruan). Data Produknya mengikuti persiapan bersama di docs/UAT.md, yang bertanda [CONTOH].
afterAll(async () => {
  await koneksi.end();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const emailUnik = () => `budi-${randomUUID()}@example.test`;

function formulir(isian: Record<string, string>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) data.set(nama, nilai);
  return data;
}

/** Varian Netflix Premium 1 Bulan Rp 50.000 [CONTOH]. Hasilnya id Varian itu. */
async function netflixSatuBulan({
  produkAktif = true,
  varianAktif = true,
} = {}) {
  const produkId = await sisipkanProduk({
    nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
    aktif: produkAktif,
    varian: [
      {
        nama: "1 Bulan",
        hargaJual: 50000,
        aktif: varianAktif,
        Tersedia: 10,
      },
    ],
  });
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return id;
}

function pesananDenganEmail(email: string) {
  return db
    .select({ email: pesanan.email, status: pesanan.status })
    .from(pesanan)
    .where(eq(pesanan.email, email));
}

/** Alamat tujuan bila galat yang dilempar Server Action adalah pengalihan Next.js. */
function alamatPengalihan(galat: unknown) {
  if (
    typeof galat === "object" &&
    galat !== null &&
    "digest" in galat &&
    typeof galat.digest === "string" &&
    galat.digest.startsWith("NEXT_REDIRECT")
  ) {
    return galat.digest.split(";")[2];
  }
  throw galat;
}

const keadaanAwal = () => ({ email: "" });

const PESAN_TIDAK_DIJUAL =
  "Produk atau Varian ini sedang tidak dijual, jadi Pesanan tidak dibuat. Pilih Produk lain di Beranda.";

describe("checkout (PRD §5.2)", () => {
  it("email yang sah membuat Pesanan Menunggu Pembayaran, lalu Pembeli diarahkan ke Tautan Pesanan", async () => {
    const varianId = await netflixSatuBulan();
    const email = emailUnik();

    const alamat = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId, email: `  ${email} ` }),
    ).then(
      () => null,
      (galat: unknown) => alamatPengalihan(galat),
    );

    expect(alamat).toMatch(/^\/pesanan\/[A-Za-z0-9_-]{43}$/);
    expect(await pesananDenganEmail(email)).toEqual([
      { email, status: "Menunggu Pembayaran" },
    ]);
  });

  for (const [kasus, email, pesan] of [
    [
      "kosong",
      "   ",
      "Email belum diisi. Tulis email Anda, misalnya nama@email.com, supaya detail pesanan bisa dikirim.",
    ],
    [
      "tanpa domain",
      "budi@",
      "Email ini belum lengkap atau salah tulis. Tulis email yang lengkap, misalnya nama@email.com.",
    ],
    [
      "tanpa @",
      "budi.mail.com",
      "Email ini belum lengkap atau salah tulis. Tulis email yang lengkap, misalnya nama@email.com.",
    ],
  ] as const) {
    it(`email ${kasus} ditolak dengan pesan, dan Pesanan tidak dibuat`, async () => {
      const varianId = await netflixSatuBulan();
      const buatQris = vi.spyOn(qrispyTiruan, "buatQris");

      const keadaan = await aksiCheckout(
        keadaanAwal(),
        formulir({ varianId, email }),
      );

      expect(keadaan).toEqual({ email, galat: { email: pesan } });
      expect(buatQris).not.toHaveBeenCalled();
    });
  }

  // PRD §3.7.
  for (const [kasus, pilihan] of [
    ["Varian nonaktif", { varianAktif: false }],
    ["Varian dari Produk nonaktif", { produkAktif: false }],
  ] as const) {
    it(`checkout ${kasus} ditolak dengan pesan, dan Pesanan tidak dibuat`, async () => {
      const varianId = await netflixSatuBulan(pilihan);
      const email = emailUnik();

      const keadaan = await aksiCheckout(
        keadaanAwal(),
        formulir({ varianId, email }),
      );

      expect(keadaan).toEqual({
        email,
        galat: { checkout: PESAN_TIDAK_DIJUAL },
      });
      expect(await pesananDenganEmail(email)).toEqual([]);
    });
  }

  it("Varian yang tidak sah ditolak dengan pesan yang sama", async () => {
    const email = emailUnik();

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId: "bukan-varian", email }),
    );

    expect(keadaan).toEqual({ email, galat: { checkout: PESAN_TIDAK_DIJUAL } });
  });

  // ADR-0004: bila Qrispy gagal, tidak ada Pesanan yang tersisa, dan Pembeli diminta mencoba lagi.
  it("bila QRIS gagal dibuat, Pembeli melihat pesan untuk mencoba lagi, dan Pesanan tidak dibuat", async () => {
    const varianId = await netflixSatuBulan();
    const email = emailUnik();
    vi.spyOn(qrispyTiruan, "buatQris").mockRejectedValueOnce(
      new Error("Qrispy tiruan dibuat gagal: tidak menjawab"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId, email }),
    );

    expect(keadaan).toEqual({
      email,
      galat: {
        checkout:
          "QRIS gagal dibuat, jadi Pesanan belum dibuat. Tekan Bayar dengan QRIS untuk mencoba lagi.",
      },
    });
    expect(await pesananDenganEmail(email)).toEqual([]);
  });
});
