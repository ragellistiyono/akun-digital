import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/laba.json";
import { laba } from "./laba";
import type { StatusPesanan } from "./status-pesanan";

type KasusGolden = (typeof golden.kasus)[number];

/** Input golden dengan waktu sebagai instan. Rentang null berarti sepanjang waktu. */
const inputInstan = ({
  rentang,
  denganBiayaOperasional,
  pesanan,
  biayaOperasional,
}: KasusGolden["input"]) => ({
  rentang:
    rentang === null
      ? null
      : { mulai: new Date(rentang.mulai), sebelum: new Date(rentang.sebelum) },
  denganBiayaOperasional,
  pesanan: pesanan.map((p) => ({
    ...p,
    status: p.status as StatusPesanan,
    dibayarPada: p.dibayarPada === null ? null : new Date(p.dibayarPada),
  })),
  biayaOperasional,
});

// PRD §9.2, §14.2, §14.5: Total Harga modal, Laba kotor, dan Laba bersih dalam suatu rentang.
describe("laba", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const hasil = laba(inputInstan(input));

    expect({
      pendapatan: hasil.pendapatan,
      pesananSelesai: hasil.pesananSelesai,
      totalHargaModal: hasil.totalHargaModal,
      labaKotor: hasil.labaKotor,
      potonganVoucher: hasil.potonganVoucher,
      kodeUnik: hasil.kodeUnik,
      biayaTransaksi: hasil.biayaTransaksi,
      biayaOperasional: hasil.biayaOperasional,
      labaBersih: hasil.labaBersih,
      pesananTanpaHargaModal: hasil.pesananTanpaHargaModal,
    }).toEqual(output);
  });

  it("membawa Pesanan dan Biaya operasional yang dihitung sebagai bahan hitungnya", () => {
    const kasus = golden.kasus.find(
      (k) =>
        k.nama ===
        "Pesanan tanpa Harga modal masuk Pendapatan tetapi tidak masuk laba",
    );
    if (!kasus) throw new Error("Kasus golden tidak ditemukan.");

    const hasil = laba(inputInstan(kasus.input));

    expect(hasil.dihitung.map((p) => p.totalBayar)).toEqual([
      45123, 50010, 135499,
    ]);
    expect(hasil.tanpaHargaModal.map((p) => p.totalBayar)).toEqual([20321]);
    expect(hasil.biayaOperasionalDihitung).toEqual([
      { tanggal: "2026-11-11", nominal: 10000 },
    ]);
  });
});
