import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/jumlah-pesanan-selesai.json";
import { jumlahPesananSelesai } from "./jumlah-pesanan-selesai";
import type { StatusPesanan } from "./status-pesanan";

type KasusGolden = (typeof golden.kasus)[number];

const instanAtauNull = (waktu: string | null) =>
  waktu === null ? null : new Date(waktu);

/** Input golden dengan waktu sebagai instan. */
const inputInstan = ({ rentang, pesanan }: KasusGolden["input"]) => ({
  rentang: {
    mulai: new Date(rentang.mulai),
    sebelum: new Date(rentang.sebelum),
  },
  pesanan: pesanan.map((p) => ({
    status: p.status as StatusPesanan,
    dibuatPada: new Date(p.dibuatPada),
    dibayarPada: instanAtauNull(p.dibayarPada),
    diselesaikanAdminPada: instanAtauNull(p.diselesaikanAdminPada),
  })),
});

// PRD §9.2 ▶ Keputusan 2026-11-17: Pesanan Selesai dihitung menurut waktu pembayaran, sama seperti Pendapatan.
describe("jumlahPesananSelesai", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(jumlahPesananSelesai(inputInstan(input)).jumlah).toBe(output.jumlah);
  });

  it("membawa rentang dan Pesanan yang dihitung sebagai bahan hitungnya", () => {
    const hasil = jumlahPesananSelesai(inputInstan(golden.kasus[1].input));

    expect(hasil.rentang).toEqual({
      mulai: new Date("2026-11-11T00:00:00+07:00"),
      sebelum: new Date("2026-11-12T00:00:00+07:00"),
    });
    expect(hasil.dihitung.map((p) => p.dibuatPada)).toEqual([
      new Date("2026-11-10T23:58:00+07:00"),
    ]);
  });
});
