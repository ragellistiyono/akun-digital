import { describe, expect, it } from "vitest";

import { sesiAdminBerlaku } from "./sesi-admin";

// PRD §2.2 ▶ Keputusan 2026-11-11: Admin tetap login selama 12 jam sejak login.
// Tepat 12 jam setelah login sesi sudah berakhir, sama seperti batas waktu lain di PRD (§7.5, §7.7).
describe("sesiAdminBerlaku", () => {
  const waktuLogin = new Date("2026-11-11T08:00:00+07:00");

  it("berlaku tepat saat login", () => {
    expect(sesiAdminBerlaku({ waktuLogin, sekarang: waktuLogin })).toBe(true);
  });

  it("berlaku sedetik sebelum 12 jam sejak login", () => {
    expect(
      sesiAdminBerlaku({
        waktuLogin,
        sekarang: new Date("2026-11-11T19:59:59+07:00"),
      }),
    ).toBe(true);
  });

  it("berakhir tepat 12 jam sejak login", () => {
    expect(
      sesiAdminBerlaku({
        waktuLogin,
        sekarang: new Date("2026-11-11T20:00:00+07:00"),
      }),
    ).toBe(false);
  });

  it("berakhir lebih dari 12 jam sejak login", () => {
    expect(
      sesiAdminBerlaku({
        waktuLogin,
        sekarang: new Date("2026-11-12T09:00:00+07:00"),
      }),
    ).toBe(false);
  });
});
