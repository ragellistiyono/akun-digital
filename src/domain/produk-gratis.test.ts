import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/batas-per-member.json";
import goldenIsian from "../../tests/golden/isian-batas-per-member.json";
import type { Metode } from "./bayar-saldo";
import {
  hasilAmbilGratis,
  keteranganProdukGratis,
  periksaBatasPerMember,
  sisaJatah,
} from "./produk-gratis";

type KasusGolden = (typeof golden.kasus)[number];

/** Input golden dengan Metode sebagai tipe Metode. */
const inputGolden = ({ pesanan, ...lainnya }: KasusGolden["input"]) => ({
  ...lainnya,
  pesanan: pesanan.map((p) => ({ ...p, metode: p.metode as Metode })),
});

// PRD §16.2, §16.3: jatah terpakai, Sisa jatah, dan pesan jatah habis seorang Member untuk satu Produk gratis.
describe("sisaJatah", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const hasil = sisaJatah(inputGolden(input));

    expect({
      jatahTerpakai: hasil.jatahTerpakai,
      sisaJatah: hasil.sisaJatah,
      bolehAmbil: hasil.bolehAmbil,
      teksJatah: hasil.teksJatah,
      pesanJatahHabis: hasil.pesanJatahHabis,
    }).toEqual(output);
  });

  it("membawa Batas per Member dan Pesanan gratis yang dihitung sebagai bahan hitungnya", () => {
    const kasus = golden.kasus.find(
      (k) => k.nama === "Contoh PRD: 4 dari 5, dari dua Varian",
    );
    if (!kasus) throw new Error("Kasus golden tidak ditemukan.");

    const hasil = sisaJatah(inputGolden(kasus.input));

    expect(hasil.batasPerMember).toBe(5);
    expect(hasil.dihitung.map((p) => p.varian)).toEqual([
      "Varian A",
      "Varian A",
      "Varian A",
      "Varian B",
    ]);
  });
});

// PRD §16.3: pemeriksaan "Ambil gratis" berjalan berurutan, dan pemeriksaan pertama yang menolak menentukan hasilnya.
describe("hasilAmbilGratis", () => {
  const varian = { id: "akun-baru", gratis: true };
  const pesananMenunggu = { tautan: "pesanan-budi" };
  const jatahHabis = {
    bolehAmbil: false,
    pesanJatahHabis: "Anda sudah mengambil 2 dari batas 2 untuk Produk ini.",
  };
  const jatahAda = { bolehAmbil: true, pesanJatahHabis: null };
  /** Member yang login dengan Pesanan menunggu dan jatah habis: langkah 4 dan 6 sama-sama menolak. */
  const memberSemuaMenolak = {
    batasPesananMenunggu: { boleh: false as const, pesananMenunggu },
    jatah: jatahHabis,
  };

  it("Member dengan jatah tersisa, tanpa Pesanan menunggu, dan Stok Varian 1 boleh mengambil Varian itu", () => {
    expect(
      hasilAmbilGratis({
        varianDijual: varian,
        member: { batasPesananMenunggu: { boleh: true }, jatah: jatahAda },
        stokVarian: 1,
      }),
    ).toEqual({ hasil: "boleh", varianDijual: varian });
  });

  it("langkah 1: Produk atau Varian yang tidak dijual ditolak lebih dulu dari semua langkah lain", () => {
    expect(
      hasilAmbilGratis({
        varianDijual: undefined,
        member: null,
        stokVarian: 0,
      }),
    ).toEqual({ hasil: "tidak-dijual" });
  });

  it("langkah 2: Produk yang tidak lagi gratis ditolak sebelum Member diperiksa", () => {
    expect(
      hasilAmbilGratis({
        varianDijual: { ...varian, gratis: false },
        member: null,
        stokVarian: 0,
      }),
    ).toEqual({ hasil: "tidak-gratis" });
  });

  it("langkah 3: tanpa Member yang login ditolak sebelum Stok Varian diperiksa", () => {
    expect(
      hasilAmbilGratis({ varianDijual: varian, member: null, stokVarian: 0 }),
    ).toEqual({ hasil: "tidak-login" });
  });

  it("langkah 4: email Member yang masih punya Pesanan Menunggu Pembayaran ditolak sebelum stok habis dan jatah habis", () => {
    expect(
      hasilAmbilGratis({
        varianDijual: varian,
        member: memberSemuaMenolak,
        stokVarian: 0,
      }),
    ).toEqual({ hasil: "pesanan-menunggu", pesananMenunggu });
  });

  it("langkah 5: Stok Varian 0 ditolak sebelum jatah habis", () => {
    expect(
      hasilAmbilGratis({
        varianDijual: varian,
        member: {
          ...memberSemuaMenolak,
          batasPesananMenunggu: { boleh: true },
        },
        stokVarian: 0,
      }),
    ).toEqual({ hasil: "stok-habis" });
  });

  it("langkah 6: Sisa jatah 0 ditolak dengan pesan jatah habis", () => {
    expect(
      hasilAmbilGratis({
        varianDijual: varian,
        member: {
          ...memberSemuaMenolak,
          batasPesananMenunggu: { boleh: true },
        },
        stokVarian: 3,
      }),
    ).toEqual({
      hasil: "jatah-habis",
      pesan: "Anda sudah mengambil 2 dari batas 2 untuk Produk ini.",
    });
  });
});

// PRD §16.1, §16.2: Batas per Member wajib bilangan bulat 1 sampai 999 selama centang "Produk gratis" aktif, dan
// isiannya tidak dipakai bila centang itu dilepas.
describe("periksaBatasPerMember", () => {
  it.each(goldenIsian.kasus)("$nama", ({ input, output }) => {
    expect(periksaBatasPerMember(input)).toEqual(output);
  });
});

// PRD §16.4: Halaman Produk gratis menampilkan "Gratis khusus Member, maksimal M per Member".
describe("keteranganProdukGratis", () => {
  it("contoh PRD: Batas per Member 5", () => {
    expect(keteranganProdukGratis({ batasPerMember: 5 })).toBe(
      "Gratis khusus Member, maksimal 5 per Member",
    );
  });

  it("UAT-P1: Batas per Member 2", () => {
    expect(keteranganProdukGratis({ batasPerMember: 2 })).toBe(
      "Gratis khusus Member, maksimal 2 per Member",
    );
  });
});
