import { describe, expect, it } from "vitest";

import { labelPotonganVoucher } from "./label-potongan-voucher";

// PRD §8.8 ▶ Keputusan 2026-11-17: di setiap rincian nominal, baris potongan Pesanan yang memakai Voucher ditulis
// "Potongan voucher (HEMAT5)", dan Pesanan tanpa Voucher tetap menulis "Potongan voucher".
describe("labelPotonganVoucher", () => {
  it('Pesanan yang memakai HEMAT5 menulis "Potongan voucher (HEMAT5)"', () => {
    expect(labelPotonganVoucher("HEMAT5")).toBe("Potongan voucher (HEMAT5)");
  });

  it('Pesanan tanpa Voucher menulis "Potongan voucher"', () => {
    expect(labelPotonganVoucher(null)).toBe("Potongan voucher");
  });
});
