import { describe, expect, it } from "vitest";

import { batasPesananMenunggu } from "./batas-pesanan-menunggu";
import { bayarSaldo } from "./bayar-saldo";
import { hasilCheckout } from "./checkout";

// PRD §3.7, §5.2 ▶ Keputusan 2026-11-17 langkah 1–5, dan §5.4 ▶ Keputusan 2026-11-12 (#87). Belum ada fixture golden untuk urutan ini, jadi
// ekspektasinya diambil dari contoh PRD §5.4: Item stok terakhir Netflix Premium 1 Bulan sedang ditahan
// Pesanan Andi, sehingga Stok Varian-nya 0. Data Produk dan Pesanan ini sintetis.
const netflixSatuBulan = {
  produk: "Netflix Premium",
  varian: "1 Bulan",
  gratis: false,
};
const pesananAndi = {
  email: "andi@example.test",
  status: "Menunggu Pembayaran",
} as const;
const pesananLain = [pesananAndi];

describe("hasilCheckout", () => {
  it("Andi checkout lagi Netflix Premium 1 Bulan yang Stok Varian-nya 0: berlaku batas Pesanan menunggu dengan Pesanan Andi, bukan stok habis", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "andi@example.test",
          pesananLain,
        }),
        stokVarian: 0,
        memberNonaktif: false,
        voucher: null,
      }),
    ).toEqual({ hasil: "pesanan-menunggu", pesananMenunggu: pesananAndi });
  });

  it("email lain tanpa Pesanan menunggu yang checkout Varian itu ditolak karena stok habis", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 0,
        memberNonaktif: false,
        voucher: null,
      }),
    ).toEqual({ hasil: "stok-habis" });
  });

  it("Varian yang tidak dijual ditolak lebih dulu, walaupun email itu masih punya Pesanan menunggu dan Stok Varian-nya 0", () => {
    expect(
      hasilCheckout({
        varianDijual: undefined,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "andi@example.test",
          pesananLain,
        }),
        stokVarian: 0,
        memberNonaktif: false,
        voucher: null,
      }),
    ).toEqual({ hasil: "tidak-dijual" });
  });

  it("email dengan Pesanan menunggu mengikuti batas Pesanan menunggu juga saat Stok Varian masih ada", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "andi@example.test",
          pesananLain,
        }),
        // Contoh PRD §5.3: 10 Item stok belum terkirim, 2 di antaranya Ditahan.
        stokVarian: 8,
        memberNonaktif: false,
        voucher: null,
      }),
    ).toEqual({ hasil: "pesanan-menunggu", pesananMenunggu: pesananAndi });
  });

  it("email tanpa Pesanan menunggu dan Stok Varian yang masih ada boleh membuat Pesanan untuk Varian itu", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 8,
        memberNonaktif: false,
        voucher: null,
      }),
    ).toEqual({ hasil: "boleh", varianDijual: netflixSatuBulan });
  });

  // PRD §5.2 ▶ Keputusan 2026-11-17: Admin menonaktifkan Member Budi saat Budi masih punya Pesanan
  // Menunggu Pembayaran. Checkout baru dengan email Budi ditolak dengan pesan Member nonaktif.
  const pesananBudi = {
    email: "budi@example.test",
    status: "Menunggu Pembayaran",
  } as const;

  it("Member nonaktif Budi yang masih punya Pesanan menunggu ditolak karena Member nonaktif, tidak diarahkan ke Pesanannya", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain: [pesananBudi],
        }),
        stokVarian: 8,
        memberNonaktif: true,
        voucher: null,
      }),
    ).toEqual({ hasil: "member-nonaktif" });
  });

  it("Member nonaktif ditolak karena Member nonaktif walaupun Stok Varian-nya 0", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain: [],
        }),
        stokVarian: 0,
        memberNonaktif: true,
        voucher: null,
      }),
    ).toEqual({ hasil: "member-nonaktif" });
  });

  it("Varian yang tidak dijual tetap didahulukan sebelum Member nonaktif", () => {
    expect(
      hasilCheckout({
        varianDijual: undefined,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain: [pesananBudi],
        }),
        stokVarian: 0,
        memberNonaktif: true,
        voucher: null,
      }),
    ).toEqual({ hasil: "tidak-dijual" });
  });

  // PRD §5.2 ▶ Keputusan 2026-11-17 langkah 5: Voucher (§8.7) diperiksa paling akhir. Hasil penilaiannya
  // adalah penerapanVoucher; Voucher yang tidak diisi berarti null.
  const sudahBerakhir = {
    dipakai: false,
    alasan: "sudah-berakhir",
    pesan: "Voucher sudah berakhir",
  } as const;
  const hemat5Dipakai = {
    dipakai: true,
    hargaJual: 50000,
    potonganVoucher: 5000,
    hargaSetelahPotongan: 45000,
  } as const;

  it("contoh PRD §5.2: Andi yang masih punya Pesanan menunggu checkout lagi dengan Voucher yang sudah berakhir diarahkan ke Pesanannya", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "andi@example.test",
          pesananLain,
        }),
        stokVarian: 8,
        memberNonaktif: false,
        voucher: sudahBerakhir,
      }),
    ).toEqual({ hasil: "pesanan-menunggu", pesananMenunggu: pesananAndi });
  });

  it("Varian dengan Stok Varian 0 ditolak karena stok habis walaupun Voucher-nya juga ditolak", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 0,
        memberNonaktif: false,
        voucher: sudahBerakhir,
      }),
    ).toEqual({ hasil: "stok-habis" });
  });

  it("bila langkah 1–4 lolos, Voucher yang ditolak menolak checkout dengan alasan dan pesan penolakannya", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 8,
        memberNonaktif: false,
        voucher: sudahBerakhir,
      }),
    ).toEqual({
      hasil: "voucher-ditolak",
      alasan: "sudah-berakhir",
      pesan: "Voucher sudah berakhir",
    });
  });

  it("Voucher yang dipakai tidak menghalangi checkout", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 8,
        memberNonaktif: false,
        voucher: hemat5Dipakai,
      }),
    ).toEqual({ hasil: "boleh", varianDijual: netflixSatuBulan });
  });

  // PRD §5.2 ▶ Keputusan 2026-11-20 (issue 226) langkah 6 dan §15.7. Contoh PRD §15.7: saldo Rp 40.000, Harga jual
  // Rp 50.000 tanpa Voucher, jadi kurang Rp 10.000.
  const saldoKurang = bayarSaldo({
    saldo: 40000,
    hargaJual: 50000,
    potonganVoucher: 0,
  });

  it("Member yang memilih Saldo dengan saldo Rp 40.000 untuk Harga jual Rp 50.000 ditolak karena saldo tidak cukup", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 8,
        memberNonaktif: false,
        voucher: null,
        saldo: saldoKurang,
      }),
    ).toEqual({ hasil: "saldo-kurang", saldo: 40000, harusDibayar: 50000 });
  });

  it("Pesanan menunggu didahulukan sebelum saldo yang tidak cukup", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "andi@example.test",
          pesananLain,
        }),
        stokVarian: 8,
        memberNonaktif: false,
        voucher: null,
        saldo: saldoKurang,
      }),
    ).toEqual({ hasil: "pesanan-menunggu", pesananMenunggu: pesananAndi });
  });

  it("Voucher yang ditolak didahulukan sebelum saldo yang tidak cukup", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 8,
        memberNonaktif: false,
        voucher: sudahBerakhir,
        saldo: saldoKurang,
      }),
    ).toMatchObject({ hasil: "voucher-ditolak" });
  });

  it("saldo Rp 50.000 dengan HEMAT5 untuk Harga jual Rp 50.000 cukup, jadi Pesanan boleh dibuat", () => {
    expect(
      hasilCheckout({
        varianDijual: netflixSatuBulan,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 8,
        memberNonaktif: false,
        voucher: hemat5Dipakai,
        saldo: bayarSaldo({
          saldo: 50000,
          hargaJual: 50000,
          potonganVoucher: 5000,
        }),
      }),
    ).toEqual({ hasil: "boleh", varianDijual: netflixSatuBulan });
  });
});

