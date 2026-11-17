import { describe, expect, it } from "vitest";

import kesamaanEmail from "../../tests/golden/kesamaan-email.json";
import pendapatanGolden from "../../tests/golden/pendapatan.json";
import type { StatusPesanan } from "./status-pesanan";
import { totalBelanja } from "./total-belanja";

type KasusPendapatan = (typeof pendapatanGolden.kasus)[number];

const EMAIL_MEMBER = "budi@mail.com";

/**
 * Kasus pendapatan.json yang semua Pesanannya dibayar di dalam rentangnya. Untuk kasus itu batas rentang
 * tidak mengubah apa pun, jadi Pendapatan yang tertulis di fixture juga total belanja Member yang memegang
 * semua Pesanan itu (tests/golden/NOTES.md, §2.3 total belanja Member).
 */
const kasusTanpaPengaruhRentang = pendapatanGolden.kasus.filter(
  ({ input: { rentang, pesanan } }) =>
    pesanan.every(
      (p) =>
        new Date(p.dibayarPada) >= new Date(rentang.mulai) &&
        new Date(p.dibayarPada) < new Date(rentang.sebelum),
    ),
);

/** Pesanan golden dengan waktu sebagai instan dan email itu. */
const pesananBeremail = (
  pesanan: KasusPendapatan["input"]["pesanan"],
  email: string,
) =>
  pesanan.map((p) => ({
    status: p.status as StatusPesanan,
    totalBayar: p.totalBayar,
    dibayarPada: new Date(p.dibayarPada),
    email,
  }));

// PRD §2.3: total belanja dihitung seperti Pendapatan (§9.3), dari Pesanan Member itu saja, tanpa batas waktu.
describe("totalBelanja", () => {
  it("fixture pendapatan.json memuat kasus yang tidak terpengaruh rentang", () => {
    expect(kasusTanpaPengaruhRentang.map((k) => k.nama)).toEqual([
      "Contoh PRD",
      "Tidak ada Pesanan Selesai",
    ]);
  });

  it.each(kasusTanpaPengaruhRentang)(
    "$nama: total belanja sama dengan Pendapatan di fixture",
    ({ input, output }) => {
      const hasil = totalBelanja({
        emailMember: EMAIL_MEMBER,
        pesanan: pesananBeremail(input.pesanan, EMAIL_MEMBER),
      });

      expect(hasil.totalBelanja).toBe(output.pendapatan);
    },
  );

  it("Contoh PRD §9.3: tiga Pesanan Selesai dihitung, Pesanan Bermasalah tidak, dan hasilnya membawa Pesanan yang dihitung", () => {
    const hasil = totalBelanja({
      emailMember: EMAIL_MEMBER,
      pesanan: pesananBeremail(
        pendapatanGolden.kasus[0].input.pesanan,
        EMAIL_MEMBER,
      ),
    });

    expect(hasil.jumlahPesananSelesai).toBe(3);
    expect(hasil.dihitung.map((p) => p.totalBayar)).toEqual([
      45123, 50010, 135499,
    ]);
  });

  it("Dana Dikembalikan dan Pesanan yang belum dibayar tidak dihitung", () => {
    const hasil = totalBelanja({
      emailMember: EMAIL_MEMBER,
      pesanan: [
        {
          status: "Dana Dikembalikan",
          totalBayar: 40000,
          dibayarPada: new Date("2026-11-11T08:00:00+07:00"),
          email: EMAIL_MEMBER,
        },
        {
          status: "Menunggu Pembayaran",
          totalBayar: 45123,
          dibayarPada: null,
          email: EMAIL_MEMBER,
        },
      ],
    });

    expect(hasil).toMatchObject({ totalBelanja: 0, jumlahPesananSelesai: 0 });
  });

  it("tanpa batas waktu: Pesanan Selesai yang dibayar bertahun-tahun lalu ikut dihitung", () => {
    const hasil = totalBelanja({
      emailMember: EMAIL_MEMBER,
      pesanan: [
        {
          status: "Selesai",
          totalBayar: 45123,
          dibayarPada: new Date("2024-01-05T10:00:00+07:00"),
          email: EMAIL_MEMBER,
        },
        {
          status: "Selesai",
          totalBayar: 135499,
          dibayarPada: new Date("2026-11-17T20:45:00+07:00"),
          email: EMAIL_MEMBER,
        },
      ],
    });

    expect(hasil).toMatchObject({
      totalBelanja: 180622,
      jumlahPesananSelesai: 2,
    });
  });

  // PRD §7.4: Pesanan Member adalah Pesanan yang emailnya sama dengan email Member.
  it.each(kesamaanEmail.kasus)(
    "kesamaan email, $nama: Pesanan beremail $input.a dihitung untuk Member $input.b bila emailnya sama",
    ({ input, output }) => {
      const hasil = totalBelanja({
        emailMember: input.b,
        pesanan: [
          {
            status: "Selesai",
            totalBayar: 45123,
            dibayarPada: new Date("2026-11-11T09:00:00+07:00"),
            email: input.a,
          },
        ],
      });

      expect(hasil.jumlahPesananSelesai).toBe(output.sama ? 1 : 0);
    },
  );
});
