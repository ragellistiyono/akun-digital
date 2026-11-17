import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db, koneksi } from "../db";
import { user } from "../db/schema";
import { sisipkanMember } from "../uji-member";
import { buatAdmin } from "./buat-admin";
import { masukAdmin } from "./masuk";

// Test integrasi dengan database app_test (.env.ci).
afterAll(async () => {
  await koneksi.end();
});

describe("buatAdmin (PRD §2.2, §7.2 ▶ Keputusan 2026-11-17)", () => {
  it("menolak email Member, juga bila huruf besarnya berbeda, tanpa membuat Admin", async () => {
    const email = `member-${randomUUID()}@example.test`;
    await sisipkanMember({ email, password: "sandi-uji-member-123" });

    expect(
      await buatAdmin({
        email: email.toUpperCase(),
        password: "sandi-uji-admin-123",
      }),
    ).toEqual({ hasil: "email-milik-member" });

    const baris = await db
      .select({ peran: user.peran })
      .from(user)
      .where(eq(user.email, email));
    expect(baris).toEqual([{ peran: "Member" }]);
    expect(
      await masukAdmin({
        email,
        password: "sandi-uji-admin-123",
        kepala: new Headers(),
      }),
    ).toEqual({ hasil: "ditolak" });
  });

  it("menolak email Admin lain", async () => {
    const email = `admin-${randomUUID()}@example.test`;
    await buatAdmin({ email, password: "sandi-uji-admin-123" });

    expect(await buatAdmin({ email, password: "sandi-uji-admin-456" })).toEqual(
      { hasil: "email-sudah-dipakai" },
    );
  });
});
