import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
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
  riwayatStatusPesanan,
  varian,
} from "@/server/db/schema";
import { pekerjaanEmailPesananSelesai } from "@/server/pekerjaan-latar";
import { sisipkanProduk } from "@/server/uji-katalog";
import { sisipkanMember } from "@/server/uji-member";
import { checkoutTertahan, sisipkanPesanan } from "@/server/uji-pesanan";

import { aksiAmbilGratis } from "./aksi";

// Test integrasi "Ambil gratis" di Checkout Produk gratis (PRD §16.3, §16.5) dengan database app_test dari .env.ci.
// Produk gratisnya meniru Akun Uji Gratis dari persiapan M6 di docs/UAT.md [CONTOH]: Format Item stok Email dan
// Password, Batas per Member 2, dan satu Varian "Akun Baru" dengan Harga jual Rp 1.000 dan 5 Item stok Tersedia.
// Harga modal-nya Rp 2.000, seperti contoh PRD §16.5 [CONTOH]. Database ini dipakai bersama test lain yang berjalan
// bersamaan, jadi setiap test memakai Member dan Produk yang unik. Cookie yang dibaca dan ditulis aksi lewat
// next/headers diganti dengan cookie satu browser tiruan, dan header permintaannya dengan cookie sesi Member.
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));

type TokoCookie = Awaited<ReturnType<typeof cookies>>;

/** Browser tiruan dengan cookie-nya sendiri. Setelah `pakai()`, aksi membaca dan menulis cookie browser ini. */
function browserBaru() {
  const isi = new Map<string, string>();
  const toko = {
    get: (nama: string) => {
      const value = isi.get(nama);
      return value === undefined ? undefined : { name: nama, value };
    },
    set: (nama: string, value: string) => {
      isi.set(nama, value);
    },
  };
  return {
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PASSWORD_MEMBER = "sandi-uji-member-123";

const PESAN_TIDAK_DIJUAL =
  "Produk atau Varian ini sedang tidak dijual, jadi Pesanan tidak dibuat. Pilih Produk lain di Beranda.";
const PESAN_TIDAK_GRATIS =
  "Produk ini tidak gratis lagi, jadi Pesanan tidak dibuat. Buka lagi Halaman Produk untuk melihat harganya.";
const PESAN_TANPA_MEMBER =
  "Produk gratis hanya untuk Member yang sedang login. Masuk dulu.";
const PESAN_STOK_HABIS =
  "Stok Varian ini sudah habis, jadi Pesanan tidak dibuat. Pilih Varian lain, atau Produk lain di Beranda.";

/**
 * Varian "Akun Baru" dari Produk gratis baru [CONTOH]. Bila `batasPerMember` null, Produk itu bukan Produk gratis,
 * misalnya karena Admin sudah melepas centangnya. Hasilnya id Produk dan Varian itu.
 */
async function akunUjiGratis({
  batasPerMember = 2 as number | null,
  Tersedia = 5,
  varianAktif = true,
} = {}) {
  const produkId = await sisipkanProduk({
    nama: `Akun Uji Gratis ${randomUUID().slice(0, 8)}`,
    formatItemStok: ["Email", "Password"],
    batasPerMember,
    varian: [
      {
        nama: "Akun Baru",
        hargaJual: 1000,
        hargaNormal: 15000,
        hargaModal: 2000,
        aktif: varianAktif,
        Tersedia,
      },
    ],
  });
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return { produkId, varianId: id };
}

/** Member terverifikasi baru yang sedang login. Setelah ini, aksi membaca sesi Member itu. */
async function memberLogin() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  const { headers: kepalaRespons } = await auth.api.signInEmail({
    body: { email, password: PASSWORD_MEMBER },
    returnHeaders: true,
  });
  const cookie = kepalaRespons
    .getSetCookie()
    .map((baris) => baris.split(";")[0])
    .join("; ");
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }));
  return email;
}

