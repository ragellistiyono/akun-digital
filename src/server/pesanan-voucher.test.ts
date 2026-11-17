import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db, koneksi } from "./db";
import { pesanan, varian, voucher } from "./db/schema";
import { prosesKabarPembayaran } from "./kabar-pembayaran";
import { prosesKedaluwarsaPesanan } from "./kedaluwarsa-pesanan";
import { batalkanPesanan } from "./pembatalan-pesanan";
import { bacaPesananLewatTautan, buatPesanan } from "./pesanan";
import type { Qrispy } from "./qrispy";
import { qrispyTiruan } from "./qrispy-tiruan";
import { sisipkanProduk } from "./uji-katalog";
import { buatVoucher, type SyaratVoucher } from "./voucher";

// Test integrasi checkout dengan Voucher (T57, PRD §5.2 ▶ Keputusan 2026-11-17, §5.5, §8.3–§8.8, UAT-H1–UAT-H4)
// dengan database app_test dari .env.ci. Database itu dipakai bersama test lain, jadi setiap Produk, email,
// dan kode Voucher di sini unik. Produk dan Voucher-nya meniru persiapan bersama di docs/UAT.md [CONTOH].
afterAll(async () => {
  await koneksi.end();
});

const akhiran = () => randomUUID().slice(0, 8);
const emailUnik = () => `budi-${randomUUID()}@example.test`;

