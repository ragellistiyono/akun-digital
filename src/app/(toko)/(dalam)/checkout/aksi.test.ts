import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { auth } from "@/server/auth/auth";
import { db, koneksi } from "@/server/db";
import {
  itemStok,
  pesanan,
  riwayatSaldo,
  riwayatStatusPesanan,
  user,
  varian,
  voucher,
} from "@/server/db/schema";
import { pekerjaanEmailPesananSelesai } from "@/server/pekerjaan-latar";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { qrispyTiruan } from "@/server/qrispy-tiruan";
import { ubahSaldoOlehAdmin } from "@/server/saldo";
import { ubahStatusMember } from "@/server/status-member";
import { buatVoucher, type SyaratVoucher } from "@/server/voucher";
import { sisipkanProduk } from "@/server/uji-katalog";
import { sisipkanMember } from "@/server/uji-member";
import { checkoutTertahan } from "@/server/uji-pesanan";

import { aksiCheckout, aksiPakaiVoucher } from "./aksi";

// Test integrasi Server Action checkout dengan database app_test dan Qrispy tiruan dari .env.ci
// (QRISPY_MODE=tiruan). Data Produknya mengikuti persiapan bersama di docs/UAT.md, yang bertanda [CONTOH].
// Cookie yang dibaca dan ditulis aksi lewat next/headers diganti dengan cookie satu browser tiruan, dan
// header permintaannya diganti dengan cookie sesi milik pengunjung (tanpa sesi berarti Tamu).
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
// Baris Pengaturan toko dipakai bersama test lain yang berjalan bersamaan (pengaturan/aksi.test.ts menimpanya), jadi
// nomor WhatsApp diatur lewat bacaPengaturanToko tiruan.
vi.mock("@/server/pengaturan-toko", async (asli) => ({
  ...(await asli<typeof import("@/server/pengaturan-toko")>()),
  bacaPengaturanToko: vi.fn(),
}));

const NOMOR_WHATSAPP = "6281234567890";

/** Pengaturan toko tiruan dengan nomor WhatsApp itu. `null` berarti nomornya belum diisi. */
function pakaiNomorWhatsapp(nomorWhatsapp: string | null) {
  vi.mocked(bacaPengaturanToko).mockResolvedValue({
    nomorWhatsapp,
    syaratKetentuan: "",
    kebijakanPrivasi: "",
    ambangStokMenipis: 5,
  });
}

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
  vi.mocked(headers).mockResolvedValue(new Headers());
  pakaiNomorWhatsapp(NOMOR_WHATSAPP);
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

const keadaanAwal = () => ({ email: "", kodeVoucher: "" });

const PESAN_TIDAK_DIJUAL =
  "Produk atau Varian ini sedang tidak dijual, jadi Pesanan tidak dibuat. Pilih Produk lain di Beranda.";

/** Pesan bila checkout QRIS atau saldo dikirim untuk Varian Produk gratis (PRD §16). */
const PESAN_PRODUK_GRATIS =
  "Produk ini sekarang gratis khusus Member, jadi Pesanan tidak dibuat. Buka lagi Halaman Produk untuk mengambilnya.";

/**
 * Varian "Akun Baru" Produk gratis baru yang meniru Akun Uji Gratis dari persiapan M6 [CONTOH]: Harga jual Rp 1.000,
 * Batas per Member 2, dan 5 Item stok Tersedia. Hasilnya id Varian itu.
 */
