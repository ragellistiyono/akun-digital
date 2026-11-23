import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { auth } from "@/server/auth/auth";
import { buatAdmin } from "@/server/auth/buat-admin";
import { db, koneksi } from "@/server/db";
import { pendaftar, varian } from "@/server/db/schema";
import { emailTiruanKe } from "@/server/email-tiruan";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { sisipkanProduk } from "@/server/uji-katalog";
import { sisipkanMember } from "@/server/uji-member";
import { sisipkanPesanan } from "@/server/uji-pesanan";

import {
  aksiDaftar,
  aksiDaftarLewatPesanan,
  aksiKirimUlangKode,
  aksiMasukkanKode,
} from "./aksi";

// Test integrasi Server Action ajakan "Buat akun untuk menyimpan riwayat" di Halaman Pesanan Selesai (T52,
// PRD §7.1, §7.2 ▶ Keputusan 2026-11-17) dengan database app_test dan email tiruan dari .env.ci. Cookie yang
// dibaca dan ditulis aksi lewat next/headers diganti dengan cookie satu browser tiruan, dan header
// permintaannya diganti dengan cookie sesi milik pengunjung (tanpa sesi berarti Tamu). Baris Pengaturan toko
// dipakai bersama test lain yang berjalan bersamaan, jadi nomor WhatsApp di email diatur lewat
// bacaPengaturanToko tiruan. Data Produk dan Member sintetis.
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/server/pengaturan-toko", async (asli) => ({
  ...(await asli<typeof import("@/server/pengaturan-toko")>()),
  bacaPengaturanToko: vi.fn(),
}));

type TokoCookie = Awaited<ReturnType<typeof cookies>>;

const PASSWORD = "sandi-uji-ajakan-1";
const PESAN_EMAIL_TERDAFTAR =
  "Email ini sudah terdaftar. Masuk dengan email ini, atau pakai Lupa password bila lupa password-nya.";
let varianId = "";
let cookieBrowser = new Map<string, string>();

beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: `Ajakan Daftar ${randomUUID().slice(0, 8)}`,
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

