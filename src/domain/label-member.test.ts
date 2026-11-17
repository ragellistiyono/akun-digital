import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/label-member.json";
import { labelMember } from "./label-member";

// PRD §11.1 ▶ Keputusan 2026-11-17: label Member di bilah atas adalah bagian email sebelum "@", dipotong
// menjadi 12 karakter diikuti "…" bila lebih panjang.
describe("labelMember", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(labelMember(input.email)).toBe(output.label);
  });
});
