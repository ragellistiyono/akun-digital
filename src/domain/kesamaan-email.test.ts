import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/kesamaan-email.json";
import { emailBaku } from "./kesamaan-email";

// PRD §7.4: email dianggap sama tanpa membedakan huruf besar dan kecil, dan tanpa spasi di awal
// atau akhir. Dua email sama bila bentuk bakunya sama.
describe("emailBaku", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(emailBaku(input.a) === emailBaku(input.b)).toBe(output.sama);
  });
});