async function varianAkunUjiGratis() {
  const produkId = await sisipkanProduk({
    nama: `Akun Uji Gratis ${randomUUID().slice(0, 8)}`,
    batasPerMember: 2,
    varian: [
      { nama: "Akun Baru", hargaJual: 1000, hargaNormal: 15000, Tersedia: 5 },
    ],
  });
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return id;
}

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

      expect(keadaan).toEqual({
        email,
        kodeVoucher: "",
        galat: { email: pesan },
      });
      expect(buatQris).not.toHaveBeenCalled();
    });
  }

  it("form tanpa isian email ditolak dengan pesan email belum diisi", async () => {
    const varianId = await netflixSatuBulan();

    const keadaan = await aksiCheckout(keadaanAwal(), formulir({ varianId }));

    expect(keadaan).toEqual({
      email: "",
      kodeVoucher: "",
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
        kodeVoucher: "",
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
      kodeVoucher: "",
      galat: {
        checkout:
          "Stok Varian ini sudah habis, jadi Pesanan tidak dibuat. Pilih Varian lain, atau Produk lain di Beranda.",
      },
    });
    expect(buatQris).not.toHaveBeenCalled();
    expect(await pesananDenganEmail(email)).toEqual([]);
  });

  // PRD §16: Produk gratis hanya diambil lewat "Ambil gratis", tanpa QRIS, misalnya bila form checkout dibuka
  // sebelum Produk itu dijadikan gratis.
  it("checkout QRIS untuk Varian Produk gratis ditolak dengan pesan, tanpa QRIS maupun Pesanan", async () => {
    const varianId = await varianAkunUjiGratis();
    const email = emailUnik();
    const buatQris = vi.spyOn(qrispyTiruan, "buatQris");

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId, email }),
    );

    expect(keadaan).toEqual({
      email,
      kodeVoucher: "",
      galat: { checkout: PESAN_PRODUK_GRATIS },
    });
    expect(buatQris).not.toHaveBeenCalled();
    expect(await pesananDenganEmail(email)).toEqual([]);
  });

  /** Member nonaktif baru. Hasilnya email Member itu. */
  async function memberNonaktifBaru() {
    const email = emailUnik();
    await sisipkanMember({ email, password: "sandi-uji-member-123" });
    const [{ id }] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    await ubahStatusMember({ idMember: id, nonaktif: true });
    return email;
  }

  // PRD §5.2 ▶ Keputusan 2026-11-17, UAT-B3 langkah 5.
  it("Tamu yang checkout dengan email Member nonaktif yang ditulis huruf besar ditolak dengan pesan Member nonaktif beserta nomor WhatsApp untuk tombolnya, tanpa QRIS maupun Pesanan", async () => {
    const varianId = await netflixSatuBulan();
    const email = await memberNonaktifBaru();
    const buatQris = vi.spyOn(qrispyTiruan, "buatQris");

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId, email: email.toUpperCase() }),
    );

    expect(keadaan).toEqual({
      email: email.toUpperCase(),
      kodeVoucher: "",
      galat: {
        checkout:
          "Email ini milik Member yang dinonaktifkan, jadi Pesanan tidak dibuat. Hubungi kami di WhatsApp.",
      },
      nomorWhatsapp: NOMOR_WHATSAPP,
    });
    expect(buatQris).not.toHaveBeenCalled();
    expect(
      await db
        .select({ id: pesanan.id })
        .from(pesanan)
        .where(inArray(pesanan.email, [email, email.toUpperCase()])),
    ).toEqual([]);
  });

  // PRD §5.2 ▶ Keputusan 2026-11-17 dan §9.8: tanpa nomor WhatsApp, hanya pesannya yang tampil.
  it("selama nomor WhatsApp belum diisi, checkout dengan email Member nonaktif ditolak dengan pesan Member nonaktif tanpa nomor WhatsApp", async () => {
    pakaiNomorWhatsapp(null);
    const varianId = await netflixSatuBulan();
    const email = await memberNonaktifBaru();

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId, email }),
    );

    expect(keadaan).toEqual({
      email,
      kodeVoucher: "",
      galat: {
        checkout:
          "Email ini milik Member yang dinonaktifkan, jadi Pesanan tidak dibuat. Hubungi kami di WhatsApp.",
      },
      nomorWhatsapp: null,
    });
  });

  it("Varian yang tidak sah ditolak dengan pesan yang sama", async () => {
    const email = emailUnik();

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId: "bukan-varian", email }),
    );

    expect(keadaan).toEqual({
      email,
      kodeVoucher: "",
      galat: { checkout: PESAN_TIDAK_DIJUAL },
    });
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
      kodeVoucher: "",
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
      kodeVoucher: "",
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
        kodeVoucher: "",
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
        kodeVoucher: "",
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

