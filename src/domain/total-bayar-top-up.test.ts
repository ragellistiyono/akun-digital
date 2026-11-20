import { describe, expect, it } from "vitest";

import { periksaTagihanQrisTopUp } from "./total-bayar-top-up";

// PRD §15.3: Total bayar Top up = Nominal top up + Kode unik. Contoh PRD: Rp 50.000 dan Kode unik Rp 123
// menghasilkan Total bayar Rp 50.123. ADR-0004: Total bayar adalah `amount`, Kode unik `unique_id`.
describe("periksaTagihanQrisTopUp", () => {
  it("contoh PRD: Nominal top up Rp 50.000 dan Kode unik Rp 123", () => {
    expect(
      periksaTagihanQrisTopUp({
        nominalTopUp: 50000,
        requestedAmount: 50000,
        uniqueId: 123,
        amount: 50123,
      }),
    ).toEqual({
      cocok: true,
      rincian: { nominalTopUp: 50000, kodeUnik: 123, totalBayar: 50123 },
    });
  });

  it("menolak QRIS yang requested_amount-nya bukan Nominal top up", () => {
    expect(
      periksaTagihanQrisTopUp({
        nominalTopUp: 50000,
        requestedAmount: 49000,
        uniqueId: 123,
        amount: 49123,
      }),
    ).toEqual({ cocok: false, alasan: "requested-amount-tidak-cocok" });
  });

  it("menolak QRIS yang amount-nya bukan Nominal top up + Kode unik", () => {
    expect(
      periksaTagihanQrisTopUp({
        nominalTopUp: 50000,
        requestedAmount: 50000,
        uniqueId: 123,
        amount: 50000,
      }),
    ).toEqual({ cocok: false, alasan: "amount-tidak-cocok" });
  });
});
