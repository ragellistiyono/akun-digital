import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

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
