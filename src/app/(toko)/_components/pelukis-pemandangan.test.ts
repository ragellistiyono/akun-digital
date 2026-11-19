import { describe, expect, it } from "vitest";

import { lukisPemandangan, type Kotak } from "./pelukis-pemandangan";

type Lukisan = ReturnType<typeof lukisPemandangan>;

const HEX = /#[0-9A-Fa-f]{3,8}\b/;

/** Semua pasangan koordinat di sebuah path SVG yang hanya memakai perintah absolut. */
function titikPath(d: string) {
  const angka = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  return Array.from({ length: angka.length / 2 }, (_, i) => [
    angka[2 * i],
    angka[2 * i + 1],
  ]);
}

/** Ruas garis "M x y L x y" di path arsiran, masing-masing sebagai kotak pembatasnya. */
function kotakRuas(d: string, tebal: number): Kotak[] {
  const titik = titikPath(d);
  return Array.from({ length: titik.length / 2 }, (_, i) => {
    const [[x1, y1], [x2, y2]] = [titik[2 * i], titik[2 * i + 1]];
    return {
      x: Math.min(x1, x2) - tebal / 2,
      y: Math.min(y1, y2) - tebal / 2,
      lebar: Math.abs(x2 - x1) + tebal,
      tinggi: Math.abs(y2 - y1) + tebal,
    };
  });
}

const terpisah = (a: Kotak, b: Kotak) =>
  a.x + a.lebar <= b.x ||
  b.x + b.lebar <= a.x ||
  a.y + a.tinggi <= b.y ||
  b.y + b.tinggi <= a.y;

/** Jarak terpendek dari sebuah titik ke kotak. */
const jarakKeKotak = (x: number, y: number, k: Kotak) =>
  Math.hypot(
    Math.max(k.x - x, 0, x - (k.x + k.lebar)),
    Math.max(k.y - y, 0, y - (k.y + k.tinggi)),
  );

const WAKTU_SENJA = Array.from({ length: 21 }, (_, i) => i / 20);

describe("lukisPemandangan", () => {
  it.each([
    ["pita", 390, 236, 0.16],
    ["pita", 1440, 320, 0.82],
    ["tepi", 390, 44, 0.16],
    ["bayar", 354, 132, 0.7],
  ] as const)(
    "dua kali melukis %s %i × %i px pada waktu yang sama menghasilkan lukisan yang sama",
    (jenis, lebar, tinggi, t) => {
      const kanvas = { lebar, tinggi, t };

      expect(lukisPemandangan(jenis, kanvas)).toEqual(
        lukisPemandangan(jenis, kanvas),
      );
    },
  );

  // Pita Beranda tiga lapis, strip tepi dua lapis, kartu bayar tiga lapis; lapis jauh kertas lama dan
  // lapis dekat permukaan.
  it.each([
    ["pita", 236, ["var(--kertas-lama)", "var(--kertas)", "var(--permukaan)"]],
    ["tepi", 44, ["var(--kertas-lama)", "var(--permukaan)"]],
    ["bayar", 132, ["var(--kertas-lama)", "var(--kertas)", "var(--permukaan)"]],
  ] as const)(
    "%s berisi punggung gunung dari lapis jauh ke dekat dengan isi token",
    (jenis, tinggi, isi) => {
      const lukisan = lukisPemandangan(jenis, { lebar: 390, tinggi, t: 0.16 });

      expect(lukisan.punggung.map((lapis) => lapis.isi)).toEqual(isi);
      for (const lapis of lukisan.punggung) {
        expect(lapis.garis).toMatch(/^M/);
        expect(lapis.arsiran).not.toBe("");
      }
    },
  );

  it.each([0.16, 0.82])(
    "strip tepi pada waktu %s tidak memuat matahari, bulan, awan, burung, dan bintang",
    (t) => {
      const lukisan = lukisPemandangan("tepi", { lebar: 1440, tinggi: 56, t });

      expect(lukisan.matahari).toBeNull();
      expect(lukisan.bulan).toBeNull();
      expect(lukisan.awan).toEqual([]);
      expect(lukisan.burung).toEqual([]);
      expect(lukisan.bintang).toEqual([]);
      expect(lukisan.arsiranLangit).toBeNull();
    },
  );

  it("pita di mode terang memuat matahari di kanan, awan, dan tiga burung, tanpa bulan dan bintang", () => {
    const ponsel = lukisPemandangan("pita", {
      lebar: 390,
      tinggi: 236,
      t: 0.16,
    });
    const lebar = lukisPemandangan("pita", {
      lebar: 1440,
      tinggi: 320,
      t: 0.16,
    });

    // Kotak cari ditaruh di atas pita, jadi matahari tidak di tengah.
    expect(ponsel.matahari!.cx / 390).toBeCloseTo(0.76);
    expect(ponsel.bulan).toBeNull();
    expect(ponsel.bintang).toEqual([]);
    expect(ponsel.burung).toHaveLength(3);
    expect(ponsel.awan).toHaveLength(2);
    expect(lebar.awan).toHaveLength(3);
  });

  it("pita di mode gelap memuat bulan sabit dan sepuluh bintang, tanpa matahari dan burung", () => {
    const lukisan = lukisPemandangan("pita", {
      lebar: 390,
      tinggi: 236,
      t: 0.82,
    });

    expect(lukisan.matahari).toBeNull();
    expect(lukisan.bulan).not.toBeNull();
    expect(lukisan.bintang).toHaveLength(10);
    expect(lukisan.burung).toEqual([]);
  });

  it("tidak ada nilai hex di keluaran pelukis; warna hanya ditulis sebagai token", () => {
    const keluaran = [
      lukisPemandangan("pita", { lebar: 390, tinggi: 236, t: 0.16 }),
      lukisPemandangan("pita", { lebar: 1440, tinggi: 320, t: 0.82 }),
      lukisPemandangan("tepi", { lebar: 390, tinggi: 44, t: 0.16 }),
      ...WAKTU_SENJA.map((t) =>
        lukisPemandangan("bayar", { lebar: 524, tinggi: 276, t }),
      ),
    ];

    for (const lukisan of keluaran) {
      expect(JSON.stringify(lukisan)).not.toMatch(HEX);
    }
  });

  // Path sederhana supaya ringan dilukis ulang setiap detik di kartu bayar.
  it.each([
    ["pita", 1440, 320],
    ["tepi", 1440, 56],
    ["bayar", 863, 132],
  ] as const)(
    "garis punggung %s selebar %i px berisi paling banyak 150 titik per lapis",
    (jenis, lebar, tinggi) => {
      const lukisan = lukisPemandangan(jenis, { lebar, tinggi, t: 0.5 });

      for (const lapis of lukisan.punggung) {
        expect(titikPath(lapis.garis).length).toBeLessThanOrEqual(150);
      }
    },
  );
});

