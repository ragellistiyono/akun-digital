import { describe, expect, it } from "vitest";

import { passwordCukupPanjang } from "./password";

// PRD §7.5: password minimal 8 karakter. Admin memakai syarat yang sama.
describe("passwordCukupPanjang", () => {
  it("menolak password 7 karakter", () => {
    expect(passwordCukupPanjang("abcdefg")).toBe(false);
  });

  it("menerima password tepat 8 karakter", () => {
    expect(passwordCukupPanjang("abcdefgh")).toBe(true);
  });
});
