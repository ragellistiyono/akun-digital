import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/batas-login.json";
import { percobaanLogin } from "./batas-login";

type KeadaanGolden = { jumlahSalah: number; terkunciSampai: string | null };

function keKeadaan(keadaan: KeadaanGolden) {
  return {
    jumlahSalah: keadaan.jumlahSalah,
    terkunciSampai:
      keadaan.terkunciSampai === null ? null : new Date(keadaan.terkunciSampai),
  };
}

// PRD §7.7: 5 kali salah berturut-turut mengunci email itu 15 menit sejak kesalahan kelima.
describe("percobaanLogin", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      percobaanLogin({
        keadaan: keKeadaan(input.keadaan),
        sekarang: new Date(input.sekarang),
        passwordBenar: input.passwordBenar,
      }),
    ).toEqual({
      hasil: output.hasil,
      keadaanBaru: keKeadaan(output.keadaanBaru),
    });
  });
});

// PRD §7.5 ▶ Keputusan 2026-11-17: Member nonaktif dengan password benar melihat pesan nonaktif.
// Bila password-nya salah, ia melihat pesan password salah biasa, dan kesalahan itu dihitung (§7.7).
// Jam dan hitungan mengikuti contoh §7.7: kesalahan kelima pukul 10.00 mengunci sampai 10.15.
describe("percobaanLogin Member nonaktif", () => {
  // §7.7: hanya login yang berhasil atau berakhirnya kunci yang mengembalikan hitungan ke 0. Login Member
  // nonaktif bukan login yang berhasil, jadi hitungannya tidak naik dan tidak kembali ke 0.
  it("password benar menghasilkan nonaktif tanpa login, dan hitungan salahnya tidak berubah", () => {
    const duaKaliSalah = { jumlahSalah: 2, terkunciSampai: null };
    expect(
      percobaanLogin({
        keadaan: duaKaliSalah,
        sekarang: new Date("2026-11-17T10:00:00+07:00"),
        passwordBenar: true,
        memberNonaktif: true,
      }),
    ).toEqual({ hasil: "nonaktif", keadaanBaru: duaKaliSalah });
  });

  it("password salah dihitung seperti biasa: salah ketiga menjadi 3", () => {
    expect(
      percobaanLogin({
        keadaan: { jumlahSalah: 2, terkunciSampai: null },
        sekarang: new Date("2026-11-17T09:58:00+07:00"),
        passwordBenar: false,
        memberNonaktif: true,
      }),
    ).toEqual({
      hasil: "salah",
      keadaanBaru: { jumlahSalah: 3, terkunciSampai: null },
    });
  });

  it("salah kelima mengunci 15 menit seperti biasa", () => {
    expect(
      percobaanLogin({
        keadaan: { jumlahSalah: 4, terkunciSampai: null },
        sekarang: new Date("2026-11-17T10:00:00+07:00"),
        passwordBenar: false,
        memberNonaktif: true,
      }),
    ).toEqual({
      hasil: "salah",
      keadaanBaru: {
        jumlahSalah: 5,
        terkunciSampai: new Date("2026-11-17T10:15:00+07:00"),
      },
    });
  });

  it("selama kunci berlaku, password benar pun menghasilkan kunci, bukan pesan nonaktif", () => {
    const terkunci = {
      jumlahSalah: 5,
      terkunciSampai: new Date("2026-11-17T10:15:00+07:00"),
    };
    expect(
      percobaanLogin({
        keadaan: terkunci,
        sekarang: new Date("2026-11-17T10:14:00+07:00"),
        passwordBenar: true,
        memberNonaktif: true,
      }),
    ).toEqual({ hasil: "terkunci", keadaanBaru: terkunci });
  });
});