// PRD §5.6: hitung mundur QRIS menggerakkan t dari 0 (15:00) sampai 1 (00:00).
describe("kartu senja Halaman bayar", () => {
  const kanvas = { lebar: 354, tinggi: 132 };

  it("bintang tidak ada sampai t 0,6, lalu bertambah sampai semuanya tampak saat t 0,8", () => {
    const jumlah = WAKTU_SENJA.map(
      (t) => lukisPemandangan("bayar", { ...kanvas, t }).bintang.length,
    );

    WAKTU_SENJA.forEach((t, i) => {
      if (t <= 0.6) expect(jumlah[i]).toBe(0);
      else expect(jumlah[i]).toBeGreaterThan(0);
      if (i > 0) expect(jumlah[i]).toBeGreaterThanOrEqual(jumlah[i - 1]);
    });
    expect(jumlah[WAKTU_SENJA.indexOf(0.8)]).toBe(jumlah[jumlah.length - 1]);
  });

  it("matahari mulai utuh di bagian atas kartu, turun terus, dan hilang di balik punggung saat t = 1", () => {
    const awal = lukisPemandangan("bayar", { ...kanvas, t: 0 }).matahari!;
    const posisi = WAKTU_SENJA.slice(0, -1).map(
      (t) => lukisPemandangan("bayar", { ...kanvas, t }).matahari!.cy,
    );
    const hampirHabis = lukisPemandangan("bayar", { ...kanvas, t: 0.9 });

    expect(awal.cy - awal.rLuar).toBeGreaterThanOrEqual(0);
    expect(awal.cy).toBeLessThan(kanvas.tinggi / 2);
    posisi.slice(1).forEach((cy, i) => expect(cy).toBeGreaterThan(posisi[i]));
    // Menjelang habis, pusat matahari sudah di bawah puncak gunung tertinggi.
    expect(hampirHabis.matahari!.cy).toBeGreaterThan(
      Math.min(...hampirHabis.punggung.map((lapis) => lapis.puncak)),
    );
    expect(lukisPemandangan("bayar", { ...kanvas, t: 1 }).matahari).toBeNull();
  });

  it("arsiran langit pulpen kosong saat 15:00 dan bertambah mengikuti t", () => {
    const jumlahRuas = WAKTU_SENJA.map(
      (t) =>
        titikPath(lukisPemandangan("bayar", { ...kanvas, t }).arsiranLangit!)
          .length / 2,
    );

    expect(jumlahRuas[0]).toBe(0);
    jumlahRuas
      .slice(1)
      .forEach((n, i) => expect(n).toBeGreaterThanOrEqual(jumlahRuas[i]));
    expect(jumlahRuas[jumlahRuas.length - 1]).toBeGreaterThan(jumlahRuas[10]);
  });
});

