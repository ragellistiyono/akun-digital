import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { nomorPesanan } from "@/domain/nomor-pesanan";

import { db, koneksi } from "./db";
import { pesanan, riwayatStatusPesanan, varian } from "./db/schema";
import { bacaCheckout, bacaPesananLewatTautan, buatPesanan } from "./pesanan";
import type { Qrispy } from "./qrispy";
import { qrispyTiruan } from "./qrispy-tiruan";
import { sisipkanProduk } from "./uji-katalog";

// Test integrasi dengan database app_test dari .env.ci. Database ini dipakai bersama test lain dan run
// sebelumnya, jadi setiap test memakai email dan nama Produk yang unik. Data Produknya mengikuti persiapan
// bersama di docs/UAT.md, yang bertanda [CONTOH].
afterAll(async () => {
  await koneksi.end();
});

const akhiran = () => randomUUID().slice(0, 8);
const emailUnik = () => `budi-${randomUUID()}@example.test`;

/** Qrispy tiruan dengan Kode unik tetap, seperti contoh respons di docs/referensi/qrispy-api.md bagian 3. */
function qrispyKodeUnik123(): Qrispy & {
  buatQris: ReturnType<typeof vi.fn<Qrispy["buatQris"]>>;
  batalkanQris: ReturnType<typeof vi.fn<Qrispy["batalkanQris"]>>;
} {
  return {
    buatQris: vi.fn(async ({ amount }) => ({
      qrisId: randomUUID(),
      amount: amount + 123,
      requestedAmount: amount,
      uniqueId: 123,
      expiredAt: new Date("2026-11-11T10:15:00+07:00"),
      gambarQr: "data:image/png;base64,iVBORw0KGgo=",
    })),
    batalkanQris: vi.fn(async () => {}),
  };
}

/** Netflix Premium [CONTOH] dengan Varian 1 Bulan Rp 50.000 dan 3 Bulan Rp 135.000. */
async function netflixPremium({
  produkAktif = true,
  satuBulanAktif = true,
} = {}) {
  const nama = `Netflix Premium ${akhiran()}`;
  const produkId = await sisipkanProduk({
    nama,
    aktif: produkAktif,
    varian: [
      {
        nama: "1 Bulan",
        hargaJual: 50000,
        hargaNormal: 75000,
        aktif: satuBulanAktif,
        Tersedia: 10,
      },
      { nama: "3 Bulan", hargaJual: 135000, Tersedia: 4 },
    ],
  });
  const semuaVarian = await db
    .select({ id: varian.id, nama: varian.nama })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const idVarian = (namaVarian: string) =>
    semuaVarian.find((v) => v.nama === namaVarian)?.id ?? "";
  return {
    nama,
    satuBulan: idVarian("1 Bulan"),
    tigaBulan: idVarian("3 Bulan"),
  };
}

/** Semua Pesanan dengan email itu, langsung dari database. */
function pesananDenganEmail(email: string) {
  return db.select().from(pesanan).where(eq(pesanan.email, email));
}

