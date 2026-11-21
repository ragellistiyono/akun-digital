import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buatAdmin } from "./auth/buat-admin";
import { tambahBiayaOperasional } from "./biaya-operasional";
import { db, koneksi } from "./db";
import { pendaftar, user, varian } from "./db/schema";
import { selesaikanPesananBermasalah } from "./penyelesaian-bermasalah";
import {
  angkaItemStok,
  angkaMemberAktif,
  angkaRingkasan,
  angkaTotalSaldoMember,
  jumlahPesananMenungguPembayaran,
  jumlahTopUpBermasalah,
} from "./ringkasan";
import { ubahSaldoOlehAdmin } from "./saldo";
import { ubahStatusMember } from "./status-member";
import { sisipkanProduk } from "./uji-katalog";
import { sisipkanMember } from "./uji-member";
import { sisipkanPesanan } from "./uji-pesanan";
import { sisipkanTopUp } from "./uji-top-up";

// Test integrasi dengan database app_test (.env.ci), yang dipakai bersama test lain. Test lain membuat
// Pesanan yang dibayar dan Biaya operasional bertanggal sekitar waktu nyata atau November 2026, jadi setiap test
// di sini memakai "sekarang" pada bulan tersendiri di tahun 2031, supaya hari ini dan bulan ini hanya memuat
// Pesanan dan Biaya operasional test itu.
let varianId = "";

beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: `Ringkasan ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 1 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
});

afterAll(async () => {
  await koneksi.end();
});

/** Rincian nominal Pesanan uji: Harga jual itu tanpa potongan voucher, ditambah Kode unik itu (PRD §5.5). */
const rincian = (hargaJual: number, kodeUnik: number) => ({
  hargaJual,
  potonganVoucher: 0,
  kodeUnik,
  totalBayar: hargaJual + kodeUnik,
});

describe("angkaRingkasan (PRD §9.2, §9.3, §14.5)", () => {
  it("Pendapatan hari ini adalah jumlah Total bayar Pesanan Selesai yang dibayar hari ini menurut WIB, termasuk Kode unik, tanpa Pesanan Bermasalah dan Dana Dikembalikan", async () => {
    // Contoh PRD §9.3: Total bayar Rp 45.123, Rp 50.010, dan Rp 135.499, ditambah Pesanan Bermasalah Rp 50.200.
    for (const [status, harga, kodeUnik, dibayar] of [
      ["Selesai", 45000, 123, "2031-07-15T09:00:00+07:00"],
      ["Selesai", 50000, 10, "2031-07-15T13:30:00+07:00"],
      ["Selesai", 135000, 499, "2031-07-15T20:45:00+07:00"],
      ["Bermasalah", 50000, 200, "2031-07-15T21:00:00+07:00"],
      ["Dana Dikembalikan", 40000, 0, "2031-07-15T08:00:00+07:00"],
      // Kemarin pukul 23.59.59 WIB: bulan ini, bukan hari ini.
      ["Selesai", 10000, 0, "2031-07-14T23:59:59+07:00"],
      // Bulan lalu: tidak masuk bulan ini.
      ["Selesai", 20000, 0, "2031-06-30T23:59:59+07:00"],
    ] as const) {
      await sisipkanPesanan({
        varianId,
        status,
        rincian: rincian(harga, kodeUnik),
        waktuBayar: new Date(dibayar),
      });
    }

    const angka = await angkaRingkasan({
      sekarang: new Date("2031-07-15T22:00:00+07:00"),
    });

    expect(angka.hariIni.pendapatan).toBe(230632);
    expect(angka.hariIni.pesananSelesai).toBe(3);
    expect(angka.bulanIni.pendapatan).toBe(240632);
    expect(angka.bulanIni.pesananSelesai).toBe(4);
  });

  it("Pesanan yang dibuat kemarin pukul 23.58 WIB dan dibayar hari ini pukul 00.01 WIB terhitung hari ini", async () => {
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      rincian: rincian(45000, 123),
      dibuatPada: new Date("2031-08-19T23:58:00+07:00"),
      waktuBayar: new Date("2031-08-20T00:01:00+07:00"),
    });

    const angka = await angkaRingkasan({
      sekarang: new Date("2031-08-20T08:00:00+07:00"),
    });

    expect(angka.hariIni.pendapatan).toBe(45123);
    expect(angka.hariIni.pesananSelesai).toBe(1);
  });

  it("Pesanan Bermasalah yang diselesaikan Admin dihitung pada tanggal pembayarannya, bukan tanggal Admin menyelesaikannya", async () => {
    const { id } = await sisipkanPesanan({
      varianId,
      status: "Bermasalah",
      rincian: rincian(45000, 123),
      waktuBayar: new Date("2031-09-09T22:00:00+07:00"),
    });
    expect(
      await selesaikanPesananBermasalah(
        { pesananId: id, cara: "kirim-item-stok" },
        { sekarang: new Date("2031-09-10T09:00:00+07:00") },
      ),
    ).toEqual({ hasil: "diselesaikan" });

    const tanggalBayar = await angkaRingkasan({
      sekarang: new Date("2031-09-09T23:00:00+07:00"),
    });
    const tanggalDiselesaikan = await angkaRingkasan({
      sekarang: new Date("2031-09-10T12:00:00+07:00"),
    });

    expect(tanggalBayar.hariIni.pendapatan).toBe(45123);
    expect(tanggalBayar.hariIni.pesananSelesai).toBe(1);
    expect(tanggalDiselesaikan.hariIni.pendapatan).toBe(0);
    expect(tanggalDiselesaikan.hariIni.pesananSelesai).toBe(0);
  });

  it("contoh PRD §14.5: tiga Pesanan Selesai hari ini dan Biaya operasional Rp 10.000 bertanggal hari ini", async () => {
    for (const [
      hargaJual,
      potonganVoucher,
      kodeUnik,
      totalBayar,
      hargaModal,
      biayaTransaksi,
      dibayar,
    ] of [
      [50000, 5000, 123, 45123, 35000, 0, "2031-10-15T09:00:00+07:00"],
      [50000, 0, 10, 50010, 35000, 0, "2031-10-15T13:30:00+07:00"],
      [135000, 0, 499, 135499, 100000, 949, "2031-10-15T20:45:00+07:00"],
    ] as const) {
      await sisipkanPesanan({
        varianId,
        status: "Selesai",
        rincian: { hargaJual, potonganVoucher, kodeUnik, totalBayar },
        hargaModal,
        biayaTransaksi,
        waktuBayar: new Date(dibayar),
      });
    }
    await tambahBiayaOperasional({
      tanggal: "2031-10-15",
      keterangan: `Iklan ${randomUUID().slice(0, 8)}`,
      nominal: 10000,
    });

    const { hariIni } = await angkaRingkasan({
      sekarang: new Date("2031-10-15T22:00:00+07:00"),
    });

    expect(hariIni.pendapatan).toBe(230632);
    expect(hariIni.totalHargaModal).toBe(170000);
    expect(hariIni.labaKotor).toBe(65000);
    expect(hariIni.labaBersih).toBe(49683);
  });

  it("Biaya operasional bertanggal bulan lalu mengurangi Laba bersih sepanjang waktu, tetapi tidak Laba bersih bulan ini", async () => {
    // Satu Pesanan Selesai bulan ini: Laba kotor Rp 15.000, Kode unik Rp 100, tanpa potongan dan Biaya transaksi.
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      rincian: rincian(50000, 100),
      hargaModal: 35000,
      biayaTransaksi: 0,
      waktuBayar: new Date("2031-12-05T10:00:00+07:00"),
    });
    const bulanLalu = await tambahBiayaOperasional({
      tanggal: "2031-11-30",
      keterangan: `Sewa server ${randomUUID().slice(0, 8)}`,
      nominal: 7000,
    });
    const bulanIni = await tambahBiayaOperasional({
      tanggal: "2031-12-01",
      keterangan: `Domain ${randomUUID().slice(0, 8)}`,
      nominal: 1000,
    });

    const angka = await angkaRingkasan({
      sekarang: new Date("2031-12-10T08:00:00+07:00"),
    });

    // Rp 15.000 + Rp 100 − Rp 1.000: biaya bulan lalu tidak dikurangkan.
    expect(angka.bulanIni.biayaOperasional).toBe(1000);
    expect(angka.bulanIni.labaBersih).toBe(14100);
    const dikurangkanSepanjangWaktu =
      angka.sepanjangWaktu.biayaOperasionalDihitung.map((b) => b.id);
    expect(dikurangkanSepanjangWaktu).toContain(bulanLalu.id);
    expect(dikurangkanSepanjangWaktu).toContain(bulanIni.id);
  });
});

/** Member baru dengan email unik berawalan itu, beserta id-nya. */
async function memberBaru(awalan: string) {
  const email = `${awalan}-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return { email, id };
}

