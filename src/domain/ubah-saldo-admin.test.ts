import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/ubah-saldo-admin.json";
import { bacaNominalSaldo, ubahSaldoAdmin } from "./ubah-saldo-admin";

// PRD §15.6: Tambah saldo dan Kurangi saldo oleh Admin. Nominal rupiah bulat minimal Rp 1, keterangan wajib dan
// paling banyak 100 karakter setelah spasi di tepi dibuang, dan pengurangan tidak boleh melebihi saldo.
describe("ubahSaldoAdmin", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      ubahSaldoAdmin({
        ...input,
        aksi: input.aksi as "tambah" | "kurangi",
      }),
    ).toEqual(output);
  });
});

// DESIGN.md Inputs / Fields ▶ Keputusan 2026-11-20 (issue 224): isian rupiah di dasbor admin berisi angka dengan titik
// ribuan, misalnya "100.000".
describe("bacaNominalSaldo", () => {
  it.each([
    ["50.000", { nominal: 50000 }],
    ["Rp 5.000", { nominal: 5000 }],
    ["-5000", { alasan: "di-bawah-minimal" }],
    ["1.500,5", { alasan: "bukan-rupiah-bulat" }],
  ])("%s dibaca %o", (teks, hasil) => {
    expect(bacaNominalSaldo(teks)).toEqual(hasil);
  });
});
