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
import { sisipkanMember } from "../uji-member";
import { auth } from "./auth";
import { gantiPasswordMember } from "./ganti-password";
import { masukMember } from "./masuk";
import { bacaSesiMember } from "./sesi-member";

// Test integrasi dengan database app_test (.env.ci): ganti password di tab Akun (PRD §7.6
// ▶ Keputusan 2026-11-17).
const PASSWORD_LAMA = "sandi-lama-member-1";
const PASSWORD_BARU = "sandi-baru-member-2";

/** Login Member di satu "perangkat", lalu kembalikan cookie sesinya seperti yang dikirim browser. */
async function loginDiPerangkat(email: string, password: string) {
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((baris) => baris.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

async function memberLoginDiDuaPerangkat() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD_LAMA });
  const ponsel = await loginDiPerangkat(email, PASSWORD_LAMA);
  const laptop = await loginDiPerangkat(email, PASSWORD_LAMA);
  const sesiLaptop = await bacaSesiMember(laptop);
  if (!sesiLaptop) throw new Error("Member tidak login di laptop.");
  return { email, ponsel, laptop, sesiLaptop };
}

function ganti(
  sesi: NonNullable<Awaited<ReturnType<typeof bacaSesiMember>>>,
  passwordLama: string,
) {
  return gantiPasswordMember({
    idUser: sesi.user.id,
    idSesi: sesi.session.id,
    passwordLama,
    passwordBaru: PASSWORD_BARU,
  });
}

function masuk(email: string, password: string) {
  return masukMember({ email, password, kepala: new Headers() });
}

afterAll(async () => {
  await koneksi.end();
});

describe("ganti password Member (PRD §7.6 ▶ Keputusan 2026-11-17)", () => {
  it("password lama yang salah ditolak, password tidak berubah, dan sesi lain tetap berlaku", async () => {
    const { email, ponsel, laptop, sesiLaptop } =
      await memberLoginDiDuaPerangkat();

    expect(await ganti(sesiLaptop, "password-yang-salah")).toEqual({
      hasil: "password-lama-salah",
    });

    expect(await bacaSesiMember(ponsel)).not.toBeNull();
    expect(await bacaSesiMember(laptop)).not.toBeNull();
    expect(await masuk(email, PASSWORD_BARU)).toEqual({ hasil: "ditolak" });
    expect(await masuk(email, PASSWORD_LAMA)).toEqual({ hasil: "berhasil" });
  });

  it("password lama yang salah tidak dihitung ke batas salah password login (PRD §7.7)", async () => {
    const { email, sesiLaptop } = await memberLoginDiDuaPerangkat();

    for (let i = 1; i <= 5; i++) {
      await ganti(sesiLaptop, "password-yang-salah");
    }

    expect(await masuk(email, PASSWORD_LAMA)).toEqual({ hasil: "berhasil" });
  });

  it("setelah diganti, password baru diterima dan password lama ditolak saat login", async () => {
    const { email, sesiLaptop } = await memberLoginDiDuaPerangkat();

    expect(await ganti(sesiLaptop, PASSWORD_LAMA)).toEqual({
      hasil: "berhasil",
    });

    expect(await masuk(email, PASSWORD_LAMA)).toEqual({ hasil: "ditolak" });
    expect(await masuk(email, PASSWORD_BARU)).toEqual({ hasil: "berhasil" });
  });

  it("setelah diganti, sesi di perangkat lain berakhir dan sesi di perangkat ini tetap sama", async () => {
    const { ponsel, laptop, sesiLaptop } = await memberLoginDiDuaPerangkat();

    await ganti(sesiLaptop, PASSWORD_LAMA);

    expect(await bacaSesiMember(ponsel)).toBeNull();
    const sesiLaptopSetelahnya = await bacaSesiMember(laptop);
    // Sesi yang sama, jadi batas 30 harinya tetap dihitung sejak login semula (PRD §7.5).
    expect(sesiLaptopSetelahnya?.session.id).toBe(sesiLaptop.session.id);
  });
});