// PRD §9.2 ▶ Keputusan 2026-11-20 dan §15.8: kartu Laba bersih ikut menghitung Kode unik Top up dan Biaya
// transaksi Top up, sedangkan Nominal top up tidak masuk Pendapatan. Test ini memakai bulan tersendiri di tahun 2033.
describe("angkaRingkasan dengan Top up (PRD §9.2, §15.8)", () => {
  it("contoh PRD §15.8: satu Pesanan saldo dan satu Top up Berhasil hari ini memberi Laba bersih Rp 14.148, Pendapatan tetap Rp 50.000, dan Top up Bermasalah tidak dihitung", async () => {
    const { id: userId } = await memberBaru("laba-top-up");
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      metode: "Saldo",
      rincian: rincian(50000, 0),
      hargaModal: 35000,
      biayaTransaksi: 0,
      waktuBayar: new Date("2033-01-15T10:20:00+07:00"),
    });
    const berhasil = await sisipkanTopUp({
      userId,
      status: "Berhasil",
      nominalTopUp: 150000,
      kodeUnik: 200,
      biayaTransaksi: 1052,
      waktuBayar: new Date("2033-01-15T10:00:00+07:00"),
    });
    const bermasalah = await sisipkanTopUp({
      userId,
      status: "Bermasalah",
      nominalTopUp: 50000,
      kodeUnik: 123,
      biayaTransaksi: 0,
      waktuBayar: new Date("2033-01-15T11:00:00+07:00"),
    });

    const angka = await angkaRingkasan({
      sekarang: new Date("2033-01-15T22:00:00+07:00"),
    });

    for (const rentang of [angka.hariIni, angka.bulanIni]) {
      expect(rentang.pendapatan).toBe(50000);
      expect(rentang.kodeUnikTopUp).toBe(200);
      expect(rentang.biayaTransaksiTopUp).toBe(1052);
      expect(rentang.labaBersih).toBe(14148);
      expect(rentang.topUpBerhasil).toEqual({ jumlah: 1, nominal: 150000 });
    }
    const topUpSepanjangWaktu = angka.sepanjangWaktu.topUpDihitung.map(
      (t) => t.id,
    );
    expect(topUpSepanjangWaktu).toContain(berhasil.id);
    expect(topUpSepanjangWaktu).not.toContain(bermasalah.id);
  });
});

// PRD §9.2 ▶ Keputusan 2026-11-20, kartu 9: jumlah saldo semua Member, aktif maupun nonaktif. Database dipakai
// bersama test lain, jadi test ini memeriksa Member yang dihitung (bahan hitungnya) lewat email unik.
describe("angkaTotalSaldoMember (PRD §9.2, §15.1)", () => {
  it("menghitung saldo Member aktif dan Member nonaktif, tetapi tidak Admin", async () => {
    const aktif = await memberBaru("saldo-aktif");
    const nonaktif = await memberBaru("saldo-nonaktif");
    const admin = `admin-${randomUUID()}@example.test`;
    for (const [{ id }, nominal] of [
      [aktif, "30000"],
      [nonaktif, "20000"],
    ] as const) {
      expect(
        (
          await ubahSaldoOlehAdmin({
            idMember: id,
            aksi: "tambah",
            nominal,
            keterangan: "Saldo uji",
          })
        ).hasil,
      ).toBe("diubah");
    }
    await ubahStatusMember({ idMember: nonaktif.id, nonaktif: true });
    await buatAdmin({ email: admin, password: "sandi-uji-admin-123" });

    const total = await angkaTotalSaldoMember();

    expect(total.dihitung).toContainEqual({ email: aktif.email, saldo: 30000 });
    expect(total.dihitung).toContainEqual({
      email: nonaktif.email,
      saldo: 20000,
    });
    expect(total.dihitung.map((m) => m.email)).not.toContain(admin);
    expect(total.total).toBeGreaterThanOrEqual(50000);
  });
});

