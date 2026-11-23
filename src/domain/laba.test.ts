import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/laba-tanpa-kode-unik.json";
import goldenTopUp from "../../tests/golden/laba-top-up-tanpa-kode-unik.json";
import type { Metode } from "./bayar-saldo";
import { laba, pesananMenurutMetode } from "./laba";
import type { StatusPesanan } from "./status-pesanan";
import type { StatusTopUp } from "./status-top-up";

type KasusGolden = (typeof golden.kasus)[number];
type KasusGoldenTopUp = (typeof goldenTopUp.kasus)[number];

/** Rentang golden sebagai instan. Rentang null berarti sepanjang waktu. */
const rentangInstan = (rentang: { mulai: string; sebelum: string } | null) =>
  rentang === null
    ? null
    : { mulai: new Date(rentang.mulai), sebelum: new Date(rentang.sebelum) };

const instanAtauNull = (waktu: string | null) =>
  waktu === null ? null : new Date(waktu);

/**
 * Input golden laba-tanpa-kode-unik.json dengan waktu sebagai instan. Fixture ini tidak memuat Metode, saringan
 * Metode, dan Top up, jadi saringan Metode-nya Semua dan tidak ada Top up. Pesanan dengan Harga jual Rp 0 di fixture
 * ini adalah Pesanan gratis (kasus berawalan "Pesanan gratis:", PRD §16.5), jadi bermetode Gratis, dan yang lain
 * bermetode QRIS. `denganBiayaOperasional` false berarti saringan Produk atau Kategori aktif.
 */
const inputInstan = ({
  rentang,
  denganBiayaOperasional,
  pesanan,
  biayaOperasional,
}: KasusGolden["input"]) => ({
  rentang: rentangInstan(rentang),
  metode: "Semua" as const,
  saringanProdukAtauKategori: !denganBiayaOperasional,
  pesanan: pesanan.map((p) => ({
    ...p,
    metode: p.hargaJual === 0 ? ("Gratis" as const) : ("QRIS" as const),
    status: p.status as StatusPesanan,
    dibayarPada: instanAtauNull(p.dibayarPada),
  })),
  biayaOperasional,
  topUp: [],
});

/** Input golden laba-top-up-tanpa-kode-unik.json dengan waktu sebagai instan. */
const inputInstanTopUp = ({
  rentang,
  metode,
  saringanProdukAtauKategori,
  pesanan,
  biayaOperasional,
  topUp,
}: KasusGoldenTopUp["input"]) => ({
  rentang: rentangInstan(rentang),
  metode: metode as Metode | "Semua",
  saringanProdukAtauKategori,
  pesanan: pesanan.map((p) => ({
    ...p,
    metode: p.metode as Metode,
    status: p.status as StatusPesanan,
    dibayarPada: instanAtauNull(p.dibayarPada),
  })),
  biayaOperasional,
  topUp: topUp.map((t) => ({
    ...t,
    status: t.status as StatusTopUp,
    dibayarPada: instanAtauNull(t.dibayarPada),
  })),
});

// PRD §9.2, §14.2, §14.5 ▶ Keputusan 2026-11-23, §16.5: Total Harga modal, Laba kotor, dan Laba bersih dalam suatu
// rentang. Kode unik tidak menambah Pendapatan dan Laba bersih, karena tidak masuk saldo toko. Pesanan gratis dihitung
// di jumlah Pesanan Selesai tanpa menambah Pendapatan, dengan Laba kotor Rp 0 − Harga modal.
describe("laba", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const hasil = laba(inputInstan(input));

    expect({
      pendapatan: hasil.pendapatan,
      pesananSelesai: hasil.pesananSelesai,
      totalHargaModal: hasil.totalHargaModal,
      labaKotor: hasil.labaKotor,
      potonganVoucher: hasil.potonganVoucher,
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

  it("saringan Metode Gratis hanya memuat Pesanan gratis, dengan Pendapatan Rp 0", () => {
    const kasus = golden.kasus.find(
      (k) => k.nama === "Pesanan gratis: Contoh PRD §16.5",
    );
    if (!kasus) throw new Error("Kasus golden tidak ditemukan.");

    const hasil = laba({ ...inputInstan(kasus.input), metode: "Gratis" });

    // Contoh PRD §16.5 tanpa Pesanan QRIS-nya: dua Pesanan gratis dengan Harga modal Rp 2.000.
    expect({
      pendapatan: hasil.pendapatan,
      pesananSelesai: hasil.pesananSelesai,
      totalHargaModal: hasil.totalHargaModal,
      labaKotor: hasil.labaKotor,
    }).toEqual({
      pendapatan: 0,
      pesananSelesai: 2,
      totalHargaModal: 4000,
      labaKotor: -4000,
    });
  });
});

// PRD §14.5 dan §15.8 (▶ Keputusan 2026-11-20 dan 2026-11-23): Laba bersih dengan Pesanan saldo, saringan Metode, dan
// Top up. Kode unik Top up tidak menambah Laba bersih, sedangkan Biaya transaksi Top up tetap mengurangkannya.
describe("laba dengan Pesanan saldo dan Top up", () => {
  it.each(goldenTopUp.kasus)("$nama", ({ input, output }) => {
    const hasil = laba(inputInstanTopUp(input));

    expect({
      pendapatan: hasil.pendapatan,
      pesananSelesai: hasil.pesananSelesai,
      totalHargaModal: hasil.totalHargaModal,
      labaKotor: hasil.labaKotor,
      potonganVoucher: hasil.potonganVoucher,
      biayaTransaksi: hasil.biayaTransaksi,
      biayaOperasional: hasil.biayaOperasional,
      biayaTransaksiTopUp: hasil.biayaTransaksiTopUp,
      labaBersih: hasil.labaBersih,
      topUpBerhasil: hasil.topUpBerhasil,
      pesananTanpaHargaModal: hasil.pesananTanpaHargaModal,
    }).toEqual(output);
  });

  it("membawa Top up yang dihitung sebagai bahan hitungnya", () => {
    const kasus = goldenTopUp.kasus.find(
      (k) => k.nama === "Hanya Top up Berhasil yang dihitung",
    );
    if (!kasus) throw new Error("Kasus golden tidak ditemukan.");

    const hasil = laba(inputInstanTopUp(kasus.input));

    expect(hasil.topUpDihitung.map((t) => t.totalBayar)).toEqual([
      150200, 120005,
    ]);
  });
});

// PRD §14.6 ▶ Keputusan 2026-11-20: saringan Metode membatasi Pesanan di rincian angka, grafik, dan tabel.
describe("pesananMenurutMetode", () => {
  const kasus = goldenTopUp.kasus.find(
    (k) => k.nama === "Saringan Metode Saldo",
  );
  if (!kasus) throw new Error("Kasus golden tidak ditemukan.");
  const { pesanan } = inputInstanTopUp(kasus.input);

  it("Saldo hanya memuat Pesanan saldo, dan QRIS hanya memuat Pesanan QRIS", () => {
    expect(
      pesananMenurutMetode({ metode: "Saldo", pesanan }).map(
        (p) => p.totalBayar,
      ),
    ).toEqual([50000]);
    expect(
      pesananMenurutMetode({ metode: "QRIS", pesanan }).map(
        (p) => p.totalBayar,
      ),
    ).toEqual([45123, 50010, 135499]);
  });

  it("Semua memuat Pesanan QRIS dan Saldo", () => {
    expect(
      pesananMenurutMetode({ metode: "Semua", pesanan }).map(
        (p) => p.totalBayar,
      ),
    ).toEqual([45123, 50010, 135499, 50000]);
  });
});
