import { randomUUID } from "node:crypto";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { koneksi } from "../db";
import { buatAdmin } from "./buat-admin";
import { masukAdmin } from "./masuk-admin";

// Test integrasi dengan database app_test (.env.ci). Jam dikendalikan lewat Date palsu, sementara
// timer asli tetap jalan supaya koneksi database tidak terganggu.
const PASSWORD = "sandi-uji-admin-123";
const PASSWORD_SALAH = "password-yang-salah";

async function adminBaru() {
  const email = `admin-${randomUUID()}@example.test`;
  await buatAdmin({ email, password: PASSWORD });
  return email;
}

function pada(jam: string) {
  vi.setSystemTime(new Date(`2026-11-11T${jam}+07:00`));
}

function masuk(email: string, password: string) {
  return masukAdmin({ email, password, kepala: new Headers() });
}

/** Lima kali salah berturut-turut, dengan kesalahan kelima pukul 10.00 WIB. */
async function salahLimaKali(email: string) {
  for (const jam of [
    "09:56:00",
    "09:57:00",
    "09:58:00",
    "09:59:00",
    "10:00:00",
  ]) {
    pada(jam);
    await masuk(email, PASSWORD_SALAH);
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await koneksi.end();
});

describe("batas salah password login Admin (PRD §7.7)", () => {
  it("setelah 5 kali salah, password benar ditolak sebelum 15 menit lewat", async () => {
    const email = await adminBaru();
    await salahLimaKali(email);

    pada("10:14:00");
    expect(await masuk(email, PASSWORD)).toEqual({
      hasil: "terkunci",
      terkunciSampai: new Date("2026-11-11T10:15:00+07:00"),
    });
  });

  it("tepat 15 menit setelah kesalahan kelima, password benar diterima", async () => {
    const email = await adminBaru();
    await salahLimaKali(email);

    pada("10:15:00");
    expect(await masuk(email, PASSWORD)).toEqual({ hasil: "berhasil" });
  });

  it("empat kali salah, sekali benar, lalu empat kali salah lagi: email itu masih bisa login", async () => {
    const email = await adminBaru();
    pada("10:00:00");

    for (let i = 0; i < 4; i++) {
      expect(await masuk(email, PASSWORD_SALAH)).toEqual({ hasil: "ditolak" });
    }
    expect(await masuk(email, PASSWORD)).toEqual({ hasil: "berhasil" });
    for (let i = 0; i < 4; i++) {
      expect(await masuk(email, PASSWORD_SALAH)).toEqual({ hasil: "ditolak" });
    }
    expect(await masuk(email, PASSWORD)).toEqual({ hasil: "berhasil" });
  });

  it("email dengan huruf besar dan kecil yang berbeda dihitung sebagai email yang sama", async () => {
    const email = await adminBaru();
    const [nama, domain] = email.split("@");
    const percobaan = [
      { jam: "09:56:00", emailDiketik: email.toUpperCase() },
      { jam: "09:57:00", emailDiketik: `${nama}@${domain.toUpperCase()}` },
      { jam: "09:58:00", emailDiketik: `  ${email} ` },
      { jam: "09:59:00", emailDiketik: `Admin${nama.slice(5)}@Example.Test` },
      { jam: "10:00:00", emailDiketik: email },
    ];

    for (const { jam, emailDiketik } of percobaan) {
      pada(jam);
      await masuk(emailDiketik, PASSWORD_SALAH);
    }

    pada("10:14:00");
    expect(await masuk(email, PASSWORD)).toEqual({
      hasil: "terkunci",
      terkunciSampai: new Date("2026-11-11T10:15:00+07:00"),
    });
  });

  it("kesalahan kelima langsung ditolak dengan jam kunci berakhir", async () => {
    const email = await adminBaru();
    for (const jam of ["09:56:00", "09:57:00", "09:58:00", "09:59:00"]) {
      pada(jam);
      expect(await masuk(email, PASSWORD_SALAH)).toEqual({ hasil: "ditolak" });
    }

    pada("10:00:00");
    expect(await masuk(email, PASSWORD_SALAH)).toEqual({
      hasil: "terkunci",
      terkunciSampai: new Date("2026-11-11T10:15:00+07:00"),
    });
  });

  it("email yang tidak terdaftar ditolak dan dikunci dengan cara yang sama, supaya email Admin tidak bocor", async () => {
    const email = `bukan-admin-${randomUUID()}@example.test`;
    for (const jam of ["09:56:00", "09:57:00", "09:58:00", "09:59:00"]) {
      pada(jam);
      expect(await masuk(email, PASSWORD_SALAH)).toEqual({ hasil: "ditolak" });
    }

    pada("10:00:00");
    expect(await masuk(email, PASSWORD_SALAH)).toEqual({
      hasil: "terkunci",
      terkunciSampai: new Date("2026-11-11T10:15:00+07:00"),
    });
  });

  it("percobaan salah yang datang bersamaan tetap dihitung satu per satu", async () => {
    const email = await adminBaru();
    pada("10:00:00");

    await Promise.all(
      Array.from({ length: 8 }, () => masuk(email, PASSWORD_SALAH)),
    );

    pada("10:14:00");
    expect(await masuk(email, PASSWORD)).toEqual({
      hasil: "terkunci",
      terkunciSampai: new Date("2026-11-11T10:15:00+07:00"),
    });
  });
});
