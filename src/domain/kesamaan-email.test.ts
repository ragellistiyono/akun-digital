import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/kesamaan-email.json";
import { emailBaku, emailSama } from "./kesamaan-email";

// PRD §7.4: email dianggap sama tanpa membedakan huruf besar dan kecil, dan tanpa spasi di awal
// atau akhir. Dua email sama bila bentuk bakunya sama.
describe("emailBaku", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(emailBaku(input.a) === emailBaku(input.b)).toBe(output.sama);
  });
});

describe("emailSama", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(emailSama(input.a, input.b)).toBe(output.sama);
  });

  it("tab, NBSP, dan baris baru di ujung juga diabaikan, seperti spasi", () => {
    expect(emailSama("\tBudi@Mail.com\u00a0\n", "budi@mail.com")).toBe(true);
  });
});
