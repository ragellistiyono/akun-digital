import { describe, expect, it } from "vitest";

import {
  lukisPemandangan,
  WARNA_TEKS_LANGIT,
  warnaTeksLangit,
} from "./pelukis-pemandangan";

// Warna token dikirim sebagai teks apa adanya; nilainya tidak memengaruhi bentuk punggung gunung.
const TOKEN = { atas: "rgb(42, 31, 77)", kabutKe: "rgb(247, 243, 252)" };

describe("lukisPemandangan", () => {
  it("dua kali melukis pita dengan ukuran yang sama menghasilkan path punggung gunung yang sama", () => {
    const kanvas = { lebar: 390, tinggi: 236, t: 0.16, ...TOKEN };

    const pertama = lukisPemandangan("pita", kanvas);
    const kedua = lukisPemandangan("pita", kanvas);

    const pathPertama = pertama.punggung.map((lapis) => lapis.d);
    expect(pathPertama).toHaveLength(5);
    expect(kedua.punggung.map((lapis) => lapis.d)).toEqual(pathPertama);
  });

  // DESIGN.md: enam guratan awan, dan 46 bintang yang memudar masuk saat t di atas 0,6.
  it("pita memuat matahari dan enam awan, dengan 46 bintang hanya di senja akhir", () => {
    const kanvas = { lebar: 390, tinggi: 236, ...TOKEN };

    const terang = lukisPemandangan("pita", { ...kanvas, t: 0.16 });
    const gelap = lukisPemandangan("pita", { ...kanvas, t: 0.82 });

    expect(terang.matahari).not.toBeNull();
    expect(terang.awan.elips).toHaveLength(6);
    expect(terang.bintang).toEqual([]);
    expect(gelap.bintang).toHaveLength(46);
  });

  // DESIGN.md: strip tepi berisi cakrawala pendek tiga lapis tanpa matahari, bintang, atau awan.
  // t = 0,82 dipilih karena di pita nilai ini memunculkan bintang.
  it("strip tepi berisi tiga lapis punggung gunung tanpa matahari, bintang, dan awan", () => {
    const lukisan = lukisPemandangan("tepi", {
      lebar: 390,
      tinggi: 44,
      t: 0.82,
      ...TOKEN,
    });

    expect(lukisan.punggung).toHaveLength(3);
    expect(lukisan.matahari).toBeNull();
    expect(lukisan.bintang).toEqual([]);
    expect(lukisan.awan.elips).toEqual([]);
  });
});

// DESIGN.md "Pemandangan senja", kartu senja Halaman bayar: lima lapis dengan matahari, awan, dan bintang
// yang muncul saat t di atas 0,6, karena hitung mundur membawa langit dari sore keemasan sampai malam.
describe("kartu senja Halaman bayar", () => {
  const kanvas = { lebar: 358, tinggi: 136, kabutKe: "rgb(255, 255, 255)" };

  it("berisi lima lapis punggung gunung, matahari, dan enam awan", () => {
    const lukisan = lukisPemandangan("bayar", { ...kanvas, t: 0 });

    expect(lukisan.punggung).toHaveLength(5);
    expect(lukisan.matahari).not.toBeNull();
    expect(lukisan.awan.elips).toHaveLength(6);
  });

  it("46 bintang hanya muncul saat t di atas 0,6, dan matahari tenggelam di bawah kartu saat waktu habis", () => {
    const sore = lukisPemandangan("bayar", { ...kanvas, t: 0.5 });
    const malam = lukisPemandangan("bayar", { ...kanvas, t: 1 });

    expect(sore.bintang).toEqual([]);
    expect(malam.bintang).toHaveLength(46);
    // Posisi vertikal matahari turun sampai 110% tinggi kartu.
    expect(malam.matahari?.cy).toBeCloseTo(136 * 1.1);
  });

  it("tanpa warna kunci atas, kunci atas langitnya ikut berganti mengikuti waktu senja", () => {
    const sore = lukisPemandangan("bayar", { ...kanvas, t: 0 });
    const malam = lukisPemandangan("bayar", { ...kanvas, t: 1 });

    expect(sore.langit[0].warna).not.toBe(malam.langit[0].warna);
  });
});

// DESIGN.md: angka waktu dan Total bayar berwarna gelap (langit malam) atau putih mengikuti luminans
// langit, supaya kontrasnya minimal 4,5:1.
describe("warnaTeksLangit", () => {
  it("langit kartu senja yang gelap dari sore sampai malam mendapat teks putih", () => {
    for (const t of [0, 0.5, 1]) {
      expect(warnaTeksLangit({ t })).toBe(WARNA_TEKS_LANGIT.putih);
    }
  });

  it("langit atas secerah cakram matahari mendapat teks gelap", () => {
    const cakram = lukisPemandangan("bayar", {
      ...TOKEN,
      lebar: 358,
      tinggi: 136,
      t: 0,
    }).matahari!.warna;

    expect(warnaTeksLangit({ t: 0, atas: cakram })).toBe(
      WARNA_TEKS_LANGIT.gelap,
    );
  });
});