/**
 * Kotak dua blok teks kartu senja menurut tata letak kartu-senja.tsx, diukur dari tepi dalam garis kartu:
 * 10 px dari tepi atas dan 16 px dari tepi samping. Blok kiri berisi label 15 px (16 px mulai 900 px) di
 * atas angka waktu Kalam 40 px (56 px) yang selebar paling sedikit 5ch. Blok kanan berisi label di atas
 * Total bayar Kalam 22 px. Lebar huruf tulisan tangan diperkirakan dengan kelonggaran: 100 px untuk
 * "Rp 50.085" dan 132 px untuk "Rp 9.999.999".
 */
const LEBAR_TOTAL = { limaDigit: 100, tujuhDigit: 132 };
function kotakTeksKartu(lebar: number, tinggi: number, lebarTotal: number) {
  const ponsel = tinggi === 132;
  return [
    { x: 16, y: 10, lebar: ponsel ? 112 : 156, tinggi: ponsel ? 59 : 76 },
    { x: lebar - 16 - lebarTotal, y: 10, lebar: lebarTotal, tinggi: 41 },
  ];
}

// Ukuran dalam kartu (tanpa garis 2 px): layar 360, 390, dan 899 px (ponsel, lebar layar dikurangi tepi
// 16 px), lalu 900 dan 1440 px (kolom kiri dari dua kolom).
const UKURAN_KARTU = [
  { layar: 360, lebar: 324, tinggi: 132 },
  { layar: 390, lebar: 354, tinggi: 132 },
  { layar: 899, lebar: 863, tinggi: 132 },
  { layar: 900, lebar: 414, tinggi: 276 },
  { layar: 1440, lebar: 524, tinggi: 276 },
];

// Angka waktu dan Total bayar ditulis dengan pensil di atas kertas kartu. Supaya kontrasnya tetap 13:1,
// yang ada di belakang teks hanya kertas sepanjang hitung mundur.
describe.each(UKURAN_KARTU)(
  "kartu senja di layar $layar px",
  ({ lebar, tinggi }) => {
    for (const [digit, lebarTotal] of Object.entries(LEBAR_TOTAL)) {
      const teks = kotakTeksKartu(lebar, tinggi, lebarTotal);
      const lukis = (t: number): Lukisan =>
        lukisPemandangan("bayar", { lebar, tinggi, t, teks });

      it(`dengan Total bayar ${digit}, matahari beserta sinarnya tidak pernah menyentuh teks`, () => {
        for (const t of WAKTU_SENJA.slice(0, -1)) {
          const m = lukis(t).matahari!;
          // rLuar memang memuat seluruh cakram dan sinar.
          for (const [x, y] of titikPath(`${m.tubuh} ${m.sinar}`)) {
            expect(Math.hypot(x, y)).toBeLessThanOrEqual(m.rLuar);
          }
          for (const k of teks) {
            expect(jarakKeKotak(m.cx, m.cy, k)).toBeGreaterThanOrEqual(m.rLuar);
          }
        }
      });

      it(`dengan Total bayar ${digit}, bintang, awan, arsiran langit, dan punggung gunung tidak berada di belakang teks`, () => {
        for (const t of WAKTU_SENJA) {
          const lukisan = lukis(t);
          const kotakLain = [
            ...lukisan.bintang.map((b) => ({
              x: b.x - b.r,
              y: b.y - b.r,
              lebar: 2 * b.r,
              tinggi: 2 * b.r,
            })),
            ...lukisan.awan.map((a) => a.kotak),
            ...kotakRuas(lukisan.arsiranLangit ?? "", 1.5),
          ];
          for (const k of teks) {
            for (const lain of kotakLain) {
              expect(terpisah(k, lain)).toBe(true);
            }
            for (const lapis of lukisan.punggung) {
              expect(lapis.puncak).toBeGreaterThan(k.y + k.tinggi);
            }
          }
        }
      });
    }
  },
);
