import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/isian-top-up.json";
import { periksaIsianTopUp } from "./isian-top-up";

// PRD §15.3: Nominal top up rupiah bulat, minimal Rp 10.000 dan maksimal Rp 499.000.
describe("periksaIsianTopUp", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(periksaIsianTopUp(input)).toEqual(output);
  });
});