// PRD §16: Produk gratis hanya bisa diambil Member yang sedang login lewat "Ambil gratis", tanpa pembayaran QRIS. Jadi
// checkout QRIS atau saldo untuk Varian Produk gratis ditolak, misalnya dari form checkout yang dibuka sebelum Produk itu
// dijadikan gratis.
describe("hasilCheckout untuk Produk gratis", () => {
  const akunUjiGratis = { produk: "Akun Uji Gratis", varian: "Akun Baru" };

  it("Varian Produk gratis ditolak sebelum Member nonaktif, Pesanan menunggu, dan stok habis", () => {
    expect(
      hasilCheckout({
        varianDijual: { ...akunUjiGratis, gratis: true },
        batasPesananMenunggu: batasPesananMenunggu({
          email: "andi@example.test",
          pesananLain,
        }),
        stokVarian: 0,
        memberNonaktif: true,
        voucher: null,
      }),
    ).toEqual({ hasil: "produk-gratis" });
  });

  it("Varian yang tidak dijual tetap didahulukan", () => {
    expect(
      hasilCheckout({
        varianDijual: undefined,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 5,
        memberNonaktif: false,
        voucher: null,
      }),
    ).toEqual({ hasil: "tidak-dijual" });
  });

  it("Varian Produk yang tidak gratis boleh dibeli seperti biasa", () => {
    const varianDijual = { ...akunUjiGratis, gratis: false };
    expect(
      hasilCheckout({
        varianDijual,
        batasPesananMenunggu: batasPesananMenunggu({
          email: "budi@example.test",
          pesananLain,
        }),
        stokVarian: 5,
        memberNonaktif: false,
        voucher: null,
      }),
    ).toEqual({ hasil: "boleh", varianDijual });
  });
});
