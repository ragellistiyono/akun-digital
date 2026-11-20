import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/harga-modal.json";
import goldenPesanan from "../../tests/golden/harga-modal-pesanan.json";
import {
  hargaModalIsiPertama,
  labaKotor,
  periksaHargaModal,
} from "./harga-modal";

// PRD §14.1: Harga modal wajib, rupiah bulat, minimal Rp 0, tanpa batas maksimum, dan boleh lebih besar dari
// Harga jual. Laba kotor per Pesanan = Harga jual − Harga modal.
describe("periksaHargaModal", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(periksaHargaModal(input)).toEqual(output);
  });
});

// PRD §14.2: Laba kotor sebuah Pesanan, atau null bila Pesanan itu belum punya Harga modal (§9.5 ▶ Keputusan
// 2026-11-20). Contoh pemilik: Harga jual Rp 1.000 dan Harga modal Rp 800.
describe("labaKotor", () => {
  it("Harga jual Rp 1.000 dan Harga modal Rp 800 memberi Laba kotor Rp 200", () => {
    expect(labaKotor({ hargaJual: 1000, hargaModal: 800 })).toEqual({
      labaKotor: 200,
      hargaJual: 1000,
      hargaModal: 800,
    });
  });

  it("Pesanan tanpa Harga modal belum punya Laba kotor", () => {
    expect(labaKotor({ hargaJual: 1000, hargaModal: null })).toEqual({
      labaKotor: null,
      hargaJual: 1000,
      hargaModal: null,
    });
  });
});

/** Satu kejadian di fixture: checkout sebuah Pesanan, atau perubahan Harga modal Varian. */
type Kejadian = { jenis: string; pesanan?: string; hargaModal?: number };

/**
 * Menjalankan kejadian satu Varian seperti server: checkout mencatat Harga modal Varian saat itu, dan setiap
 * perubahan Harga modal mengisi Pesanan tanpa Harga modal dengan nilai dari hargaModalIsiPertama, bila ada.
 * Status Pesanan sengaja tidak dibaca, karena isi pertama berlaku untuk Pesanan berstatus apa pun.
 */
function jalankan(hargaModalVarianAwal: number | null, kejadian: Kejadian[]) {
  let hargaModalVarian = hargaModalVarianAwal;
  const hargaModalPesanan: Record<string, number | null> = {};
  for (const satu of kejadian) {
    if (satu.jenis === "checkout" && satu.pesanan !== undefined) {
      hargaModalPesanan[satu.pesanan] = hargaModalVarian;
    } else if (satu.hargaModal !== undefined) {
      const isi = hargaModalIsiPertama({
        hargaModalSebelumnya: hargaModalVarian,
        hargaModalBaru: satu.hargaModal,
      });
      if (isi !== null) {
        for (const [p, nilai] of Object.entries(hargaModalPesanan)) {
          if (nilai === null) hargaModalPesanan[p] = isi;
        }
      }
      hargaModalVarian = satu.hargaModal;
    }
  }
  return { hargaModalPesanan };
}

// PRD §14.1 "Varian dan Pesanan tanpa Harga modal".
describe("hargaModalIsiPertama", () => {
  it.each(goldenPesanan.kasus)("$nama", ({ input, output }) => {
    expect(jalankan(input.hargaModalVarianAwal, input.kejadian)).toEqual(
      output,
    );
  });
});