// PRD §5.2: bila Member sedang login, emailnya sudah terisi dan tidak bisa diubah. Server memakai email dari
// sesi Member, bukan dari isian form, jadi email lain yang dikirim lewat alat browser tidak dipakai.
describe("checkout dari sesi Member (PRD §5.2)", () => {
  const PASSWORD_MEMBER = "sandi-uji-member-123";

  /** Member terverifikasi baru yang sedang login. Setelah ini, aksi membaca sesi Member itu. */
  async function memberLogin() {
    const email = `member-${randomUUID()}@example.test`;
    await sisipkanMember({ email, password: PASSWORD_MEMBER });
    const { headers: kepalaRespons } = await auth.api.signInEmail({
      body: { email, password: PASSWORD_MEMBER },
      returnHeaders: true,
    });
    // Ambil pasangan nama=nilai cookie sesi dari Set-Cookie, seperti yang dikirim browser kembali.
    const cookie = kepalaRespons
      .getSetCookie()
      .map((baris) => baris.split(";")[0])
      .join("; ");
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }));
    return email;
  }

  it("Member yang mengirim email lain tetap membuat Pesanan dengan email Member, bukan email kiriman itu", async () => {
    const varianId = await netflixSatuBulan();
    const emailMember = await memberLogin();
    const emailLain = emailUnik();

    const alamat = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId, email: emailLain }),
    ).then(
      () => null,
      (galat: unknown) => alamatPengalihan(galat),
    );

    expect(alamat).toMatch(/^\/pesanan\/[A-Za-z0-9_-]{43}$/);
    expect(await pesananDenganEmail(emailMember)).toEqual([
      { email: emailMember, status: "Menunggu Pembayaran" },
    ]);
    expect(await pesananDenganEmail(emailLain)).toEqual([]);
  });

  // PRD §5.4 berlaku untuk email Member seperti biasa, walaupun form mengirim email lain.
  it("Member yang checkout lagi dari browser yang sama, dengan email lain di form, diarahkan ke Pesanannya yang masih menunggu", async () => {
    const emailMember = await memberLogin();
    const pertama = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId: await netflixSatuBulan(), email: emailUnik() }),
    ).catch((galat: unknown) => alamatPengalihan(galat));
    const buatQris = vi.spyOn(qrispyTiruan, "buatQris");

    const kedua = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId: await netflixSatuBulan(), email: emailUnik() }),
    ).catch((galat: unknown) => alamatPengalihan(galat));

    expect(kedua).toBe(pertama);
    expect(buatQris).not.toHaveBeenCalled();
    expect(await pesananDenganEmail(emailMember)).toEqual([
      { email: emailMember, status: "Menunggu Pembayaran" },
    ]);
  });

  it("Member yang checkout lagi dari browser lain, dengan email lain di form, ditolak dengan pesan PRD §5.4 yang memuat jam kedaluwarsa dalam WIB", async () => {
    // Contoh PRD §5.4: QRIS-nya kedaluwarsa pukul 10.15 WIB.
    const terbitkan = qrispyTiruan.buatQris;
    vi.spyOn(qrispyTiruan, "buatQris").mockImplementationOnce(
      async (permintaan) => ({
        ...(await terbitkan(permintaan)),
        expiredAt: new Date("2026-11-11T10:15:00+07:00"),
      }),
    );
    const emailMember = await memberLogin();
    await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId: await netflixSatuBulan(), email: emailMember }),
    ).catch((galat: unknown) => alamatPengalihan(galat));
    browserBaru().pakai();

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId: await netflixSatuBulan(), email: emailUnik() }),
    );

    expect(keadaan).toEqual({
      email: emailMember,
      kodeVoucher: "",
      galat: {
        checkout:
          "Email ini masih punya Pesanan yang menunggu pembayaran sampai pukul 10.15 WIB. Lanjutkan dari perangkat tempat Anda memesan, atau checkout lagi setelah waktu itu.",
      },
    });
    expect(await pesananDenganEmail(emailMember)).toEqual([
      { email: emailMember, status: "Menunggu Pembayaran" },
    ]);
  });
});