// PRD §9.2 ▶ Keputusan 2026-11-20, kartu 10: jumlah Top up Bermasalah saat ini (§15.4).
describe("jumlahTopUpBermasalah (PRD §9.2, §15.4)", () => {
  it("menghitung Top up yang berstatus Bermasalah saat ini", async () => {
    const { id: userId } = await memberBaru("top-up-bermasalah");
    const bermasalah = await sisipkanTopUp({
      userId,
      status: "Bermasalah",
      biayaTransaksi: 0,
      waktuBayar: new Date(),
    });
    const berhasil = await sisipkanTopUp({
      userId,
      status: "Berhasil",
      biayaTransaksi: 0,
      waktuBayar: new Date(),
    });

    const hasil = await jumlahTopUpBermasalah();

    const dihitung = hasil.dihitung.map((t) => t.id);
    expect(dihitung).toContain(bermasalah.id);
    expect(dihitung).not.toContain(berhasil.id);
  });
});

describe("jumlahPesananMenungguPembayaran (PRD §9.2)", () => {
  it("menghitung Pesanan yang berstatus Menunggu Pembayaran saat ini", async () => {
    const menunggu = await sisipkanPesanan({
      varianId,
      status: "Menunggu Pembayaran",
    });
    const dibatalkan = await sisipkanPesanan({
      varianId,
      status: "Dibatalkan",
    });

    const hasil = await jumlahPesananMenungguPembayaran();

    const dihitung = hasil.dihitung.map((p) => p.id);
    expect(dihitung).toContain(menunggu.id);
    expect(dihitung).not.toContain(dibatalkan.id);
    expect(hasil.jumlah).toBe(hasil.dihitung.length);
  });
});

// PRD §9.2 ▶ Keputusan 2026-11-20, kartu 9 dan 10. Database dipakai bersama test lain, jadi test ini memeriksa
// kelompok Item stok yang dihitung (bahan hitungnya) untuk Varian test ini saja.
describe("angkaItemStok (PRD §9.2)", () => {
  it("Item stok Tersedia tidak menghitung Item stok Ditahan, Item stok di Varian nonaktif, maupun Item stok di Produk nonaktif", async () => {
    const akhiran = randomUUID().slice(0, 8);
    const produkAktif = await sisipkanProduk({
      nama: `Item stok aktif ${akhiran}`,
      varian: [
        {
          nama: "1 Bulan",
          hargaJual: 50000,
          Tersedia: 2,
          Ditahan: 1,
          Terkirim: 3,
        },
        {
          nama: "3 Bulan",
          hargaJual: 135000,
          aktif: false,
          Tersedia: 4,
          Terkirim: 1,
        },
      ],
    });
    const produkNonaktif = await sisipkanProduk({
      nama: `Item stok nonaktif ${akhiran}`,
      aktif: false,
      varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 5, Terkirim: 2 }],
    });
    const varianTest = await db
      .select({ id: varian.id, nama: varian.nama, produkId: varian.produkId })
      .from(varian)
      .where(inArray(varian.produkId, [produkAktif, produkNonaktif]));
    const idVarian = (produkId: string, nama: string) =>
      varianTest.find((v) => v.produkId === produkId && v.nama === nama)?.id;
    const milikTest = (k: { varianId: string }) =>
      varianTest.some((v) => v.id === k.varianId);

    const { tersedia, terkirim } = await angkaItemStok();

    expect(
      tersedia.dihitung
        .filter(milikTest)
        .map((k) => ({ varianId: k.varianId, jumlah: k.jumlah })),
    ).toEqual([{ varianId: idVarian(produkAktif, "1 Bulan"), jumlah: 2 }]);
    expect(
      terkirim.dihitung
        .filter(milikTest)
        .reduce((jumlah, k) => jumlah + k.jumlah, 0),
    ).toBe(6);
  });
});

