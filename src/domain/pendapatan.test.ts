import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/pendapatan-tanpa-kode-unik.json";
import type { StatusPesanan } from "./status-pesanan";
import { pendapatan } from "./pendapatan";

type KasusGolden = (typeof golden.kasus)[number];

/** Input golden dengan waktu sebagai instan. */
const inputInstan = ({ rentang, pesanan }: KasusGolden["input"]) => ({
  rentang: {
    mulai: new Date(rentang.mulai),
    sebelum: new Date(rentang.sebelum),
  },
  pesanan: pesanan.map((p) => ({
    ...p,
    status: p.status as StatusPesanan,
    dibayarPada: new Date(p.dibayarPada),
  })),
});

// PRD §9.3 ▶ Keputusan 2026-11-23: Pendapatan adalah jumlah (Harga jual − potongan voucher) Pesanan Selesai menurut
// waktu pembayarannya, tanpa Kode unik, karena Kode unik tidak masuk saldo toko.
describe("pendapatan", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(pendapatan(inputInstan(input)).pendapatan).toBe(output.pendapatan);
  });

  it("membawa rentang dan Pesanan yang dihitung sebagai bahan hitungnya", () => {
    const hasil = pendapatan(inputInstan(golden.kasus[0].input));

    expect(hasil.rentang).toEqual({
      mulai: new Date("2026-11-11T00:00:00+07:00"),
      sebelum: new Date("2026-11-12T00:00:00+07:00"),
    });
    expect(hasil.dihitung.map((p) => p.totalBayar)).toEqual([
      45123, 50010, 135499,
    ]);
  });

  it("Pesanan yang belum dibayar tidak dihitung", () => {
    const hasil = pendapatan({
      rentang: {
        mulai: new Date("2026-11-11T00:00:00+07:00"),
        sebelum: new Date("2026-11-12T00:00:00+07:00"),
      },
      pesanan: [
        {
          status: "Kedaluwarsa",
          hargaJual: 50000,
          potonganVoucher: 5000,
          dibayarPada: null,
        },
      ],
    });

    expect(hasil.pendapatan).toBe(0);
  });
});