function formulir(varianId: string) {
  const data = new FormData();
  data.set("varianId", varianId);
  return data;
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

/** Menekan "Ambil gratis": hasilnya alamat tujuan bila diarahkan, atau keadaan form bila ditolak. */
const ambilGratis = (varianId: string) =>
  aksiAmbilGratis({}, formulir(varianId)).then(
    (keadaan) => ({ keadaan, alamat: null }),
    (galat: unknown) => ({ keadaan: null, alamat: alamatPengalihan(galat) }),
  );

/** Pesanan gratis dengan email itu. */
function pesananGratis(email: string) {
  return db
    .select()
    .from(pesanan)
    .where(and(eq(pesanan.email, email), eq(pesanan.metode, "Gratis")));
}

describe("Ambil gratis (PRD §16.3, §16.5)", () => {
  // UAT-P3 langkah 1.
  it("Member mengambil Akun Uji Gratis: Pesanan langsung Selesai bermetode Gratis dengan nominal Rp 0 dan Harga modal Varian, satu Item stok Terkirim, riwayat Selesai oleh Pembeli (gratis), email dijadwalkan, lalu Member dibawa ke Tautan Pesanan", async () => {
    const { varianId } = await akunUjiGratis();
    const email = await memberLogin();

    const { alamat } = await ambilGratis(varianId);

    const [dibuat] = await pesananGratis(email);
    expect(alamat).toBe(`/pesanan/${dibuat.tautan}`);
    expect(dibuat).toMatchObject({
      varianId,
      metode: "Gratis",
      status: "Selesai",
      hargaJual: 0,
      potonganVoucher: 0,
      kodeUnik: 0,
      totalBayar: 0,
      biayaTransaksi: 0,
      hargaModal: 2000,
      qrisId: null,
      kedaluwarsaPada: null,
      gambarQr: null,
      voucherId: null,
    });
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
        pelaku: "Pembeli (gratis)",
      },
    ]);
    expect(
      await db
        .select({
          status: itemStok.status,
          formatSaatTerkirim: itemStok.formatSaatTerkirim,
        })
        .from(itemStok)
        .where(eq(itemStok.pesananId, dibuat.id)),
    ).toEqual([
      { status: "Terkirim", formatSaatTerkirim: ["Email", "Password"] },
    ]);
    expect(await pekerjaanEmailPesananSelesai(dibuat.id)).toHaveLength(1);
  });

  // UAT-P3 langkah 2 dan 3.
  it('pengambilan ketiga dengan Batas per Member 2 ditolak dengan "Anda sudah mengambil 2 dari batas 2 untuk Produk ini.", tanpa Pesanan baru', async () => {
    const { varianId } = await akunUjiGratis();
    const email = await memberLogin();
    await ambilGratis(varianId);
    await ambilGratis(varianId);

    const { keadaan } = await ambilGratis(varianId);

    expect(keadaan).toEqual({
      galat: "Anda sudah mengambil 2 dari batas 2 untuk Produk ini.",
    });
    expect(await pesananGratis(email)).toHaveLength(2);
  });
});