beforeEach(() => {
  cookieBrowser = new Map();
  const toko = {
    get: (nama: string) => {
      const value = cookieBrowser.get(nama);
      return value === undefined ? undefined : { name: nama, value };
    },
    set: (nama: string, value: string) => {
      cookieBrowser.set(nama, value);
    },
    delete: (nama: string) => {
      cookieBrowser.delete(nama);
    },
  };
  vi.mocked(cookies).mockResolvedValue(toko as unknown as TokoCookie);
  vi.mocked(headers).mockResolvedValue(new Headers());
  vi.mocked(bacaPengaturanToko).mockResolvedValue({
    nomorWhatsapp: "6281234567890",
    syaratKetentuan: "",
    kebijakanPrivasi: "",
    ambangStokMenipis: 5,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const emailBaru = (awalan: string) => `${awalan}-${randomUUID()}@example.test`;

/** Tautan Pesanan dengan email dan status itu. */
async function pesananDengan(email: string, status: "Selesai" | "Bermasalah") {
  const { tautan } = await sisipkanPesanan({ varianId, status, email });
  return tautan;
}

function formulir(isian: Record<string, string>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) data.set(nama, nilai);
  return data;
}

/** Hasil aksi: keadaan form yang dikembalikan, atau alamat tujuan bila aksi mengalihkan halaman. */
async function hasilAksi<Keadaan>(aksi: Promise<Keadaan>) {
  try {
    return { keadaan: await aksi };
  } catch (galat) {
    if (
      typeof galat === "object" &&
      galat !== null &&
      "digest" in galat &&
      typeof galat.digest === "string" &&
      galat.digest.startsWith("NEXT_REDIRECT")
    ) {
      return { alamat: galat.digest.split(";")[2] };
    }
    throw galat;
  }
}

const daftarLewatPesanan = (isian: Record<string, string>) =>
  hasilAksi(aksiDaftarLewatPesanan({}, formulir(isian)));

async function barisPendaftar(email: string) {
  return db
    .select({ email: pendaftar.email })
    .from(pendaftar)
    .where(eq(pendaftar.email, email));
}

describe("aksiDaftarLewatPesanan", () => {
  it("Tamu dengan email Pesanan yang belum Member menjadi Pendaftar dengan email Pesanan dalam bentuk baku, Kode verifikasi dikirim ke email itu, lalu ia dibawa ke halaman verifikasi", async () => {
    const email = emailBaru("tamu");
    const tautan = await pesananDengan(email.toUpperCase(), "Selesai");

    expect(await daftarLewatPesanan({ tautan, password: PASSWORD })).toEqual({
      alamat: "/daftar/verifikasi",
    });
    expect(await barisPendaftar(email)).toEqual([{ email }]);
    expect(emailTiruanKe(email).at(-1)?.subjek).toMatch(
      /^Kode verifikasi: \d{6}$/,
    );
    expect(cookieBrowser.get("email-pendaftar")).toBe(email);
  });

  it("email yang dikirim lewat form diabaikan: Kode verifikasi selalu dikirim ke email Pesanan", async () => {
    const email = emailBaru("tamu");
    const lain = emailBaru("lain");
    const tautan = await pesananDengan(email, "Selesai");

    await daftarLewatPesanan({ tautan, email: lain, password: PASSWORD });

    expect(await barisPendaftar(email)).toHaveLength(1);
    expect(await barisPendaftar(lain)).toHaveLength(0);
  });

  it("password kurang dari 8 karakter ditolak tanpa membuat Pendaftar", async () => {
    const email = emailBaru("tamu");
    const tautan = await pesananDengan(email, "Selesai");

    expect(await daftarLewatPesanan({ tautan, password: "1234567" })).toEqual({
      keadaan: {
        galat: {
          password:
            "Password kurang dari 8 karakter. Buat password dengan minimal 8 karakter.",
        },
      },
    });
    expect(await barisPendaftar(email)).toHaveLength(0);
  });

  it("email Pesanan milik Admin ditolak dengan pesan email sudah terdaftar (PRD §7.2)", async () => {
    const email = emailBaru("admin");
    await buatAdmin({ email, password: PASSWORD });
    const tautan = await pesananDengan(email, "Selesai");

    expect(await daftarLewatPesanan({ tautan, password: PASSWORD })).toEqual({
      keadaan: { galat: { umum: PESAN_EMAIL_TERDAFTAR } },
    });
  });

  it("pendaftaran ulang 30 detik setelah kode terakhir ditolak dengan jeda yang tersisa (PRD §7.2 ▶ Keputusan 2026-11-17)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-17T10:00:00+07:00"));
    const email = emailBaru("sinta");
    const tautan = await pesananDengan(email, "Selesai");
    await daftarLewatPesanan({ tautan, password: PASSWORD });

    vi.setSystemTime(new Date("2026-11-17T10:00:30+07:00"));
    expect(
      await daftarLewatPesanan({ tautan, password: "sandi-lain-123" }),
    ).toEqual({
      keadaan: {
        galat: {
          umum: "Kode verifikasi baru bisa dikirim lagi dalam 30 detik.",
        },
      },
    });
  });

  it("Pesanan dengan email Member, Pesanan yang belum Selesai, dan Member yang sedang login tidak mendapat ajakan, jadi dibawa kembali ke Halaman Pesanan tanpa membuat Pendaftar", async () => {
    const emailMember = emailBaru("member");
    await sisipkanMember({ email: emailMember, password: PASSWORD });
    const tautanMember = await pesananDengan(emailMember, "Selesai");
    expect(
      await daftarLewatPesanan({ tautan: tautanMember, password: PASSWORD }),
    ).toEqual({ alamat: `/pesanan/${tautanMember}` });

    const emailBermasalah = emailBaru("bermasalah");
    const tautanBermasalah = await pesananDengan(emailBermasalah, "Bermasalah");
    expect(
      await daftarLewatPesanan({
        tautan: tautanBermasalah,
        password: PASSWORD,
      }),
    ).toEqual({ alamat: `/pesanan/${tautanBermasalah}` });
    expect(await barisPendaftar(emailBermasalah)).toHaveLength(0);

    const { headers: kepalaRespons } = await auth.api.signInEmail({
      body: { email: emailMember, password: PASSWORD },
      returnHeaders: true,
    });
    const cookie = kepalaRespons
      .getSetCookie()
      .map((baris) => baris.split(";")[0])
      .join("; ");
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }));
    const emailTamu = emailBaru("tamu");
    const tautanTamu = await pesananDengan(emailTamu, "Selesai");
    expect(
      await daftarLewatPesanan({ tautan: tautanTamu, password: PASSWORD }),
    ).toEqual({ alamat: `/pesanan/${tautanTamu}` });
    expect(await barisPendaftar(emailTamu)).toHaveLength(0);
  });

  it("Tautan Pesanan yang tidak sah atau tidak dikenal menampilkan halaman tidak ditemukan", async () => {
    await expect(
      daftarLewatPesanan({ tautan: "bukan-tautan", password: PASSWORD }),
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(
      daftarLewatPesanan({ tautan: "A".repeat(43), password: PASSWORD }),
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });
});

