import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/pemakaian-voucher.json";
import { pemakaianVoucher } from "./pemakaian-voucher";
import type { StatusPesanan } from "./status-pesanan";

type KasusGolden = (typeof golden.kasus)[number];

/** Input golden dengan status sebagai StatusPesanan. */
const inputGolden = ({
  emailCheckout,
  pesananDenganVoucher,
}: KasusGolden["input"]) => ({
  emailCheckout,
  pesananDenganVoucher: pesananDenganVoucher.map((p) => ({
    email: p.email,
    status: p.status as StatusPesanan,
  })),
});

// PRD §8.5: pemakaian Voucher dihitung dari Pesanan Menunggu Pembayaran, Selesai, atau Bermasalah yang memakai
// Voucher itu. Batas per email menghitung Pesanan dengan email yang sama menurut §7.4.
describe("pemakaianVoucher", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const hasil = pemakaianVoucher(inputGolden(input));

    expect({ total: hasil.total, olehEmail: hasil.olehEmail }).toEqual(output);
  });

  it("membawa Pesanan yang dihitung sebagai bahan hitungnya", () => {
    const hasil = pemakaianVoucher(inputGolden(golden.kasus[0].input));

    expect(hasil.dihitung).toEqual([
      { email: "budi@mail.com", status: "Selesai" },
      { email: "sinta@mail.com", status: "Menunggu Pembayaran" },
      { email: "andi@mail.com", status: "Bermasalah" },
    ]);
  });

  it("tanpa email checkout, misalnya di daftar Voucher dasbor admin, hanya total yang dihitung", () => {
    const hasil = pemakaianVoucher({
      emailCheckout: null,
      pesananDenganVoucher: [
        { email: "andi@mail.com", status: "Menunggu Pembayaran" },
        { email: "andi@mail.com", status: "Dibatalkan" },
      ],
    });

    expect({ total: hasil.total, olehEmail: hasil.olehEmail }).toEqual({
      total: 1,
      olehEmail: null,
    });
  });
});