describe("buatPesanan (PRD §5.1, ADR-0004)", () => {
  it("checkout Netflix Premium 1 Bulan membuat satu Pesanan Menunggu Pembayaran dengan rincian dari Qrispy", async () => {
    const netflix = await netflixPremium();
    const email = emailUnik();

    const hasil = await buatPesanan(
      { varianId: netflix.satuBulan, email },
      { qrispy: qrispyKodeUnik123() },
    );

    expect(hasil).toEqual({ hasil: "dibuat", tautan: expect.any(String) });
    const tersimpan = await pesananDenganEmail(email);
    expect(tersimpan).toHaveLength(1);
    expect(tersimpan[0]).toMatchObject({
      varianId: netflix.satuBulan,
      status: "Menunggu Pembayaran",
      hargaJual: 50000,
      potonganVoucher: 0,
      kodeUnik: 123,
      totalBayar: 50123,
      kedaluwarsaPada: new Date("2026-11-11T10:15:00+07:00"),
      gambarQr: "data:image/png;base64,iVBORw0KGgo=",
    });
    expect(tersimpan[0].nomorPesanan).toMatch(
      /^MIWE-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,
    );
  });

  it("Halaman bayar membaca Pesanan itu lewat Tautan Pesanan", async () => {
    const netflix = await netflixPremium();
    const email = emailUnik();
    const hasil = await buatPesanan(
      { varianId: netflix.satuBulan, email },
      { qrispy: qrispyKodeUnik123() },
    );
    if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);
    const [{ nomorPesanan }] = await pesananDenganEmail(email);

    expect(await bacaPesananLewatTautan(hasil.tautan)).toEqual({
      nomorPesanan,
      status: "Menunggu Pembayaran",
      namaProduk: netflix.nama,
      namaVarian: "1 Bulan",
      gambarQr: "data:image/png;base64,iVBORw0KGgo=",
      rincian: {
        hargaJual: 50000,
        potonganVoucher: 0,
        kodeUnik: 123,
        totalBayar: 50123,
      },
    });
  });

  it("Tautan Pesanan yang tidak ada tidak membuka Pesanan apa pun", async () => {
    expect(
      await bacaPesananLewatTautan(Buffer.alloc(32).toString("base64url")),
    ).toBeNull();
  });

  it("mengirim Harga jual sebagai amount dan Nomor Pesanan sebagai payment_reference ke Qrispy", async () => {
    const netflix = await netflixPremium();
    const email = emailUnik();
    const qrispy = qrispyKodeUnik123();

    await buatPesanan({ varianId: netflix.tigaBulan, email }, { qrispy });

    const [{ nomorPesanan }] = await pesananDenganEmail(email);
    expect(qrispy.buatQris).toHaveBeenCalledExactlyOnceWith({
      amount: 135000,
      paymentReference: nomorPesanan,
    });
  });

  it("Tautan Pesanan berupa token acak sepanjang 256 bit yang berbeda di setiap Pesanan", async () => {
    const netflix = await netflixPremium();

    const [a, b] = await Promise.all(
      [emailUnik(), emailUnik()].map((email) =>
        buatPesanan(
          { varianId: netflix.satuBulan, email },
          { qrispy: qrispyKodeUnik123() },
        ),
      ),
    );

    for (const hasil of [a, b]) {
      if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);
      // 32 byte acak dalam base64url, jadi minimal 128 bit seperti yang diminta issue.
      expect(hasil.tautan).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
    expect(a).not.toEqual(b);
  });

  it("Riwayat status Pesanan baru berisi satu baris Menunggu Pembayaran oleh Pembeli", async () => {
    const netflix = await netflixPremium();
    const email = emailUnik();
    const sebelum = new Date();

    await buatPesanan(
      { varianId: netflix.satuBulan, email },
      { qrispy: qrispyKodeUnik123() },
    );

    const [{ id }] = await pesananDenganEmail(email);
    const riwayat = await db
      .select()
      .from(riwayatStatusPesanan)
      .where(eq(riwayatStatusPesanan.pesananId, id));
    expect(riwayat).toEqual([
      {
        id: expect.any(String),
        pesananId: id,
        waktu: expect.any(Date),
        status: "Menunggu Pembayaran",
        pelaku: "Pembeli",
      },
    ]);
    expect(riwayat[0].waktu.getTime()).toBeGreaterThanOrEqual(
      sebelum.getTime() - 1000,
    );
  });

  it("Nomor Pesanan yang sudah dipakai dibuat ulang, dan QRIS untuk nomor itu dibatalkan", async () => {
    const netflix = await netflixPremium();
    const emailPertama = emailUnik();
    await buatPesanan(
      { varianId: netflix.satuBulan, email: emailPertama },
      { qrispy: qrispyKodeUnik123() },
    );
    const [{ nomorPesanan: nomorDipakai }] =
      await pesananDenganEmail(emailPertama);
    const nomorLain = nomorPesanan(randomBytes(6));
    const urutanNomor = [nomorDipakai, nomorLain];
    const qrispy = qrispyKodeUnik123();
    const email = emailUnik();

    const hasil = await buatPesanan(
      { varianId: netflix.satuBulan, email },
      { qrispy, buatNomorPesanan: () => urutanNomor.shift() ?? "" },
    );

    expect(hasil).toMatchObject({ hasil: "dibuat" });
    expect(await pesananDenganEmail(email)).toMatchObject([
      { nomorPesanan: nomorLain },
    ]);
    expect(await pesananDenganEmail(emailPertama)).toMatchObject([
      { nomorPesanan: nomorDipakai },
    ]);
    const [qrisNomorDipakai] = await Promise.all(
      qrispy.buatQris.mock.results.map((r) => r.value),
    );
    expect(qrispy.batalkanQris).toHaveBeenCalledExactlyOnceWith(
      qrisNomorDipakai.qrisId,
    );
  });

  // PRD §3.7: Produk atau Varian nonaktif tidak bisa dibeli.
  for (const [kasus, siapkan] of [
    [
      "Varian nonaktif",
      async () => (await netflixPremium({ satuBulanAktif: false })).satuBulan,
    ],
    [
      "Varian dari Produk nonaktif",
      async () => (await netflixPremium({ produkAktif: false })).satuBulan,
    ],
    ["Varian yang tidak ada", async () => randomUUID()],
  ] as const) {
    it(`checkout ${kasus} ditolak tanpa membuat QRIS maupun Pesanan`, async () => {
      const varianId = await siapkan();
      const email = emailUnik();
      const qrispy = qrispyKodeUnik123();

      const hasil = await buatPesanan({ varianId, email }, { qrispy });

      expect(hasil).toEqual({ hasil: "tidak-dijual" });
      expect(qrispy.buatQris).not.toHaveBeenCalled();
      expect(await pesananDenganEmail(email)).toEqual([]);
    });
  }

  // ADR-0004: bila Qrispy menolak atau tidak menjawab, tidak ada Pesanan yang tersisa.
  it("bila adaptor Qrispy gagal, checkout gagal dan tidak ada Pesanan baru di database", async () => {
    const netflix = await netflixPremium();
    const email = emailUnik();
    const qrispyGagal: Qrispy = {
      ...qrispyTiruan,
      buatQris: async () => {
        throw new Error("Qrispy tiruan dibuat gagal: tidak menjawab");
      },
    };

    const hasil = await buatPesanan(
      { varianId: netflix.satuBulan, email },
      { qrispy: qrispyGagal },
    );

    expect(hasil).toEqual({ hasil: "qris-gagal" });
    expect(await pesananDenganEmail(email)).toEqual([]);
  });

  // ADR-0004: amount harus sama dengan requested_amount + unique_id, dan requested_amount harus sama
  // dengan nominal yang dikirim toko. Bila tidak, QRIS itu dibatalkan dan checkout gagal.
  for (const [kasus, ubah] of [
    [
      "amount tidak sama dengan requested_amount + unique_id",
      (amount: number) => ({ amount, requestedAmount: amount, uniqueId: 123 }),
    ],
    [
      "requested_amount tidak sama dengan Harga jual",
      (amount: number) => ({
        amount: amount - 1000 + 123,
        requestedAmount: amount - 1000,
        uniqueId: 123,
      }),
    ],
  ] as const) {
    it(`bila ${kasus}, QRIS dibatalkan dan tidak ada Pesanan baru`, async () => {
      const netflix = await netflixPremium();
      const email = emailUnik();
      const qrisId = randomUUID();
      const batalkanQris = vi.fn<Qrispy["batalkanQris"]>(async () => {});
      const qrispyMeleset: Qrispy = {
        buatQris: async ({ amount }) => ({
          ...ubah(amount),
          qrisId,
          expiredAt: new Date("2026-11-11T10:15:00+07:00"),
          gambarQr: "data:image/png;base64,iVBORw0KGgo=",
        }),
        batalkanQris,
      };

      const hasil = await buatPesanan(
        { varianId: netflix.satuBulan, email },
        { qrispy: qrispyMeleset },
      );

      expect(hasil).toEqual({ hasil: "qris-gagal" });
      expect(batalkanQris).toHaveBeenCalledExactlyOnceWith(qrisId);
      expect(await pesananDenganEmail(email)).toEqual([]);
    });
  }

  it("pembatalan QRIS yang gagal tidak mengubah hasilnya: checkout tetap gagal tanpa Pesanan", async () => {
    const netflix = await netflixPremium();
    const email = emailUnik();
    const qrispyMeleset: Qrispy = {
      buatQris: async ({ amount }) => ({
        qrisId: randomUUID(),
        amount,
        requestedAmount: amount,
        uniqueId: 123,
        expiredAt: new Date("2026-11-11T10:15:00+07:00"),
        gambarQr: "data:image/png;base64,iVBORw0KGgo=",
      }),
      batalkanQris: async () => {
        throw new Error("Qrispy tiruan dibuat gagal: tidak menjawab");
      },
    };

    const hasil = await buatPesanan(
      { varianId: netflix.satuBulan, email },
      { qrispy: qrispyMeleset },
    );

    expect(hasil).toEqual({ hasil: "qris-gagal" });
    expect(await pesananDenganEmail(email)).toEqual([]);
  });

  // UAT-E5 dan PRD §5.1: Harga jual dicatat saat checkout.
  it("mengubah Harga jual setelah checkout tidak mengubah rincian Pesanan itu", async () => {
    const netflix = await netflixPremium();
    const hasil = await buatPesanan(
      { varianId: netflix.tigaBulan, email: emailUnik() },
      { qrispy: qrispyKodeUnik123() },
    );
    if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);

    await db
      .update(varian)
      .set({ hargaJual: 140000 })
      .where(eq(varian.id, netflix.tigaBulan));

    expect(await bacaPesananLewatTautan(hasil.tautan)).toMatchObject({
      rincian: {
        hargaJual: 135000,
        potonganVoucher: 0,
        kodeUnik: 123,
        totalBayar: 135123,
      },
    });
  });
});

// PRD §5.2 dan docs/DESIGN.md "Rincian Total bayar": form checkout menampilkan Produk dan Varian yang
// dipilih, Harga jual, dan Perkiraan bayar sebelum Kode unik diketahui.
describe("bacaCheckout", () => {
  it("Netflix Premium 3 Bulan: Harga jual Rp 135.000 dan Perkiraan bayar Rp 135.000 + Kode unik", async () => {
    const netflix = await netflixPremium();

    expect(await bacaCheckout(netflix.tigaBulan)).toEqual({
      varianId: netflix.tigaBulan,
      namaProduk: netflix.nama,
      namaVarian: "3 Bulan",
      hargaJual: 135000,
      perkiraanBayar: 135000,
    });
  });

  // PRD §3.7.
  it("Varian nonaktif, Varian dari Produk nonaktif, dan Varian yang tidak ada tidak bisa di-checkout", async () => {
    expect(
      await bacaCheckout(
        (await netflixPremium({ satuBulanAktif: false })).satuBulan,
      ),
    ).toBeNull();
    expect(
      await bacaCheckout(
        (await netflixPremium({ produkAktif: false })).satuBulan,
      ),
    ).toBeNull();
    expect(await bacaCheckout(randomUUID())).toBeNull();
  });
});
