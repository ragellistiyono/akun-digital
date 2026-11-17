import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { auth } from "./auth/auth";
import { buatAdmin } from "./auth/buat-admin";
import { masukMember } from "./auth/masuk";
import { bacaSesiMember } from "./auth/sesi-member";
import { db, koneksi } from "./db";
import { user } from "./db/schema";
import { ubahStatusMember } from "./status-member";
import { sisipkanMember } from "./uji-member";

// Test integrasi dengan database app_test (.env.ci), yang dipakai bersama test lain, jadi setiap test memakai
// Member dengan email unik. PRD §2.3 ▶ Keputusan 2026-11-17, UAT-B3.
const PASSWORD = "sandi-uji-member-123";

afterAll(async () => {
  await koneksi.end();
});

async function idUser(email: string) {
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return id;
}

async function memberBaru() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD });
  return { email, id: await idUser(email) };
}

/** Header berisi cookie sesi setelah login, seperti yang dikirim browser kembali. */
async function cookieSetelahLogin(email: string) {
  const { headers } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((baris) => baris.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

describe("ubahStatusMember", () => {
  it("menonaktifkan Member langsung mengakhiri sesinya di semua perangkat", async () => {
    const member = await memberBaru();
    const ponsel = await cookieSetelahLogin(member.email);
    const laptop = await cookieSetelahLogin(member.email);
    expect(await bacaSesiMember(ponsel)).not.toBeNull();

    expect(
      await ubahStatusMember({ idMember: member.id, nonaktif: true }),
    ).toEqual({ hasil: "diubah" });

    expect(await bacaSesiMember(ponsel)).toBeNull();
    expect(await bacaSesiMember(laptop)).toBeNull();
  });

  it("setelah diaktifkan kembali, Member login lagi seperti biasa", async () => {
    const member = await memberBaru();
    await ubahStatusMember({ idMember: member.id, nonaktif: true });

    expect(
      await ubahStatusMember({ idMember: member.id, nonaktif: false }),
    ).toEqual({ hasil: "diubah" });

    expect(
      await masukMember({
        email: member.email,
        password: PASSWORD,
        kepala: new Headers(),
      }),
    ).toEqual({ hasil: "berhasil" });
  });

  it("Admin tidak bisa dinonaktifkan lewat status Member, dan id yang tidak ada tidak mengubah apa pun", async () => {
    const emailAdmin = `admin-${randomUUID()}@example.test`;
    await buatAdmin({ email: emailAdmin, password: PASSWORD });
    const idAdmin = await idUser(emailAdmin);

    expect(
      await ubahStatusMember({ idMember: idAdmin, nonaktif: true }),
    ).toEqual({ hasil: "tidak-ada" });
    expect(
      await ubahStatusMember({ idMember: randomUUID(), nonaktif: true }),
    ).toEqual({ hasil: "tidak-ada" });

    const [admin] = await db
      .select({ nonaktif: user.nonaktif })
      .from(user)
      .where(eq(user.id, idAdmin));
    expect(admin).toEqual({ nonaktif: false });
  });
});
