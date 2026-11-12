import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { db, koneksi } from "@/server/db";
import { pesanan, varian } from "@/server/db/schema";
import { qrispyTiruan } from "@/server/qrispy-tiruan";
import { sisipkanProduk } from "@/server/uji-katalog";

import { aksiCheckout } from "./aksi";

// Test integrasi Server Action checkout dengan database app_test dan Qrispy tiruan dari .env.ci
// (QRISPY_MODE=tiruan). Data Produknya mengikuti persiapan bersama di docs/UAT.md, yang bertanda [CONTOH].
// Cookie yang dibaca dan ditulis aksi lewat next/headers diganti dengan cookie satu browser tiruan.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

type TokoCookie = Awaited<ReturnType<typeof cookies>>;
type OpsiCookie = NonNullable<Parameters<TokoCookie["set"]>[2]>;

/** Browser tiruan dengan cookie-nya sendiri. Setelah `pakai()`, aksi membaca dan menulis cookie browser ini. */
function browserBaru() {
  const isi = new Map<string, { value: string; opsi?: OpsiCookie }>();
  const toko = {
    get: (nama: string) => {
      const cookie = isi.get(nama);
      return cookie && { name: nama, value: cookie.value };
    },
    set: (nama: string, value: string, opsi?: OpsiCookie) => {
      isi.set(nama, { value, opsi });
    },
  };
  return {
    isi,
    pakai: () =>
      vi.mocked(cookies).mockResolvedValue(toko as unknown as TokoCookie),
  };
}

afterAll(async () => {
  await koneksi.end();
});

