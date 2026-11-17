import { describe, expect, it } from "vitest";

import { emailMilikMemberNonaktif } from "./member-nonaktif";

// PRD §2.3 dan §5.2 ▶ Keputusan 2026-11-17: checkout dengan email Member nonaktif ditolak. Email
// dibandingkan menurut §7.4, dengan contoh `Budi@Mail.com` sama dengan `budi@mail.com`. Data Member sintetis.
describe("emailMilikMemberNonaktif", () => {
  const semuaMemberNonaktif = [{ email: "budi@mail.com" }];

  it("email Member nonaktif yang ditulis Budi@Mail.com dengan spasi di ujung tetap milik Member nonaktif", () => {
    expect(
      emailMilikMemberNonaktif({
        email: " Budi@Mail.com ",
        semuaMemberNonaktif,
      }),
    ).toBe(true);
  });

  it("email yang bukan milik Member nonaktif mana pun boleh lanjut", () => {
    expect(
      emailMilikMemberNonaktif({ email: "andi@mail.com", semuaMemberNonaktif }),
    ).toBe(false);
  });

  it("tanpa Member nonaktif, tidak ada email yang milik Member nonaktif", () => {
    expect(
      emailMilikMemberNonaktif({
        email: "budi@mail.com",
        semuaMemberNonaktif: [],
      }),
    ).toBe(false);
  });
});