// PRD §2.3 ▶ Keputusan 2026-11-17 dan §9.2: kartu Member aktif menghitung Member yang sudah diverifikasi dan
// tidak nonaktif. Database dipakai bersama test lain, jadi test ini memeriksa Member yang dihitung (bahan
// hitungnya) lewat email unik, bukan jumlah semuanya.
describe("angkaMemberAktif (PRD §2.3, §9.2)", () => {
  it("menghitung Member aktif, tetapi tidak menghitung Pendaftar, Member nonaktif, maupun Admin", async () => {
    const akhiran = randomUUID();
    const PASSWORD = "sandi-uji-member-123";
    const aktif = `aktif-${akhiran}@mail.com`;
    const nonaktif = `nonaktif-${akhiran}@mail.com`;
    const calon = `pendaftar-${akhiran}@mail.com`;
    const admin = `admin-${akhiran}@example.test`;
    await sisipkanMember({ email: aktif, password: PASSWORD });
    await sisipkanMember({ email: nonaktif, password: PASSWORD });
    const [{ id: idNonaktif }] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, nonaktif));
    await ubahStatusMember({ idMember: idNonaktif, nonaktif: true });
    await db.insert(pendaftar).values({
      email: calon,
      password: "hash-uji",
      kodeVerifikasi: "123456",
      kodeDikirimPada: new Date(),
    });
    await buatAdmin({ email: admin, password: "sandi-uji-admin-123" });

    const memberAktif = await angkaMemberAktif();

    const dihitung = memberAktif.dihitung.map((member) => member.email);
    expect(dihitung).toContain(aktif);
    expect(dihitung).not.toContain(nonaktif);
    expect(dihitung).not.toContain(calon);
    expect(dihitung).not.toContain(admin);
    expect(memberAktif.jumlah).toBe(memberAktif.dihitung.length);
  });

  it("Member nonaktif yang diaktifkan kembali dihitung lagi", async () => {
    const email = `kembali-${randomUUID()}@mail.com`;
    await sisipkanMember({ email, password: "sandi-uji-member-123" });
    const [{ id }] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    await ubahStatusMember({ idMember: id, nonaktif: true });
    await ubahStatusMember({ idMember: id, nonaktif: false });

    const memberAktif = await angkaMemberAktif();

    expect(memberAktif.dihitung.map((member) => member.email)).toContain(email);
  });
});

// PRD §9.2 ▶ Keputusan 2026-11-20, kartu 8: "dari N Member terdaftar".
describe("Member terdaftar (PRD §9.2)", () => {
  it("menghitung Member aktif dan nonaktif, tetapi tidak menghitung Pendaftar", async () => {
    const akhiran = randomUUID();
    const aktif = `terdaftar-aktif-${akhiran}@mail.com`;
    const nonaktif = `terdaftar-nonaktif-${akhiran}@mail.com`;
    const calon = `terdaftar-pendaftar-${akhiran}@mail.com`;
    await sisipkanMember({ email: aktif, password: "sandi-uji-member-123" });
    await sisipkanMember({ email: nonaktif, password: "sandi-uji-member-123" });
    const [{ id }] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, nonaktif));
    await ubahStatusMember({ idMember: id, nonaktif: true });
    await db.insert(pendaftar).values({
      email: calon,
      password: "hash-uji",
      kodeVerifikasi: "123456",
      kodeDikirimPada: new Date(),
    });

    const { terdaftar } = await angkaMemberAktif();

    const dihitung = terdaftar.dihitung.map((member) => member.email);
    expect(dihitung).toContain(aktif);
    expect(dihitung).toContain(nonaktif);
    expect(dihitung).not.toContain(calon);
    expect(terdaftar.jumlah).toBe(terdaftar.dihitung.length);
  });
});