// PRD §16.3: setiap langkah pemeriksaan menolak dengan pesannya, dan langkah pertama yang menolak menentukan hasilnya.
// Setiap kasus juga memenuhi syarat penolakan semua langkah sesudahnya yang bisa disiapkan.
describe("urutan pemeriksaan Ambil gratis (PRD §16.3)", () => {
  it("langkah 1: Varian yang tidak dijual ditolak dengan pesan tidak dijual, walaupun pengunjungnya Tamu dan Stok Varian 0", async () => {
    const { varianId } = await akunUjiGratis({
      varianAktif: false,
      Tersedia: 0,
    });

    expect((await ambilGratis(varianId)).keadaan).toEqual({
      galat: PESAN_TIDAK_DIJUAL,
    });
  });

  it("langkah 2: Produk yang tidak lagi gratis ditolak dengan pesan PRD, walaupun pengunjungnya Tamu dan Stok Varian 0", async () => {
    const { varianId } = await akunUjiGratis({
      batasPerMember: null,
      Tersedia: 0,
    });

    expect((await ambilGratis(varianId)).keadaan).toEqual({
      galat: PESAN_TIDAK_GRATIS,
    });
  });

  it("langkah 3: tanpa Member yang login, misalnya karena sesinya habis, ditolak dengan pesan PRD, walaupun Stok Varian 0", async () => {
    const { varianId } = await akunUjiGratis({ Tersedia: 0 });

    expect((await ambilGratis(varianId)).keadaan).toEqual({
      galat: PESAN_TANPA_MEMBER,
    });
  });

  describe("langkah 4: email Member masih punya Pesanan Menunggu Pembayaran (PRD §5.4), walaupun Stok Varian 0 dan jatahnya habis", () => {
    async function memberDenganPesananMenunggu() {
      const { varianId } = await akunUjiGratis({
        batasPerMember: 1,
        Tersedia: 0,
      });
      const email = await memberLogin();
      await sisipkanPesanan({
        varianId,
        status: "Selesai",
        email,
        metode: "Gratis",
        rincian: {
          hargaJual: 0,
          potonganVoucher: 0,
          kodeUnik: 0,
          totalBayar: 0,
        },
      });
      const menunggu = await sisipkanPesanan({
        varianId,
        status: "Menunggu Pembayaran",
        email: email.toUpperCase(),
        kedaluwarsaPada: new Date("2026-11-22T10:15:20+07:00"),
      });
      return { varianId, email, menunggu };
    }

    it("dari browser lain ditolak dengan pesan PRD §5.4 yang memuat jam kedaluwarsa dalam WIB", async () => {
      const { varianId, email } = await memberDenganPesananMenunggu();

      expect((await ambilGratis(varianId)).keadaan).toEqual({
        galat:
          "Email ini masih punya Pesanan yang menunggu pembayaran sampai pukul 10.16 WIB. Lanjutkan dari perangkat tempat Anda memesan, atau checkout lagi setelah waktu itu.",
      });
      expect(await pesananGratis(email)).toHaveLength(1);
    });

    it("dari browser yang memegang Tautan Pesanan-nya diarahkan ke Pesanan itu", async () => {
      const { varianId, email, menunggu } = await memberDenganPesananMenunggu();
      vi.mocked(cookies).mockResolvedValue({
        get: () => ({ name: "tautan-pesanan", value: menunggu.tautan }),
        set: () => {},
      } as unknown as TokoCookie);

      expect((await ambilGratis(varianId)).alamat).toBe(
        `/pesanan/${menunggu.tautan}`,
      );
      expect(await pesananGratis(email)).toHaveLength(1);
    });
  });

  it("langkah 5: Stok Varian 0 ditolak dengan pesan stok habis, walaupun jatahnya habis", async () => {
    const { varianId } = await akunUjiGratis({
      batasPerMember: 1,
      Tersedia: 0,
    });
    const email = await memberLogin();
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      email,
      metode: "Gratis",
      rincian: { hargaJual: 0, potonganVoucher: 0, kodeUnik: 0, totalBayar: 0 },
    });

    expect((await ambilGratis(varianId)).keadaan).toEqual({
      galat: PESAN_STOK_HABIS,
    });
    expect(await pesananGratis(email)).toHaveLength(1);
  });

  it("langkah 6: Sisa jatah 0 ditolak dengan pesan jatah habis, dengan Pesanan gratis lama yang emailnya ditulis huruf besar ikut dihitung", async () => {
    const { varianId } = await akunUjiGratis({ batasPerMember: 1 });
    const email = await memberLogin();
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      email: email.toUpperCase(),
      metode: "Gratis",
      rincian: { hargaJual: 0, potonganVoucher: 0, kodeUnik: 0, totalBayar: 0 },
    });

    expect((await ambilGratis(varianId)).keadaan).toEqual({
      galat: "Anda sudah mengambil 1 dari batas 1 untuk Produk ini.",
    });
    expect(await pesananGratis(email)).toHaveLength(0);
  });
});

describe("Ambil gratis bersamaan (PRD §16.3)", () => {
  it("dua pengambilan bersamaan oleh Member yang sama saat Sisa jatah 1 hanya menghasilkan satu Pesanan", async () => {
    const { varianId } = await akunUjiGratis({ batasPerMember: 1 });
    const email = await memberLogin();

    const hasil = await Promise.all([
      ambilGratis(varianId),
      ambilGratis(varianId),
    ]);

    expect(await pesananGratis(email)).toHaveLength(1);
    expect(hasil.filter((h) => h.alamat !== null)).toHaveLength(1);
    expect(hasil.map((h) => h.keadaan).filter(Boolean)).toEqual([
      { galat: "Anda sudah mengambil 1 dari batas 1 untuk Produk ini." },
    ]);
  });

  it("bila Item stok terakhir habis tepat saat pengambilan, tidak ada Pesanan yang dibuat dan Member melihat pesan stok habis", async () => {
    const { varianId } = await akunUjiGratis({ Tersedia: 1 });
    const email = await memberLogin();
    // Checkout lain sedang mengunci Item stok terakhir itu, jadi Stok Varian masih 1 saat diperiksa.
    const lain = checkoutTertahan(varianId);
    await lain.sudahMenahan;

    try {
      expect((await ambilGratis(varianId)).keadaan).toEqual({
        galat: PESAN_STOK_HABIS,
      });
    } finally {
      lain.lanjutkan();
      await lain.selesai;
    }
    expect(await pesananGratis(email)).toEqual([]);
  });
});