beforeEach(() => {
  browserBaru().pakai();
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
  Tersedia = 10,
} = {}) {
  const produkId = await sisipkanProduk({
    nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
    aktif: produkAktif,
    varian: [
      {
        nama: "1 Bulan",
        hargaJual: 50000,
        aktif: varianAktif,
        Tersedia,
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

  it("form tanpa isian email ditolak dengan pesan email belum diisi", async () => {
    const varianId = await netflixSatuBulan();

    const keadaan = await aksiCheckout(keadaanAwal(), formulir({ varianId }));

    expect(keadaan).toEqual({
      email: "",
      galat: {
        email:
          "Email belum diisi. Tulis email Anda, misalnya nama@email.com, supaya detail pesanan bisa dikirim.",
      },
    });
  });

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

  // PRD §5.2: checkout ditolak bila Stok Varian-nya 0.
  it("checkout Varian dengan Stok Varian 0 ditolak dengan pesan stok habis, tanpa QRIS maupun Pesanan", async () => {
    const varianId = await netflixSatuBulan({ Tersedia: 0 });
    const email = emailUnik();
    const buatQris = vi.spyOn(qrispyTiruan, "buatQris");

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId, email }),
    );

    expect(keadaan).toEqual({
      email,
      galat: {
        checkout:
          "Stok Varian ini sudah habis, jadi Pesanan tidak dibuat. Pilih Varian lain, atau Produk lain di Beranda.",
      },
    });
    expect(buatQris).not.toHaveBeenCalled();
    expect(await pesananDenganEmail(email)).toEqual([]);
  });

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

// PRD §5.4 ▶ Keputusan 2026-11-11 dan UAT-E2: satu email hanya boleh punya 1 Pesanan Menunggu Pembayaran,
// dan Pembeli hanya diarahkan ke Pesanan itu dari browser tempat Pesanan itu dibuat.
describe("checkout dengan email yang masih punya Pesanan Menunggu Pembayaran (PRD §5.4)", () => {
  /** Checkout Varian itu sampai Pembeli diarahkan ke Tautan Pesanan. Hasilnya Tautan Pesanan itu. */
  async function checkoutSampaiDiarahkan(varianId: string, email: string) {
    const alamat = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId, email }),
    ).then(
      (keadaan) => {
        throw new Error(`Checkout tidak diarahkan: ${JSON.stringify(keadaan)}`);
      },
      (galat: unknown) => alamatPengalihan(galat),
    );
    return alamat.replace("/pesanan/", "");
  }

  const statusPesananDenganEmail = (...tulisan: string[]) =>
    db
      .select({ status: pesanan.status })
      .from(pesanan)
      .where(inArray(pesanan.email, tulisan));

  it("checkout menyimpan Tautan Pesanan-nya di cookie httpOnly browser itu", async () => {
    const browser = browserBaru();
    browser.pakai();

    const tautan = await checkoutSampaiDiarahkan(
      await netflixSatuBulan(),
      emailUnik(),
    );

    const cookie = [...browser.isi.values()];
    expect(cookie).toHaveLength(1);
    expect(cookie[0].value).toContain(tautan);
    expect(cookie[0].opsi).toMatchObject({ httpOnly: true });
  });

  it("checkout lagi dari tab baru di browser yang sama, dengan email yang ditulis huruf besar, diarahkan ke Pesanan yang masih menunggu", async () => {
    const browser = browserBaru();
    browser.pakai();
    const email = emailUnik();
    const tautan = await checkoutSampaiDiarahkan(
      await netflixSatuBulan(),
      email,
    );
    const buatQris = vi.spyOn(qrispyTiruan, "buatQris");

    const tautanKedua = await checkoutSampaiDiarahkan(
      await netflixSatuBulan(),
      email.toUpperCase(),
    );

    expect(tautanKedua).toBe(tautan);
    expect(buatQris).not.toHaveBeenCalled();
    expect(await statusPesananDenganEmail(email, email.toUpperCase())).toEqual([
      { status: "Menunggu Pembayaran" },
    ]);
  });

  it("browser yang membuat Pesanan untuk dua email diarahkan ke Pesanan milik email yang diketik", async () => {
    const browser = browserBaru();
    browser.pakai();
    const [emailA, emailB] = [emailUnik(), emailUnik()];
    const tautanA = await checkoutSampaiDiarahkan(
      await netflixSatuBulan(),
      emailA,
    );
    const tautanB = await checkoutSampaiDiarahkan(
      await netflixSatuBulan(),
      emailB,
    );

    expect(
      await checkoutSampaiDiarahkan(await netflixSatuBulan(), emailA),
    ).toBe(tautanA);
    expect(
      await checkoutSampaiDiarahkan(await netflixSatuBulan(), emailB),
    ).toBe(tautanB);
  });

  it("checkout dengan email yang sama dari browser lain ditolak dengan pesan PRD §5.4 yang memuat jam kedaluwarsa dalam WIB", async () => {
    // Contoh PRD §5.4: QRIS-nya kedaluwarsa pukul 10.15 WIB.
    const terbitkan = qrispyTiruan.buatQris;
    vi.spyOn(qrispyTiruan, "buatQris").mockImplementationOnce(
      async (permintaan) => ({
        ...(await terbitkan(permintaan)),
        expiredAt: new Date("2026-11-11T10:15:00+07:00"),
      }),
    );
    const email = emailUnik();
    await checkoutSampaiDiarahkan(await netflixSatuBulan(), email);
    browserBaru().pakai();

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId: await netflixSatuBulan(), email }),
    );

    expect(keadaan).toEqual({
      email,
      galat: {
        checkout:
          "Email ini masih punya Pesanan yang menunggu pembayaran sampai pukul 10.15 WIB. Lanjutkan dari perangkat tempat Anda memesan, atau checkout lagi setelah waktu itu.",
      },
    });
    expect(await statusPesananDenganEmail(email)).toEqual([
      { status: "Menunggu Pembayaran" },
    ]);
  });

  // ▶ Keputusan 2026-11-12 (#87): aturan §5.4 didahulukan sebelum penolakan karena Stok Varian 0 (§5.2).
  // Contoh PRD: Item stok terakhir Netflix Premium 1 Bulan sedang ditahan Pesanan Andi.
  describe("saat Item stok terakhir Varian itu ditahan Pesanan email itu", () => {
    it("checkout lagi Varian itu dari browser yang sama diarahkan ke Halaman bayar Pesanan itu, tanpa QRIS baru", async () => {
      browserBaru().pakai();
      const varianId = await netflixSatuBulan({ Tersedia: 1 });
      const email = emailUnik();
      const tautan = await checkoutSampaiDiarahkan(varianId, email);
      const buatQris = vi.spyOn(qrispyTiruan, "buatQris");

      expect(await checkoutSampaiDiarahkan(varianId, email)).toBe(tautan);
      expect(buatQris).not.toHaveBeenCalled();
      expect(await statusPesananDenganEmail(email)).toEqual([
        { status: "Menunggu Pembayaran" },
      ]);
    });

    it('checkout lagi Varian itu dari browser lain ditolak dengan pesan "… sampai pukul HH.MM WIB …", bukan pesan stok habis, tanpa QRIS baru', async () => {
      // Contoh PRD §5.4: QRIS-nya kedaluwarsa pukul 10.15 WIB.
      const terbitkan = qrispyTiruan.buatQris;
      const buatQris = vi
        .spyOn(qrispyTiruan, "buatQris")
        .mockImplementationOnce(async (permintaan) => ({
          ...(await terbitkan(permintaan)),
          expiredAt: new Date("2026-11-11T10:15:00+07:00"),
        }));
      const varianId = await netflixSatuBulan({ Tersedia: 1 });
      const email = emailUnik();
      await checkoutSampaiDiarahkan(varianId, email);
      buatQris.mockClear();
      browserBaru().pakai();

      const keadaan = await aksiCheckout(
        keadaanAwal(),
        formulir({ varianId, email }),
      );

      expect(keadaan).toEqual({
        email,
        galat: {
          checkout:
            "Email ini masih punya Pesanan yang menunggu pembayaran sampai pukul 10.15 WIB. Lanjutkan dari perangkat tempat Anda memesan, atau checkout lagi setelah waktu itu.",
        },
      });
      expect(buatQris).not.toHaveBeenCalled();
      expect(await statusPesananDenganEmail(email)).toEqual([
        { status: "Menunggu Pembayaran" },
      ]);
    });

    it("email lain tanpa Pesanan menunggu yang checkout Varian itu tetap mendapat pesan stok habis, tanpa QRIS", async () => {
      const varianId = await netflixSatuBulan({ Tersedia: 1 });
      await checkoutSampaiDiarahkan(varianId, emailUnik());
      const emailLain = emailUnik();
      const buatQris = vi.spyOn(qrispyTiruan, "buatQris");

      const keadaan = await aksiCheckout(
        keadaanAwal(),
        formulir({ varianId, email: emailLain }),
      );

      expect(keadaan).toEqual({
        email: emailLain,
        galat: {
          checkout:
            "Stok Varian ini sudah habis, jadi Pesanan tidak dibuat. Pilih Varian lain, atau Produk lain di Beranda.",
        },
      });
      expect(buatQris).not.toHaveBeenCalled();
      expect(await statusPesananDenganEmail(emailLain)).toEqual([]);
    });
  });
});