// T57: kode voucher di form Checkout diperiksa saat Pesanan dibuat (PRD §5.2 ▶ Keputusan 2026-11-17, §8.7 ▶
// Keputusan 2026-11-17, UAT-H1–UAT-H4). Voucher-nya meniru Voucher seed docs/UAT.md [CONTOH] dengan kode unik.
describe("checkout dengan kode voucher (PRD §8)", () => {
  const HEMAT5: SyaratVoucher = {
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

  /** Membuat Voucher dengan syarat HEMAT5 yang diganti sebagian. Hasilnya kodenya. */
  async function voucherBaru(
    awalan: string,
    syarat: Partial<SyaratVoucher> = {},
  ) {
    const kode = `${awalan}${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    await buatVoucher({ kode, ...HEMAT5, ...syarat });
    const [{ id }] = await db
      .select({ id: voucher.id })
      .from(voucher)
      .where(eq(voucher.kode, kode));
    return { id, kode };
  }

  function pesananDenganVoucher(email: string) {
    return db
      .select({
        potonganVoucher: pesanan.potonganVoucher,
        kodeVoucher: pesanan.kodeVoucher,
      })
      .from(pesanan)
      .where(eq(pesanan.email, email));
  }

  it("HEMAT5 yang ditulis huruf kecil membuat Pesanan dengan potongan Rp 5.000, lalu Pembeli diarahkan ke Tautan Pesanan", async () => {
    const hemat5 = await voucherBaru("HEMAT");
    const email = emailUnik();

    const alamat = await aksiCheckout(
      keadaanAwal(),
      formulir({
        varianId: await netflixSatuBulan(),
        email,
        kodeVoucher: hemat5.kode.toLowerCase(),
      }),
    ).then(
      () => null,
      (galat: unknown) => alamatPengalihan(galat),
    );

    expect(alamat).toMatch(/^\/pesanan\/[A-Za-z0-9_-]{43}$/);
    expect(await pesananDenganVoucher(email)).toEqual([
      { potonganVoucher: 5000, kodeVoucher: hemat5.kode },
    ]);
  });

  it("Voucher yang ditolak tidak membuat Pesanan, menampilkan pesan penolakannya di isian kode, dan isian kode tetap berisi", async () => {
    const lama = await voucherBaru("LAMA", {
      berakhir: new Date("2026-11-10T10:00:00+07:00"),
    });
    const email = emailUnik();
    const buatQris = vi.spyOn(qrispyTiruan, "buatQris");
    const kodeDiketik = lama.kode.toLowerCase();

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({
        varianId: await netflixSatuBulan(),
        email,
        kodeVoucher: kodeDiketik,
      }),
    );

    expect(keadaan).toEqual({
      email,
      kodeVoucher: kodeDiketik,
      galat: { kodeVoucher: "Voucher sudah berakhir" },
    });
    expect(buatQris).not.toHaveBeenCalled();
    expect(await pesananDenganEmail(email)).toEqual([]);
  });

  it("isian kode tetap berisi saat checkout ditolak karena email salah tulis", async () => {
    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({
        varianId: await netflixSatuBulan(),
        email: "budi@",
        kodeVoucher: "HEMAT5",
      }),
    );

    expect(keadaan).toMatchObject({ kodeVoucher: "HEMAT5" });
  });

  it("Pembeli yang masih punya Pesanan menunggu dan checkout lagi dari browser yang sama dengan Voucher yang sudah berakhir diarahkan ke Pesanannya", async () => {
    const lama = await voucherBaru("LAMA", {
      berakhir: new Date("2026-11-10T10:00:00+07:00"),
    });
    const email = emailUnik();
    const pertama = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId: await netflixSatuBulan(), email }),
    ).catch((galat: unknown) => alamatPengalihan(galat));

    const kedua = await aksiCheckout(
      keadaanAwal(),
      formulir({
        varianId: await netflixSatuBulan(),
        email,
        kodeVoucher: lama.kode,
      }),
    ).catch((galat: unknown) => alamatPengalihan(galat));

    expect(kedua).toBe(pertama);
  });

  it("Voucher khusus Member ditolak untuk Tamu dengan tanda tautan Masuk, dan diterima untuk Member yang login", async () => {
    const member20 = await voucherBaru("MEMBER", {
      jenisPotongan: "persen",
      nilai: 20,
      batasMaksimum: 10000,
      khususMember: true,
    });
    const varianId = await netflixSatuBulan();
    const emailTamu = emailUnik();

    expect(
      await aksiCheckout(
        keadaanAwal(),
        formulir({ varianId, email: emailTamu, kodeVoucher: member20.kode }),
      ),
    ).toEqual({
      email: emailTamu,
      kodeVoucher: member20.kode,
      galat: { kodeVoucher: "Voucher khusus Member, silakan login" },
      voucherKhususMember: true,
    });

    const email = `member-${randomUUID()}@example.test`;
    await sisipkanMember({ email, password: "sandi-uji-member-123" });
    const { headers: kepalaRespons } = await auth.api.signInEmail({
      body: { email, password: "sandi-uji-member-123" },
      returnHeaders: true,
    });
    vi.mocked(headers).mockResolvedValue(
      new Headers({
        cookie: kepalaRespons
          .getSetCookie()
          .map((baris) => baris.split(";")[0])
          .join("; "),
      }),
    );
    await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId, email, kodeVoucher: member20.kode }),
    ).catch((galat: unknown) => alamatPengalihan(galat));

    expect(await pesananDenganVoucher(email)).toEqual([
      { potonganVoucher: 10000, kodeVoucher: member20.kode },
    ]);
  });
  // Tombol "Pakai" di samping isian kode voucher (PRD §8.7 ▶ Keputusan 2026-11-17, UAT-H1, UAT-H3, UAT-H4).
  describe("aksiPakaiVoucher", () => {
    it("HEMAT5 untuk Netflix Premium 1 Bulan diterima dengan potongan Rp 5.000, dan Perkiraan bayar menjadi Rp 45.000", async () => {
      const hemat5 = await voucherBaru("HEMAT");

      expect(
        await aksiPakaiVoucher({
          varianId: await netflixSatuBulan(),
          kode: hemat5.kode.toLowerCase(),
          email: "",
        }),
      ).toEqual({
        diterima: true,
        kodeVoucher: hemat5.kode,
        hargaJual: 50000,
        potonganVoucher: 5000,
        perkiraanBayar: 45000,
        // Tamu tidak bisa membayar dengan saldo (PRD §15.7).
        saldo: null,
      });
    });

    it('LAMA yang sudah berakhir ditolak dengan "Voucher sudah berakhir"', async () => {
      const lama = await voucherBaru("LAMA", {
        berakhir: new Date("2026-11-10T10:00:00+07:00"),
      });

      expect(
        await aksiPakaiVoucher({
          varianId: await netflixSatuBulan(),
          kode: lama.kode,
          email: emailUnik(),
        }),
      ).toEqual({
        diterima: false,
        pesan: "Voucher sudah berakhir",
        khususMember: false,
      });
    });

    it("MEMBER20 ditolak untuk Tamu dengan tanda tautan Masuk, dan diterima dengan potongan Rp 10.000 setelah Member login", async () => {
      const member20 = await voucherBaru("MEMBER", {
        jenisPotongan: "persen",
        nilai: 20,
        khususMember: true,
      });
      const varianId = await netflixSatuBulan();

      expect(
        await aksiPakaiVoucher({ varianId, kode: member20.kode, email: "" }),
      ).toEqual({
        diterima: false,
        pesan: "Voucher khusus Member, silakan login",
        khususMember: true,
      });

      const email = `member-${randomUUID()}@example.test`;
      await sisipkanMember({ email, password: "sandi-uji-member-123" });
      const { headers: kepalaRespons } = await auth.api.signInEmail({
        body: { email, password: "sandi-uji-member-123" },
        returnHeaders: true,
      });
      vi.mocked(headers).mockResolvedValue(
        new Headers({
          cookie: kepalaRespons
            .getSetCookie()
            .map((baris) => baris.split(";")[0])
            .join("; "),
        }),
      );

      expect(
        await aksiPakaiVoucher({ varianId, kode: member20.kode, email }),
      ).toMatchObject({ diterima: true, potonganVoucher: 10000 });
    });

    it("Batas per email hanya diperiksa bila email sudah diisi", async () => {
      const hemat5 = await voucherBaru("HEMAT");
      const varianId = await netflixSatuBulan();
      const email = emailUnik();
      await aksiCheckout(
        keadaanAwal(),
        formulir({ varianId, email, kodeVoucher: hemat5.kode }),
      ).catch((galat: unknown) => alamatPengalihan(galat));

      expect(
        await aksiPakaiVoucher({ varianId, kode: hemat5.kode, email: "  " }),
      ).toMatchObject({ diterima: true, potonganVoucher: 5000 });
      expect(
        await aksiPakaiVoucher({ varianId, kode: hemat5.kode, email }),
      ).toEqual({
        diterima: false,
        pesan: "Anda sudah memakai voucher ini",
        khususMember: false,
      });
    });

    // UAT-H4 langkah 6.
    it('SATUKALI yang diterima "Pakai" tetapi kuotanya habis sebelum Pesanan dibuat ditolak dengan "Kuota voucher habis", dan Pesanan tidak dibuat', async () => {
      const satukali = await voucherBaru("SATUKALI", { kuotaVoucher: 1 });
      const varianId = await netflixSatuBulan();
      const emailA = emailUnik();

      expect(
        await aksiPakaiVoucher({
          varianId,
          kode: satukali.kode,
          email: emailA,
        }),
      ).toMatchObject({ diterima: true, potonganVoucher: 5000 });

      // Pembeli lain di browser lain memakai kuota terakhirnya lebih dulu.
      browserBaru().pakai();
      await aksiCheckout(
        keadaanAwal(),
        formulir({ varianId, email: emailUnik(), kodeVoucher: satukali.kode }),
      ).catch((galat: unknown) => alamatPengalihan(galat));

      browserBaru().pakai();
      expect(
        await aksiCheckout(
          keadaanAwal(),
          formulir({ varianId, email: emailA, kodeVoucher: satukali.kode }),
        ),
      ).toEqual({
        email: emailA,
        kodeVoucher: satukali.kode,
        galat: { kodeVoucher: "Kuota voucher habis" },
      });
      expect(await pesananDenganEmail(emailA)).toEqual([]);
    });

    it("Varian yang tidak ada ditolak dengan pesan tidak dijual", async () => {
      expect(
        await aksiPakaiVoucher({
          varianId: randomUUID(),
          kode: "HEMAT5",
          email: "",
        }),
      ).toEqual({
        diterima: false,
        pesan: PESAN_TIDAK_DIJUAL,
        khususMember: false,
      });
    });
  });
});

// Bayar dengan saldo (T80, PRD §5.2 ▶ Keputusan 2026-11-20, §5.7, §15.7, UAT-O6, UAT-O7). Produk dan Voucher-nya
// meniru persiapan bersama docs/UAT.md [CONTOH]: Uji Bayar Rp 1.000, Netflix Premium 1 Bulan Rp 50.000, dan HEMAT10
// (10% maksimal Rp 10.000, minimal Harga jual Rp 50.000), dengan kode unik per test.
describe("bayar dengan saldo (PRD §15.7)", () => {
  const PASSWORD_MEMBER = "sandi-uji-member-123";

  /** Member terverifikasi baru yang sedang login dengan saldo itu. Setelah ini, aksi membaca sesi Member itu. */
  async function memberLoginDenganSaldo(saldo: number) {
    const email = `member-${randomUUID()}@example.test`;
    await sisipkanMember({ email, password: PASSWORD_MEMBER });
    const [{ id }] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    if (saldo > 0) {
      await ubahSaldoOlehAdmin({
        idMember: id,
        aksi: "tambah",
        nominal: String(saldo),
        keterangan: "Saldo awal test",
      });
    }
    const { headers: kepalaRespons } = await auth.api.signInEmail({
      body: { email, password: PASSWORD_MEMBER },
      returnHeaders: true,
    });
    const cookie = kepalaRespons
      .getSetCookie()
      .map((baris) => baris.split(";")[0])
      .join("; ");
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }));
    return { email, id };
  }

  async function saldoMember(id: string) {
    const [{ saldo }] = await db
      .select({ saldo: user.saldo })
      .from(user)
      .where(eq(user.id, id));
    return saldo;
  }

  function barisRiwayatSaldo(id: string) {
    return db
      .select({
        jenis: riwayatSaldo.jenis,
        nominal: riwayatSaldo.nominal,
        saldoSesudah: riwayatSaldo.saldoSesudah,
        rujukan: riwayatSaldo.rujukan,
      })
      .from(riwayatSaldo)
      .where(eq(riwayatSaldo.userId, id))
      .orderBy(riwayatSaldo.id);
  }

  async function varianBaru(nama: string, hargaJual: number, Tersedia = 10) {
    const produkId = await sisipkanProduk({
      nama: `${nama} ${randomUUID().slice(0, 8)}`,
      varian: [{ nama: "1 Bulan", hargaJual, Tersedia }],
    });
    const [{ id }] = await db
      .select({ id: varian.id })
      .from(varian)
      .where(eq(varian.produkId, produkId));
    return id;
  }

  async function hemat10() {
    const kode = `HEMAT10${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    await buatVoucher({
      kode,
      jenisPotongan: "persen",
      nilai: 10,
      batasMaksimum: 10000,
      kuotaVoucher: null,
      batasPerEmail: 1,
      minimalHargaJual: 50000,
      mulai: null,
      berakhir: null,
      cakupan: { jenis: "semua" },
      khususMember: false,
      aktif: true,
    });
    return kode;
  }

  it("bayar dengan saldo untuk Varian Produk gratis ditolak dengan pesan, saldo tidak berubah, dan Pesanan tidak dibuat", async () => {
    const varianId = await varianAkunUjiGratis();
    const member = await memberLoginDenganSaldo(5000);

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId, metode: "Saldo" }),
    );

    expect(keadaan.galat).toEqual({ checkout: PESAN_PRODUK_GRATIS });
    expect(await saldoMember(member.id)).toBe(5000);
    expect(await pesananDenganEmail(member.email)).toEqual([]);
  });

  it("Member dengan saldo cukup membeli Uji Bayar dengan saldo: Pesanan langsung Selesai tanpa QRIS, Item stok Terkirim, saldo berkurang Rp 1.000, dan Riwayat saldo mencatat Pembelian dengan Nomor Pesanan", async () => {
    const varianId = await varianBaru("Uji Bayar", 1000);
    const member = await memberLoginDenganSaldo(5000);
    const buatQris = vi.spyOn(qrispyTiruan, "buatQris");

    const alamat = await aksiCheckout(
      keadaanAwal(),
      formulir({ varianId, email: member.email, metode: "Saldo" }),
    ).then(
      () => null,
      (galat: unknown) => alamatPengalihan(galat),
    );

    expect(alamat).toMatch(/^\/pesanan\/[A-Za-z0-9_-]{43}$/);
    expect(buatQris).not.toHaveBeenCalled();
    const [dibuat] = await db
      .select()
      .from(pesanan)
      .where(eq(pesanan.email, member.email));
    expect(dibuat).toMatchObject({
      metode: "Saldo",
      status: "Selesai",
      hargaJual: 1000,
      potonganVoucher: 0,
      kodeUnik: 0,
      biayaTransaksi: 0,
      totalBayar: 1000,
      qrisId: null,
      kedaluwarsaPada: null,
      gambarQr: null,
    });
    expect(alamat).toBe(`/pesanan/${dibuat.tautan}`);
    expect(dibuat.waktuBayar).toBeInstanceOf(Date);
    expect(
      await db
        .select({
          waktu: riwayatStatusPesanan.waktu,
          status: riwayatStatusPesanan.status,
          pelaku: riwayatStatusPesanan.pelaku,
        })
        .from(riwayatStatusPesanan)
        .where(eq(riwayatStatusPesanan.pesananId, dibuat.id)),
    ).toEqual([
      {
        waktu: dibuat.waktuBayar,
        status: "Selesai",
        pelaku: "Pembeli (saldo)",
      },
    ]);
    expect(
      await db
        .select({ status: itemStok.status })
        .from(itemStok)
        .where(eq(itemStok.pesananId, dibuat.id)),
    ).toEqual([{ status: "Terkirim" }]);
    expect(await saldoMember(member.id)).toBe(4000);
    expect(await barisRiwayatSaldo(member.id)).toEqual([
      expect.objectContaining({ jenis: "Ditambah Admin" }),
      {
        jenis: "Pembelian",
        nominal: -1000,
        saldoSesudah: 4000,
        rujukan: dibuat.nomorPesanan,
      },
    ]);
    expect(await pekerjaanEmailPesananSelesai(dibuat.id)).toHaveLength(1);
  });

  // UAT-O7 langkah 3: saldo Rp 45.000 kurang Rp 5.000 untuk Netflix Premium 1 Bulan, tetapi cukup dengan HEMAT10.
  it("saldo Rp 45.000 dengan HEMAT10 membeli Netflix Premium 1 Bulan, dan saldo menjadi Rp 0", async () => {
    const varianId = await varianBaru("Netflix Premium", 50000);
    const kode = await hemat10();
    const member = await memberLoginDenganSaldo(45000);

    const alamat = await aksiCheckout(
      keadaanAwal(),
      formulir({
        varianId,
        email: member.email,
        kodeVoucher: kode,
        metode: "Saldo",
      }),
    ).catch((galat: unknown) => alamatPengalihan(galat));

    expect(alamat).toMatch(/^\/pesanan\//);
    expect(
      await db
        .select({
          potonganVoucher: pesanan.potonganVoucher,
          totalBayar: pesanan.totalBayar,
          kodeVoucher: pesanan.kodeVoucher,
        })
        .from(pesanan)
        .where(eq(pesanan.email, member.email)),
    ).toEqual([
      { potonganVoucher: 5000, totalBayar: 45000, kodeVoucher: kode },
    ]);
    expect(await saldoMember(member.id)).toBe(0);
  });

  // UAT-O7 langkah 4: batas Pesanan menunggu (PRD §5.4) berlaku juga untuk bayar dengan saldo.
  it("Member yang masih punya Pesanan QRIS Menunggu Pembayaran diarahkan ke Pesanan itu saat membayar dengan saldo, dan saldo tidak berubah", async () => {
    const member = await memberLoginDenganSaldo(100000);
    const pertama = await aksiCheckout(
      keadaanAwal(),
      formulir({
        varianId: await varianBaru("YouTube Premium", 35000),
        email: member.email,
        metode: "QRIS",
      }),
    ).catch((galat: unknown) => alamatPengalihan(galat));

    const kedua = await aksiCheckout(
      keadaanAwal(),
      formulir({
        varianId: await varianBaru("Netflix Premium", 50000),
        email: member.email,
        metode: "Saldo",
      }),
    ).catch((galat: unknown) => alamatPengalihan(galat));

    expect(kedua).toBe(pertama);
    expect(await saldoMember(member.id)).toBe(100000);
    expect(await pesananDenganEmail(member.email)).toEqual([
      { email: member.email, status: "Menunggu Pembayaran" },
    ]);
  });

  // UAT-O7 langkah 2 dan 3: kecukupan saldo dihitung ulang setiap kali hasil "Pakai" mengubah potongan.
  it("Pakai HEMAT10 dengan saldo Rp 45.000 untuk Netflix Premium 1 Bulan membuat saldo cukup untuk Rp 45.000", async () => {
    const varianId = await varianBaru("Netflix Premium", 50000);
    const kode = await hemat10();
    await memberLoginDenganSaldo(45000);

    const hasil = await aksiPakaiVoucher({ varianId, kode, email: "" });

    expect(hasil).toMatchObject({
      diterima: true,
      potonganVoucher: 5000,
      saldo: {
        saldo: 45000,
        harusDibayar: 45000,
        saldoCukup: true,
        kurang: 0,
        pilihanAwal: "Saldo",
      },
    });
  });

  it("saldo yang dikurangi Admin sesaat sebelum membayar membuat Pesanan tidak dibuat, menampilkan pesan PRD, dan isian voucher tetap berisi", async () => {
    const varianId = await varianBaru("Netflix Premium", 50000);
    const kode = await hemat10();
    const member = await memberLoginDenganSaldo(50000);
    // Checkout dibuka dengan saldo Rp 50.000, lalu Admin mengurangi Rp 10.000 sebelum Member menekan bayar.
    await ubahSaldoOlehAdmin({
      idMember: member.id,
      aksi: "kurangi",
      nominal: "10000",
      keterangan: "Pengembalian uang",
    });
    const kodeDiketik = kode.toLowerCase();

    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({
        varianId,
        email: member.email,
        kodeVoucher: kodeDiketik,
        metode: "Saldo",
      }),
    );

    expect(keadaan).toEqual({
      email: member.email,
      kodeVoucher: kodeDiketik,
      galat: {
        checkout:
          "Saldo tidak cukup. Saldo Anda Rp 40.000, sedangkan yang harus dibayar Rp 45.000. Top up dulu atau bayar dengan QRIS.",
      },
    });
    expect(await pesananDenganEmail(member.email)).toEqual([]);
    expect(await saldoMember(member.id)).toBe(40000);
  });

  it("bila Item stok terakhir habis tepat saat Pesanan saldo dibuat, saldo tidak berubah dan Pesanan tidak dibuat", async () => {
    const varianId = await varianBaru("Uji Bayar", 1000, 1);
    const member = await memberLoginDenganSaldo(5000);
    // Checkout lain sedang mengunci Item stok terakhir itu, jadi Stok Varian masih 1 saat pemeriksaan pertama.
    const lain = checkoutTertahan(varianId);
    await lain.sudahMenahan;

    try {
      const keadaan = await aksiCheckout(
        keadaanAwal(),
        formulir({ varianId, email: member.email, metode: "Saldo" }),
      );
      expect(keadaan.galat?.checkout).toBe(
        "Stok Varian ini sudah habis, jadi Pesanan tidak dibuat. Pilih Varian lain, atau Produk lain di Beranda.",
      );
    } finally {
      lain.lanjutkan();
      await lain.selesai;
    }
    expect(await pesananDenganEmail(member.email)).toEqual([]);
    expect(await saldoMember(member.id)).toBe(5000);
    expect(await barisRiwayatSaldo(member.id)).toHaveLength(1);
  });

  it("Tamu tidak bisa membayar dengan saldo", async () => {
    const email = emailUnik();
    const keadaan = await aksiCheckout(
      keadaanAwal(),
      formulir({
        varianId: await varianBaru("Uji Bayar", 1000),
        email,
        metode: "Saldo",
      }),
    );

    expect(keadaan.galat?.checkout).toBe(
      "Bayar dengan saldo hanya untuk Member yang sedang login. Masuk dulu, atau bayar dengan QRIS.",
    );
    expect(await pesananDenganEmail(email)).toEqual([]);
  });
});
