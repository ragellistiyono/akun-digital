import { describe, expect, it } from "vitest";

import { lukisPemandangan } from "./pelukis-pemandangan";

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
