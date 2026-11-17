import { describe, expect, it } from "vitest";

import { sesiMemberBerlaku } from "./sesi-member";

// PRD §7.5 ▶ Keputusan 2026-11-11: Member tetap login selama 30 hari sejak login. Tepat 30 hari
// setelah login sesi sudah berakhir, sama seperti batas waktu lain di PRD (§2.2, §7.7).
describe("sesiMemberBerlaku", () => {
  const waktuLogin = new Date("2026-11-11T08:00:00+07:00");

  it("berlaku tepat saat login", () => {
    expect(sesiMemberBerlaku({ waktuLogin, sekarang: waktuLogin })).toBe(true);
  });

  it("berlaku 29 hari 23 jam setelah login", () => {
    expect(
      sesiMemberBerlaku({
        waktuLogin,
        sekarang: new Date("2026-12-11T07:00:00+07:00"),
      }),
    ).toBe(true);
  });

  it("berlaku sedetik sebelum 30 hari sejak login", () => {
    expect(
      sesiMemberBerlaku({
        waktuLogin,
        sekarang: new Date("2026-12-11T07:59:59+07:00"),
      }),
    ).toBe(true);
  });

  it("berakhir tepat 30 hari sejak login", () => {
    expect(
      sesiMemberBerlaku({
        waktuLogin,
        sekarang: new Date("2026-12-11T08:00:00+07:00"),
      }),
    ).toBe(false);
  });
});
