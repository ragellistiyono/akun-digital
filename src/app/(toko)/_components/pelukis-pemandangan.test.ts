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
    const teks = kotakTeksKartu(358, 136, LEBAR_TOTAL.limaDigit);
    const sore = lukisPemandangan("bayar", { ...kanvas, t: 0.5, teks });
    const malam = lukisPemandangan("bayar", { ...kanvas, t: 1, teks });

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

/**
 * Kotak dua blok teks kartu senja menurut tata letak kartu-senja.tsx: 8 px dari tepi atas dan 16 px dari
 * tepi samping. Blok kiri berisi label 13 px di atas angka waktu 36 px (48 px mulai 900 px); lebarnya
 * selebar label "QRIS kedaluwarsa" (121 px) di ponsel dan selebar angka 48 px (130 px) di layar lebar.
 * Blok kanan berisi label 13 px di atas Total bayar 20 px, yang selebar 93 px untuk "Rp 50.085" dan 123 px
 * untuk "Rp 9.999.999". Semua lebar diukur di browser dengan huruf Manrope.
 */
const LEBAR_TOTAL = { limaDigit: 93, tujuhDigit: 123 };
function kotakTeksKartu(lebar: number, tinggi: number, lebarTotal: number) {
  const ponsel = tinggi === 136;
  return [
    { x: 16, y: 8, lebar: ponsel ? 121 : 130, tinggi: ponsel ? 49 : 61 },
    { x: lebar - 16 - lebarTotal, y: 8, lebar: lebarTotal, tinggi: 13 + 20 },
  ];
}

const terpisah = (
  a: { x: number; y: number; lebar: number; tinggi: number },
  b: { x1: number; y1: number; x2: number; y2: number },
) =>
  a.x + a.lebar <= b.x1 || b.x2 <= a.x || a.y + a.tinggi <= b.y1 || b.y2 <= a.y;

// Lebar kartu diukur di browser: layar 360, 390, dan 899 px (ponsel, lebar layar dikurangi tepi 16 px), lalu
// 900 dan 1440 px (kolom kiri dari dua kolom).
const UKURAN_KARTU = [
  { layar: 360, lebar: 328, tinggi: 136 },
  { layar: 390, lebar: 358, tinggi: 136 },
  { layar: 899, lebar: 867, tinggi: 136 },
  { layar: 900, lebar: 418, tinggi: 280 },
  { layar: 1440, lebar: 528, tinggi: 280 },
];
const WAKTU_SENJA = Array.from({ length: 21 }, (_, i) => i / 20);

// DESIGN.md: angka waktu dan Total bayar ditulis di atas langit dengan kontras minimal 4,5:1 di sepanjang
// hitung mundur. Karena itu yang terang di langit tidak boleh berada di belakang teks.
describe.each(UKURAN_KARTU)(
  "kartu senja di layar $layar px",
  ({ lebar, tinggi }) => {
    for (const [digit, lebarTotal] of Object.entries(LEBAR_TOTAL)) {
      const teks = kotakTeksKartu(lebar, tinggi, lebarTotal);
      const lukis = (t: number) =>
        lukisPemandangan("bayar", {
          lebar,
          tinggi,
          t,
          kabutKe: "rgb(255, 255, 255)",
          teks,
        });

      it(`dengan Total bayar ${digit}, cakram matahari dan pendarnya tidak pernah berada di belakang teks`, () => {
        for (const t of WAKTU_SENJA) {
          const { matahari } = lukis(t);
          for (const k of teks) {
            const jarak = Math.hypot(
              Math.max(k.x - matahari!.cx, 0, matahari!.cx - (k.x + k.lebar)),
              Math.max(k.y - matahari!.cy, 0, matahari!.cy - (k.y + k.tinggi)),
            );
            expect(jarak).toBeGreaterThanOrEqual(matahari!.pendar.r);
          }
        }
      });

      it(`dengan Total bayar ${digit}, cahaya ufuk, awan, bintang, dan punggung gunung tidak berada di belakang teks`, () => {
        for (const t of WAKTU_SENJA) {
          const lukisan = lukis(t);
          const pinggir = 3 * lukisan.awan.kabur;
          for (const k of teks) {
            const u = lukisan.cahayaUfuk;
            expect(u.cy - u.ry).toBeGreaterThanOrEqual(k.y + k.tinggi);
            for (const a of lukisan.awan.elips) {
              expect(
                terpisah(k, {
                  x1: a.cx - a.rx - pinggir,
                  x2: a.cx + a.rx + pinggir,
                  y1: a.cy - a.ry - pinggir,
                  y2: a.cy + a.ry + pinggir,
                }),
              ).toBe(true);
            }
            for (const b of lukisan.bintang) {
              expect(
                terpisah(k, {
                  x1: b.cx - b.r,
                  x2: b.cx + b.r,
                  y1: b.cy - b.r,
                  y2: b.cy + b.r,
                }),
              ).toBe(true);
            }
            for (const p of lukisan.punggung) {
              expect(p.puncak).toBeGreaterThan(k.y + k.tinggi);
            }
          }
        }
      });

      it(`dengan Total bayar ${digit}, warna teks yang dipilih kontrasnya minimal 4,5:1 terhadap lukisan di belakang teks`, () => {
        for (const t of WAKTU_SENJA) {
          expect(
            warnaTeksLangit(lukis(t), teks).kontras,
          ).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  },
);

// DESIGN.md: warna teks gelap (langit malam) atau putih mengikuti luminans yang benar-benar ada di belakang
// teks.
describe("warnaTeksLangit", () => {
  it("langit kartu senja yang gelap dari sore sampai malam mendapat teks putih", () => {
    const teks = kotakTeksKartu(358, 136, LEBAR_TOTAL.limaDigit);
    for (const t of [0, 0.5, 1]) {
      const lukisan = lukisPemandangan("bayar", {
        lebar: 358,
        tinggi: 136,
        t,
        kabutKe: "rgb(255, 255, 255)",
        teks,
      });
      expect(warnaTeksLangit(lukisan, teks).warna).toBe(
        WARNA_TEKS_LANGIT.putih,
      );
    }
  });

  // Tanpa kotak teks, matahari tidak dijauhkan; kotak di tengah cakramnya terang, jadi teksnya gelap.
  it("kotak teks yang berada di atas cakram matahari mendapat teks gelap", () => {
    const lukisan = lukisPemandangan("bayar", {
      lebar: 358,
      tinggi: 136,
      t: 0,
      kabutKe: "rgb(255, 255, 255)",
    });
    const { cx, cy, r } = lukisan.matahari!;

    expect(
      warnaTeksLangit(lukisan, [
        { x: cx - r / 2, y: cy - r / 2, lebar: r, tinggi: r },
      ]).warna,
    ).toBe(WARNA_TEKS_LANGIT.gelap);
  });
});