// PRD §7.6 ▶ Keputusan 2026-11-17 dan tests/golden/batas-ganti-password.json: kesalahan kelima
// pukul 10.00 mengunci ganti password sampai 10.15. Jam dikendalikan lewat Date palsu, sementara timer
// asli tetap jalan supaya koneksi database tidak terganggu.
describe("batas salah password lama di ganti password (PRD §7.6 ▶ Keputusan 2026-11-17)", () => {
  const SALAH = "password-yang-salah";
  const TERKUNCI_SAMPAI = new Date("2026-11-17T10:15:00+07:00");

  function pada(jam: string) {
    vi.setSystemTime(new Date(`2026-11-17T${jam}+07:00`));
  }

  async function memberLogin() {
    pada("09:50:00");
    return memberLoginDiDuaPerangkat();
  }

  /** Lima kali salah password lama berturut-turut, dengan kesalahan kelima pukul 10.00 WIB. */
  async function salahLimaKali(
    sesi: Awaited<ReturnType<typeof memberLogin>>["sesiLaptop"],
  ) {
    for (const jam of [
      "09:56:00",
      "09:57:00",
      "09:58:00",
      "09:59:00",
      "10:00:00",
    ]) {
      pada(jam);
      await ganti(sesi, SALAH);
    }
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("kesalahan kelima langsung menghasilkan kunci sampai 15 menit kemudian", async () => {
    const { sesiLaptop } = await memberLogin();
    for (const jam of ["09:56:00", "09:57:00", "09:58:00", "09:59:00"]) {
      pada(jam);
      expect(await ganti(sesiLaptop, SALAH)).toEqual({
        hasil: "password-lama-salah",
      });
    }

    pada("10:00:00");
    expect(await ganti(sesiLaptop, SALAH)).toEqual({
      hasil: "terkunci",
      terkunciSampai: TERKUNCI_SAMPAI,
    });
  });

  it("setelah 5 kali salah, password lama yang benar ditolak dengan kunci, dan password tidak berubah", async () => {
    const { email, sesiLaptop } = await memberLogin();
    await salahLimaKali(sesiLaptop);

    pada("10:14:00");
    expect(await ganti(sesiLaptop, PASSWORD_LAMA)).toEqual({
      hasil: "terkunci",
      terkunciSampai: TERKUNCI_SAMPAI,
    });

    expect(await masuk(email, PASSWORD_BARU)).toEqual({ hasil: "ditolak" });
    expect(await masuk(email, PASSWORD_LAMA)).toEqual({ hasil: "berhasil" });
  });

  it("tepat 15 menit setelah kesalahan kelima, ganti password dengan password lama yang benar berhasil", async () => {
    const { email, sesiLaptop } = await memberLogin();
    await salahLimaKali(sesiLaptop);

    pada("10:15:00");
    expect(await ganti(sesiLaptop, PASSWORD_LAMA)).toEqual({
      hasil: "berhasil",
    });
    expect(await masuk(email, PASSWORD_BARU)).toEqual({ hasil: "berhasil" });
  });

  it("selama ganti password terkunci, Member tetap bisa login dengan password-nya", async () => {
    const { email, laptop, sesiLaptop } = await memberLogin();
    await salahLimaKali(sesiLaptop);

    pada("10:05:00");
    expect(await masuk(email, PASSWORD_LAMA)).toEqual({ hasil: "berhasil" });
    // Member tetap masuk di perangkat yang sedang dipakai.
    expect(await bacaSesiMember(laptop)).not.toBeNull();
    // Login yang berhasil tidak membuka kunci ganti password.
    expect(await ganti(sesiLaptop, PASSWORD_LAMA)).toEqual({
      hasil: "terkunci",
      terkunciSampai: TERKUNCI_SAMPAI,
    });
  });

  it("kesalahan password lama tidak mengubah hitungan salah login", async () => {
    const { email, sesiLaptop } = await memberLogin();
    // Tiga kali salah login lebih dulu, lalu ganti password terkunci.
    for (const jam of ["09:51:00", "09:52:00", "09:53:00"]) {
      pada(jam);
      expect(await masuk(email, SALAH)).toEqual({ hasil: "ditolak" });
    }
    await salahLimaKali(sesiLaptop);

    // Hitungan salah login masih 3: salah keempat ditolak biasa, salah kelima mengunci login.
    pada("10:01:00");
    expect(await masuk(email, SALAH)).toEqual({ hasil: "ditolak" });
    pada("10:02:00");
    expect(await masuk(email, SALAH)).toEqual({
      hasil: "terkunci",
      terkunciSampai: new Date("2026-11-17T10:17:00+07:00"),
    });
  });

  // UAT-G7 ▶ Keputusan 2026-11-17.
  it("ganti password yang berhasil mengembalikan hitungan ke 0", async () => {
    const { sesiLaptop } = await memberLogin();
    for (const jam of ["09:56:00", "09:57:00", "09:58:00", "09:59:00"]) {
      pada(jam);
      await ganti(sesiLaptop, SALAH);
    }
    pada("10:00:00");
    expect(await ganti(sesiLaptop, PASSWORD_LAMA)).toEqual({
      hasil: "berhasil",
    });

    // Empat kesalahan lagi belum mengunci, jadi password lama yang benar (kini PASSWORD_BARU) diterima.
    for (const jam of ["10:01:00", "10:02:00", "10:03:00", "10:04:00"]) {
      pada(jam);
      expect(await ganti(sesiLaptop, SALAH)).toEqual({
        hasil: "password-lama-salah",
      });
    }
    pada("10:05:00");
    expect(
      await gantiPasswordMember({
        idUser: sesiLaptop.user.id,
        idSesi: sesiLaptop.session.id,
        passwordLama: PASSWORD_BARU,
        passwordBaru: PASSWORD_LAMA,
      }),
    ).toEqual({ hasil: "berhasil" });
  });
});
