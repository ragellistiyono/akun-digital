import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/panjang-password.json";
import { periksaPanjangPassword } from "./panjang-password";

// PRD §7.5 dan §2.2 (▶ Keputusan 2026-11-11 #53): password Member dan Admin minimal 8 karakter.
describe("periksaPanjangPassword", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(periksaPanjangPassword(input.password)).toEqual(output);
  });
});