// Tujuan setelah Kode verifikasi (T85, PRD §7.3 dan §15.7 ▶ Keputusan 2026-11-22, UAT-O10). Tautan "Daftar" di pilihan
// Saldo pada Checkout Tamu membuka halaman Daftar dengan tujuan halaman Top up. Tujuan itu dibawa form Daftar ke
// halaman verifikasi, lalu oleh isian Kode verifikasi dan "Kirim ulang kode" di halaman itu.
describe("tujuan setelah Kode verifikasi", () => {
  const TOP_UP = "/akun/top-up";

  const daftar = (isian: Record<string, string>) =>
    hasilAksi(aksiDaftar({ email: "" }, formulir(isian)));
  const masukkanKode = (isian: Record<string, string>) =>
    hasilAksi(aksiMasukkanKode({}, formulir(isian)));
  const kirimUlang = (isian: Record<string, string>) =>
    hasilAksi(aksiKirimUlangKode(formulir(isian)));

  /** Kode dari email "Kode verifikasi: <kode>" terakhir ke alamat itu. */
  function kodeTerakhir(email: string) {
    const cocok = /^Kode verifikasi: (\d{6})$/.exec(
      emailTiruanKe(email).at(-1)?.subjek ?? "",
    );
    if (!cocok) throw new Error(`Belum ada email Kode verifikasi ke ${email}.`);
    return cocok[1];
  }

  const kodeLainDari = (kode: string) =>
    kode === "000000" ? "111111" : "000000";

  it("form Daftar dengan tujuan halaman Top up membawa Pendaftar ke halaman verifikasi yang membawa tujuan itu", async () => {
    expect(
      await daftar({
        email: emailBaru("sinta"),
        password: PASSWORD,
        tujuan: TOP_UP,
      }),
    ).toEqual({ alamat: "/daftar/verifikasi?tujuan=%2Fakun%2Ftop-up" });
  });

  it("Kode verifikasi yang benar membawa Member baru ke halaman Top up, juga setelah kode salah dan Kirim ulang kode", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const email = emailBaru("sinta");
    await daftar({ email, password: PASSWORD, tujuan: TOP_UP });

    expect(
      await masukkanKode({
        kode: kodeLainDari(kodeTerakhir(email)),
        tujuan: TOP_UP,
      }),
    ).toEqual({
      keadaan: {
        galat: {
          umum: "Kode verifikasi salah. Periksa lagi kode di email terakhir dari kami.",
        },
      },
    });

    vi.setSystemTime(Date.now() + 61_000);
    expect(await kirimUlang({ tujuan: TOP_UP })).toEqual({
      keadaan: {
        pesan: {
          jenis: "terkirim",
          teks: `Kode verifikasi baru sudah kami kirim ke ${email}.`,
        },
      },
    });

    expect(
      await masukkanKode({ kode: kodeTerakhir(email), tujuan: TOP_UP }),
    ).toEqual({ alamat: TOP_UP });
  });

  it("tanpa tujuan, Pendaftar dibawa ke halaman verifikasi biasa, lalu Member baru dibawa ke Riwayat Pesanan", async () => {
    const email = emailBaru("budi");

    expect(await daftar({ email, password: PASSWORD })).toEqual({
      alamat: "/daftar/verifikasi",
    });
    expect(await masukkanKode({ kode: kodeTerakhir(email) })).toEqual({
      alamat: "/riwayat",
    });
  });

  for (const tujuan of [
    "https://jahat.example/akun/top-up",
    "//jahat.example/akun/top-up",
    "/\\jahat.example/akun/top-up",
    "javascript:alert(1)",
    "akun/top-up",
  ]) {
    it(`tujuan ke luar toko (${tujuan}) diabaikan, dan Member baru dibawa ke Riwayat Pesanan`, async () => {
      const email = emailBaru("budi");

      expect(await daftar({ email, password: PASSWORD, tujuan })).toEqual({
        alamat: "/daftar/verifikasi",
      });
      expect(await masukkanKode({ kode: kodeTerakhir(email), tujuan })).toEqual(
        { alamat: "/riwayat" },
      );
    });
  }

  it("browser tanpa Pendaftar dibawa kembali ke halaman Daftar dengan tujuan yang sama", async () => {
    const daftarDenganTujuan = "/daftar?tujuan=%2Fakun%2Ftop-up";

    expect(await kirimUlang({ tujuan: TOP_UP })).toEqual({
      alamat: daftarDenganTujuan,
    });
    expect(await masukkanKode({ kode: "123456", tujuan: TOP_UP })).toEqual({
      alamat: daftarDenganTujuan,
    });
  });
});
