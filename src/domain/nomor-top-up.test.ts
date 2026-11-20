import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/nomor-top-up.json";
import { nomorTopUp, nomorTopUpSah, rujukanTopUp } from "./nomor-top-up";

// PRD §15.3: TOPUP- diikuti 6 karakter dengan aturan Nomor Pesanan (§9.6).
describe("nomorTopUpSah", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(nomorTopUpSah(input.nomor)).toBe(output.valid);
  });
});

describe("nomorTopUp", () => {
  it("setiap nilai byte menghasilkan Nomor Top up yang sah", () => {
    for (let nilai = 0; nilai < 256; nilai++) {
      const byte = Uint8Array.from({ length: 6 }, (_, i) => (nilai + i) % 256);
      expect(nomorTopUpSah(nomorTopUp(byte))).toBe(true);
    }
  });

  it("menolak byte acak yang kurang dari 6", () => {
    expect(() => nomorTopUp(Uint8Array.of(1, 2, 3))).toThrow(
      new RangeError(
        "Nomor Top up butuh 6 byte acak, tetapi hanya mendapat 3. Panggil nomorTopUp dengan 6 byte acak yang dibuat di lapisan server.",
      ),
    );
  });
});

// Issue T78: kabar pembayaran dikenali sebagai Top up dari awalan TOPUP- pada payment_reference.
describe("rujukanTopUp", () => {
  it.each([
    ["TOPUP-7K3P9Q", true],
    ["MIWE-7K3P9Q", false],
    ["Order-123", false],
    ["", false],
    [undefined, false],
  ])("payment_reference %j → %s", (rujukan, topUp) => {
    expect(rujukanTopUp(rujukan)).toBe(topUp);
  });
});
