import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/kode-voucher.json";
import { periksaKodeVoucher } from "./kode-voucher";

// PRD §8.1 dan §8.4 (▶ Keputusan 2026-11-17): kode Voucher hanya huruf A–Z dan angka 0–9, 3 sampai 20
// karakter, disimpan huruf besar, dan unik tanpa membedakan huruf besar dan kecil.
describe("periksaKodeVoucher", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(periksaKodeVoucher(input)).toEqual(output);
  });
});
