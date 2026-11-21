import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/bayar-saldo.json";
import { bayarSaldo } from "./bayar-saldo";

// PRD §15.7: yang harus dibayar dengan saldo = Harga jual − potongan voucher, tanpa Kode unik dan tanpa Biaya
// transaksi. Hasilnya membawa bahan hitungnya, yaitu saldo, Harga jual, dan potongan voucher.
describe("bayarSaldo", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(bayarSaldo(input)).toEqual({ ...input, ...output });
  });
});