/** Kode Voucher unik dengan awalan itu, huruf besar dan angka saja. */
const kodeBaru = (awalan: string) =>
  `${awalan}${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;

/** Syarat HEMAT5 di persiapan bersama docs/UAT.md: nominal Rp 5.000, Batas per email 1. */
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

/** Membuat Voucher dengan syarat HEMAT5 yang diganti sebagian. Hasilnya id dan kodenya. */
async function voucherBaru(
  awalan: string,
  syarat: Partial<SyaratVoucher> = {},
) {
  const kode = kodeBaru(awalan);
  const hasil = await buatVoucher({ kode, ...HEMAT5, ...syarat });
  if (hasil.hasil !== "dibuat")
    throw new Error(`Voucher ${kode} tidak dibuat.`);
  const [{ id }] = await db
    .select({ id: voucher.id })
    .from(voucher)
    .where(eq(voucher.kode, kode));
  return { id, kode };
}

/** Qrispy tiruan dengan Kode unik tetap dan waktu kedaluwarsa 10.15 WIB. */
function qrispyKodeUnik(kodeUnik: number): Qrispy & {
  buatQris: ReturnType<typeof vi.fn<Qrispy["buatQris"]>>;
  batalkanQris: ReturnType<typeof vi.fn<Qrispy["batalkanQris"]>>;
} {
  return {
    buatQris: vi.fn(async ({ amount }) => ({
      qrisId: randomUUID(),
      amount: amount + kodeUnik,
      requestedAmount: amount,
      uniqueId: kodeUnik,
      expiredAt: new Date("2026-11-11T10:15:00+07:00"),
      gambarQr: "data:image/png;base64,iVBORw0KGgo=",
    })),
    batalkanQris: vi.fn(async () => {}),
    cekStatusQris: qrispyTiruan.cekStatusQris,
  };
}

/** Id Varian satu-satunya dari Produk baru dengan Harga jual itu dan 10 Item stok Tersedia. */
async function varianBaru(nama: string, hargaJual: number) {
  const produkId = await sisipkanProduk({
    nama: `${nama} ${akhiran()}`,
    varian: [{ nama: "1 Bulan", hargaJual, Tersedia: 10 }],
  });
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return id;
}

let netflix1Bulan = "";
let netflix3Bulan = "";
let ujiBayar = "";

beforeAll(async () => {
  netflix1Bulan = await varianBaru("Netflix Premium", 50000);
  netflix3Bulan = await varianBaru("Netflix Premium 3 Bulan", 135000);
  ujiBayar = await varianBaru("Uji Bayar", 1000);
});

/** Semua Pesanan dengan email itu, langsung dari database. */
function pesananDenganEmail(email: string) {
  return db.select().from(pesanan).where(eq(pesanan.email, email));
}

/** Semua Pesanan yang mencatat Voucher itu, langsung dari database. */
function pesananDenganVoucher(voucherId: string) {
  return db
    .select({ email: pesanan.email, status: pesanan.status })
    .from(pesanan)
    .where(eq(pesanan.voucherId, voucherId));
}

/** Qrispy yang baru menerbitkan QRIS setelah dua checkout memintanya, supaya keduanya lolos pemeriksaan pertama. */
function qrispyMenungguDuaPermintaan() {
  const qrispy = qrispyKodeUnik(123);
  const terbitkan = qrispy.buatQris.getMockImplementation()!;
  let lepaskan = () => {};
  const keduanyaMeminta = new Promise<void>((r) => (lepaskan = r));
  qrispy.buatQris.mockImplementation(async (permintaan) => {
    if (qrispy.buatQris.mock.calls.length === 2) lepaskan();
    await keduanyaMeminta;
    return terbitkan(permintaan);
  });
  return qrispy;
}

describe("buatPesanan dengan Voucher yang diterima (PRD §5.5, §8.3, UAT-H1)", () => {
  it("HEMAT5 untuk Netflix Premium 1 Bulan: Qrispy diminta Rp 45.000, dan Pesanan mencatat Voucher, potongan Rp 5.000, dan Total bayar Rp 45.123", async () => {
    const hemat5 = await voucherBaru("HEMAT");
    const email = emailUnik();
    const qrispy = qrispyKodeUnik(123);

    const hasil = await buatPesanan(
      { varianId: netflix1Bulan, email, kodeVoucher: hemat5.kode },
      { qrispy },
    );

    expect(hasil).toEqual({ hasil: "dibuat", tautan: expect.any(String) });
    expect(qrispy.buatQris).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ amount: 45000 }),
    );
    expect(await pesananDenganEmail(email)).toMatchObject([
      {
        hargaJual: 50000,
        potonganVoucher: 5000,
        kodeUnik: 123,
        totalBayar: 45123,
        voucherId: hemat5.id,
        kodeVoucher: hemat5.kode,
        status: "Menunggu Pembayaran",
      },
    ]);
  });

  it("hemat10 ditulis huruf kecil untuk Varian Rp 135.000: potongan Rp 10.000, Total bayar Rp 125.077, dan kodenya dicatat huruf besar", async () => {
    const hemat10 = await voucherBaru("HEMAT", {
      jenisPotongan: "persen",
      nilai: 10,
      batasMaksimum: 10000,
      minimalHargaJual: 50000,
    });
    const email = emailUnik();

    const hasil = await buatPesanan(
      {
        varianId: netflix3Bulan,
        email,
        kodeVoucher: ` ${hemat10.kode.toLowerCase()} `,
      },
      { qrispy: qrispyKodeUnik(77) },
    );

    expect(hasil.hasil).toBe("dibuat");
    expect(await pesananDenganEmail(email)).toMatchObject([
      {
        hargaJual: 135000,
        potonganVoucher: 10000,
        kodeUnik: 77,
        totalBayar: 125077,
        kodeVoucher: hemat10.kode,
      },
    ]);
  });

  it("Halaman bayar membaca kode Voucher Pesanan itu bersama rinciannya", async () => {
    const hemat5 = await voucherBaru("HEMAT");
    const hasil = await buatPesanan(
      { varianId: netflix1Bulan, email: emailUnik(), kodeVoucher: hemat5.kode },
      { qrispy: qrispyKodeUnik(123) },
    );
    if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);

    expect((await bacaPesananLewatTautan(hasil.tautan))?.rincian).toEqual({
      hargaJual: 50000,
      potonganVoucher: 5000,
      kodeVoucher: hemat5.kode,
      kodeUnik: 123,
      totalBayar: 45123,
    });
  });

  it("checkout tanpa kode voucher tetap membuat Pesanan tanpa Voucher dan tanpa potongan", async () => {
    const email = emailUnik();
    const qrispy = qrispyKodeUnik(123);

    const hasil = await buatPesanan(
      { varianId: netflix1Bulan, email, kodeVoucher: "  " },
      { qrispy },
    );

    expect(hasil.hasil).toBe("dibuat");
    expect(qrispy.buatQris).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ amount: 50000 }),
    );
    expect(await pesananDenganEmail(email)).toMatchObject([
      {
        potonganVoucher: 0,
        totalBayar: 50123,
        voucherId: null,
        kodeVoucher: null,
      },
    ]);
  });

  it("Voucher khusus Member diterima bila Pembeli login sebagai Member", async () => {
    const member20 = await voucherBaru("MEMBER", {
      jenisPotongan: "persen",
      nilai: 20,
      batasMaksimum: 10000,
      khususMember: true,
    });
    const email = emailUnik();

    const hasil = await buatPesanan(
      {
        varianId: netflix1Bulan,
        email,
        kodeVoucher: member20.kode,
        member: true,
      },
      { qrispy: qrispyKodeUnik(123) },
    );

    expect(hasil.hasil).toBe("dibuat");
    expect(await pesananDenganEmail(email)).toMatchObject([
      { potonganVoucher: 10000, kodeVoucher: member20.kode },
    ]);
  });
});

describe("buatPesanan dengan Voucher yang ditolak (PRD §8.7 ▶ Keputusan 2026-11-17, UAT-H2, UAT-H3)", () => {
  const kasus: [
    string,
    () => Promise<{ kode: string; varianId: string }>,
    string,
  ][] = [
    [
      "kode yang tidak ada",
      async () => ({ kode: kodeBaru("ASAL"), varianId: netflix1Bulan }),
      "Kode voucher tidak ditemukan",
    ],
    [
      "Voucher yang sudah berakhir",
      async () => ({
        kode: (
          await voucherBaru("LAMA", {
            berakhir: new Date("2026-11-10T10:00:00+07:00"),
          })
        ).kode,
        varianId: netflix1Bulan,
      }),
      "Voucher sudah berakhir",
    ],
    [
      "HEMAT10 untuk Uji Bayar Rp 1.000",
      async () => ({
        kode: (
          await voucherBaru("HEMAT", {
            jenisPotongan: "persen",
            nilai: 10,
            batasMaksimum: 10000,
            minimalHargaJual: 50000,
          })
        ).kode,
        varianId: ujiBayar,
      }),
      "Minimal pembelian Rp 50.000",
    ],
    [
      "HEMAT5 untuk Uji Bayar Rp 1.000",
      async () => ({
        kode: (await voucherBaru("HEMAT")).kode,
        varianId: ujiBayar,
      }),
      "Voucher tidak memberi potongan untuk produk ini",
    ],
    [
      "Voucher khusus Member oleh Tamu",
      async () => ({
        kode: (await voucherBaru("MEMBER", { khususMember: true })).kode,
        varianId: netflix1Bulan,
      }),
      "Voucher khusus Member, silakan login",
    ],
  ];
  for (const [nama, siapkan, pesan] of kasus) {
    it(`${nama} ditolak dengan "${pesan}", tanpa QRIS maupun Pesanan`, async () => {
      const { kode, varianId } = await siapkan();
      const email = emailUnik();
      const qrispy = qrispyKodeUnik(123);

      const hasil = await buatPesanan(
        { varianId, email, kodeVoucher: kode },
        { qrispy },
      );

      expect(hasil).toEqual({ hasil: "voucher-ditolak", pesan });
      expect(qrispy.buatQris).not.toHaveBeenCalled();
      expect(await pesananDenganEmail(email)).toEqual([]);
    });
  }

  // PRD §5.2 ▶ Keputusan 2026-11-17: Voucher diperiksa paling akhir, setelah batas Pesanan menunggu.
  it("Andi yang masih punya Pesanan menunggu dan checkout lagi dari browser yang sama dengan Voucher yang sudah berakhir diarahkan ke Pesanannya", async () => {
    const lama = await voucherBaru("LAMA", {
      berakhir: new Date("2026-11-10T10:00:00+07:00"),
    });
    const email = emailUnik();
    const pertama = await buatPesanan(
      { varianId: netflix1Bulan, email },
      { qrispy: qrispyKodeUnik(123) },
    );
    if (pertama.hasil !== "dibuat") throw new Error(pertama.hasil);
    const qrispy = qrispyKodeUnik(123);

    const hasil = await buatPesanan(
      {
        varianId: netflix1Bulan,
        email,
        kodeVoucher: lama.kode,
        tautanDiBrowser: [pertama.tautan],
      },
      { qrispy },
    );

    expect(hasil).toEqual({
      hasil: "pesanan-menunggu-di-browser-ini",
      tautan: pertama.tautan,
    });
    expect(qrispy.buatQris).not.toHaveBeenCalled();
  });

  it('email yang sudah memakai Voucher ber-Batas per email 1 ditolak dengan "Anda sudah memakai voucher ini"', async () => {
    const hemat5 = await voucherBaru("HEMAT");
    const email = emailUnik();
    const pertama = await buatPesanan(
      { varianId: netflix1Bulan, email, kodeVoucher: hemat5.kode },
      { qrispy: qrispyKodeUnik(123) },
    );
    if (pertama.hasil !== "dibuat") throw new Error(pertama.hasil);
    await batalkanPesanan(pertama.tautan, { qrispy: qrispyKodeUnik(123) });
    // Pesanan Selesai dengan Voucher itu, seperti Pesanan Selesai member@miwe.example di UAT-H4 langkah 5.
    await db
      .update(pesanan)
      .set({ status: "Selesai" })
      .where(eq(pesanan.tautan, pertama.tautan));

    const hasil = await buatPesanan(
      {
        varianId: netflix1Bulan,
        email: email.toUpperCase(),
        kodeVoucher: hemat5.kode,
      },
      { qrispy: qrispyKodeUnik(123) },
    );

    expect(hasil).toEqual({
      hasil: "voucher-ditolak",
      pesan: "Anda sudah memakai voucher ini",
    });
  });
});

describe("buatPesanan dengan Kuota voucher (PRD §8.5, UAT-H4)", () => {
  it('dua checkout bersamaan dengan Voucher berkuota 1: tepat satu Pesanan memakai Voucher itu, yang lain ditolak dengan "Kuota voucher habis" dan QRIS-nya dibatalkan', async () => {
    const satukali = await voucherBaru("SATUKALI", { kuotaVoucher: 1 });
    const qrispy = qrispyMenungguDuaPermintaan();

    const hasil = await Promise.all(
      [emailUnik(), emailUnik()].map((email) =>
        buatPesanan(
          { varianId: netflix1Bulan, email, kodeVoucher: satukali.kode },
          { qrispy },
        ),
      ),
    );

    expect(hasil.map((h) => h.hasil).sort()).toEqual([
      "dibuat",
      "voucher-ditolak",
    ]);
    expect(hasil).toContainEqual({
      hasil: "voucher-ditolak",
      pesan: "Kuota voucher habis",
    });
    const dipakai = await db
      .select({ qrisId: pesanan.qrisId })
      .from(pesanan)
      .where(eq(pesanan.voucherId, satukali.id));
    expect(dipakai).toHaveLength(1);
    const semuaQris = await Promise.all(
      qrispy.buatQris.mock.results.map((r) => r.value),
    );
    const qrisDitolak = semuaQris.find((q) => q.qrisId !== dipakai[0].qrisId);
    expect(qrispy.batalkanQris).toHaveBeenCalledExactlyOnceWith(
      qrisDitolak?.qrisId,
    );
  });

  it("setelah Pesanan yang memakai SATUKALI Dibatalkan, kuotanya kembali dan Pembeli lain bisa memakainya", async () => {
    const satukali = await voucherBaru("SATUKALI", { kuotaVoucher: 1 });
    const pertama = await buatPesanan(
      {
        varianId: netflix1Bulan,
        email: emailUnik(),
        kodeVoucher: satukali.kode,
      },
      { qrispy: qrispyKodeUnik(123) },
    );
    if (pertama.hasil !== "dibuat") throw new Error(pertama.hasil);
    const emailB = emailUnik();
    expect(
      await buatPesanan(
        { varianId: netflix1Bulan, email: emailB, kodeVoucher: satukali.kode },
        { qrispy: qrispyKodeUnik(123) },
      ),
    ).toEqual({ hasil: "voucher-ditolak", pesan: "Kuota voucher habis" });

    await batalkanPesanan(pertama.tautan, { qrispy: qrispyKodeUnik(123) });
    const hasil = await buatPesanan(
      { varianId: netflix1Bulan, email: emailB, kodeVoucher: satukali.kode },
      { qrispy: qrispyKodeUnik(123) },
    );

    expect(hasil.hasil).toBe("dibuat");
    expect(await pesananDenganVoucher(satukali.id)).toEqual(
      expect.arrayContaining([
        { email: emailB, status: "Menunggu Pembayaran" },
        expect.objectContaining({ status: "Dibatalkan" }),
      ]),
    );
  });

  it("bila potongan Voucher berubah setelah QRIS diminta, QRIS itu dibatalkan dan Pesanan dibuat dengan potongan dan QRIS yang baru", async () => {
    const hemat5 = await voucherBaru("HEMAT");
    const email = emailUnik();
    const qrispy = qrispyKodeUnik(123);
    const terbitkan = qrispy.buatQris.getMockImplementation()!;
    qrispy.buatQris.mockImplementation(async (permintaan) => {
      // Admin mengubah nominal Voucher saat QRIS pertama sedang dibuat.
      if (qrispy.buatQris.mock.calls.length === 1) {
        await db
          .update(voucher)
          .set({ nilai: 7000 })
          .where(eq(voucher.id, hemat5.id));
      }
      return terbitkan(permintaan);
    });

    const hasil = await buatPesanan(
      { varianId: netflix1Bulan, email, kodeVoucher: hemat5.kode },
      { qrispy },
    );

    expect(hasil.hasil).toBe("dibuat");
    expect(qrispy.buatQris.mock.calls.map(([p]) => p.amount)).toEqual([
      45000, 43000,
    ]);
    const [qrisPertama, qrisKedua] = await Promise.all(
      qrispy.buatQris.mock.results.map((r) => r.value),
    );
    expect(qrispy.batalkanQris).toHaveBeenCalledExactlyOnceWith(
      qrisPertama.qrisId,
    );
    expect(await pesananDenganEmail(email)).toMatchObject([
      { qrisId: qrisKedua.qrisId, potonganVoucher: 7000, totalBayar: 43123 },
    ]);
  });
});

describe("pembayaran telat untuk Pesanan dengan Voucher (PRD §5.9, §8.6)", () => {
  it("Pesanan Kedaluwarsa yang memakai HEMAT5 lalu dibayar telat menjadi Selesai dengan potongan voucher yang sama", async () => {
    const hemat5 = await voucherBaru("HEMAT");
    const email = emailUnik();
    const hasil = await buatPesanan(
      { varianId: netflix1Bulan, email, kodeVoucher: hemat5.kode },
      { qrispy: qrispyKodeUnik(123) },
    );
    if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);
    const [{ id, qrisId }] = await pesananDenganEmail(email);
    await prosesKedaluwarsaPesanan(id, {
      qrispy: qrispyTiruan,
      sekarang: new Date("2026-11-11T10:15:00+07:00"),
    });

    await prosesKabarPembayaran({
      qrisId,
      // Harga jual Rp 50.000 − potongan voucher Rp 5.000 + Kode unik Rp 123.
      nominalDiterima: 45123,
      waktuBayar: new Date("2026-11-11T10:20:00+07:00"),
    });

    expect(await pesananDenganEmail(email)).toMatchObject([
      {
        status: "Selesai",
        hargaJual: 50000,
        potonganVoucher: 5000,
        totalBayar: 45123,
        voucherId: hemat5.id,
        kodeVoucher: hemat5.kode,
      },
    ]);
  });
});
