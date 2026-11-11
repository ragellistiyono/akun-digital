// Pelukis pemandangan senja (docs/DESIGN.md, "Pemandangan senja"). Algoritmanya diambil dari
// prototipe docs/design/prototipe/index.html. Ini satu-satunya modul yang boleh memegang hex
// mentah, karena warnanya hasil interpolasi kunci langit, bukan warna antarmuka.
// t: 0 = sore keemasan, 0,5 = matahari menyentuh punggung gunung, 1 = malam.

type Kunci<T> = [number, T][];

const keRgb = (hex: string) =>
  [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));

const keHex = (rgb: number[]) =>
  "#" +
  rgb
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

function campur(a: string, b: string, k: number) {
  const rgbB = keRgb(b);
  return keHex(keRgb(a).map((v, i) => v + (rgbB[i] - v) * k));
}

function antara<T>(
  kunci: Kunci<T>,
  t: number,
  campurNilai: (a: T, b: T, k: number) => T,
): T {
  for (let i = 1; i < kunci.length; i++) {
    if (t <= kunci[i][0]) {
      const [a, nilaiA] = kunci[i - 1];
      const [b, nilaiB] = kunci[i];
      return campurNilai(nilaiA, nilaiB, (t - a) / (b - a || 1));
    }
  }
  return kunci[kunci.length - 1][1];
}

const antaraWarna = (kunci: Kunci<string>, t: number) =>
  antara(kunci, t, campur);

// Kunci langit: atas, tengah (42%), bawah (78%), dan cakrawala.
const LANGIT = {
  atas: [
    [0, "#2A1F4D"],
    [0.5, "#251B47"],
    [1, "#0E0A22"],
  ],
  tengah: [
    [0, "#8C5A86"],
    [0.5, "#7C4573"],
    [1, "#22183D"],
  ],
  bawah: [
    [0, "#E7A07E"],
    [0.5, "#DD7660"],
    [1, "#3B2852"],
  ],
  ufuk: [
    [0, "#FCE3A8"],
    [0.5, "#F6B467"],
    [1, "#69405F"],
  ],
} satisfies Record<string, Kunci<string>>;

// Warna punggung gunung, dari lapis terjauh ke terdekat.
const PUNGGUNG: Kunci<string>[] = [
  [
    [0, "#EDB792"],
    [0.5, "#D9907E"],
    [1, "#57426F"],
  ],
  [
    [0, "#D49A90"],
    [0.5, "#BD7880"],
    [1, "#47365F"],
  ],
  [
    [0, "#B07C8D"],
    [0.5, "#9A6280"],
    [1, "#382B52"],
  ],
  [
    [0, "#77506F"],
    [0.5, "#683F66"],
    [1, "#261D40"],
  ],
  [
    [0, "#47305D"],
    [0.5, "#3D2853"],
    [1, "#17122B"],
  ],
];

const KABUT: Kunci<string> = [
  [0, "#F7D3A6"],
  [0.5, "#EFA27A"],
  [1, "#4B3863"],
];

// Pembangkit acak LCG dengan benih tetap, supaya lukisan yang sama selalu menghasilkan bentuk yang sama.
function acak(benih: number) {
  let s = benih >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// Punggung gunung dari midpoint displacement: 128 segmen dengan kurva kuadratik halus.
// Titik ujung dijaga dekat garis dasar, dan path dilebarkan 5% melewati tepi supaya tidak ada baji di pinggir.
function punggung(
  lebar: number,
  dasar: number,
  amp: number,
  kasar: number,
  benih: number,
) {
  const n = 128;
  const r = acak(benih);
  const y = new Array<number>(n + 1);
  const tepi = lebar * 0.05;
  const x = (i: number) => -tepi + (i * (lebar + 2 * tepi)) / n;
  y[0] = dasar + (r() - 0.5) * amp * 0.3;
  y[n] = dasar + (r() - 0.5) * amp * 0.3;
  for (let langkah = n, a = amp; langkah > 1; langkah /= 2, a *= kasar) {
    for (let i = langkah / 2; i < n; i += langkah) {
      y[i] = (y[i - langkah / 2] + y[i + langkah / 2]) / 2 + (r() - 0.5) * a;
    }
  }
  let d = `M${x(0).toFixed(1)} ${y[0].toFixed(1)}`;
  for (let i = 1; i < n; i++) {
    const xm = (x(i) + x(i + 1)) / 2;
    const ym = (y[i] + y[i + 1]) / 2;
    d += ` Q${x(i).toFixed(1)} ${y[i].toFixed(1)} ${xm.toFixed(1)} ${ym.toFixed(1)}`;
  }
  return `${d} L${x(n).toFixed(1)} ${y[n].toFixed(1)} L${x(n).toFixed(1)}`;
}

type Susunan = {
  ufuk: number; // tinggi cakrawala, pecahan tinggi kanvas
  lapis: number;
  amp: number;
  kabut: number; // awal kabut lembah, pecahan tinggi kanvas
  mx: number; // letak mendatar matahari, pecahan lebar kanvas
  matahari: boolean;
  bintang: boolean;
  awan: boolean;
  butir: number; // opasitas tekstur derau
};

const SUSUNAN = {
  pita: {
    ufuk: 0.5,
    lapis: 5,
    amp: 1.25,
    kabut: 0.84,
    mx: 0.72,
    matahari: true,
    bintang: true,
    awan: true,
    butir: 0.28,
  },
  tepi: {
    ufuk: 0.52,
    lapis: 3,
    amp: 0.5,
    kabut: 0.8,
    mx: 0.7,
    matahari: false,
    bintang: false,
    awan: false,
    butir: 0.14,
  },
  // Kartu senja Halaman bayar, mengikuti prototipe: cakrawala di 62% tinggi kartu dan matahari di 70% lebar.
  bayar: {
    ufuk: 0.62,
    lapis: 5,
    amp: 1,
    kabut: 0.84,
    mx: 0.7,
    matahari: true,
    bintang: true,
    awan: true,
    butir: 0.28,
  },
} satisfies Record<string, Susunan>;

export type JenisPemandangan = keyof typeof SUSUNAN;

type Kanvas = {
  lebar: number;
  tinggi: number;
  t: number;
  /** Warna kunci atas langit. Pita dan strip tepi memakai token `langit` supaya menyatu dengan bilah. */
  atas?: string;
  /** Warna tempat kabut lembah larut, misalnya token `tanah`. */
  kabutKe: string;
};

export type Henti = { offset: number; warna: string; opasitas: number };

const henti = (offset: number, warna: string, opasitas = 1): Henti => ({
  offset,
  warna,
  opasitas,
});

const antaraAngka = (kunci: Kunci<number>, t: number) =>
  antara(kunci, t, (a, b, k) => a + (b - a) * k);

// Guratan awan tipis: elips kabur yang menyala hangat dekat matahari.
function awan(L: number, T: number, ufukY: number, t: number) {
  const r = acak(37);
  const warna = antaraWarna(
    [
      [0, "#FFE9C2"],
      [0.5, "#FFC59A"],
      [1, "#8E6A8E"],
    ],
    t,
  );
  const terang = antaraAngka(
    [
      [0, 0.55],
      [0.5, 0.5],
      [1, 0.22],
    ],
    t,
  );
  return Array.from({ length: 6 }, () => {
    const cy = ufukY - T * (0.06 + r() * 0.32);
    const lebar = L * (0.18 + r() * 0.32);
    const cx = r() * L;
    const ry = T * (0.006 + r() * 0.012);
    return {
      cx,
      cy,
      rx: lebar / 2,
      ry,
      warna,
      opasitas: terang * (0.4 + r() * 0.6),
    };
  });
}

// 46 titik putih yang memudar masuk saat t di atas 0,6.
function bintang(L: number, T: number, t: number) {
  if (t <= 0.6) return [];
  const r = acak(91);
  const a = Math.min(1, (t - 0.6) / 0.3);
  return Array.from({ length: 46 }, () => ({
    cx: r() * L,
    cy: r() * T * 0.45,
    r: r() * 0.9 + 0.35,
    warna: "#FFFFFF",
    opasitas: a * (r() * 0.6 + 0.25),
  }));
}

export function lukisPemandangan(jenis: JenisPemandangan, kanvas: Kanvas) {
  const s: Susunan = SUSUNAN[jenis];
  const { lebar: L, tinggi: T, t } = kanvas;
  const ufukY = T * s.ufuk;
  const kabut = antaraWarna(KABUT, t);
  const mulai = PUNGGUNG.length - s.lapis;
  const sunX = L * s.mx;
  const sunY =
    T *
    antaraAngka(
      [
        [0, 0.3],
        [0.5, 0.6],
        [0.78, 0.9],
        [1, 1.1],
      ],
      t,
    );
  const sunR = Math.max(12, Math.min(T * 0.085, 34));
  const sinar = antaraAngka(
    [
      [0, 0.95],
      [0.5, 0.85],
      [0.85, 0.25],
      [1, 0],
    ],
    t,
  );

  const lapisan = Array.from({ length: s.lapis }, (_, k) => {
    const j = mulai + k;
    const warna = antaraWarna(PUNGGUNG[j], t);
    const dasar = ufukY + (T - ufukY) * (k / s.lapis) * 0.82 + T * 0.03;
    const amp = T * (0.26 - k * 0.026) * s.amp;
    // Lapis jauh halus dan berkabut, lapis dekat kasar dan bersiluet.
    const kabutLapis = 0.52 - k * 0.115;
    const kasar = 0.4 + k * 0.055;
    const d = punggung(L, dasar, amp, kasar, 7 + j * 13);
    return {
      d: `${d} ${T} L${-L * 0.05} ${T}Z`,
      henti: [
        henti(0, warna),
        henti(0.5, campur(warna, kabut, kabutLapis * 0.45)),
        henti(1, campur(warna, kabut, kabutLapis)),
      ],
      // Dua lapis terjauh dikaburkan tipis.
      kabur: [1.4, 0.7][k] ?? null,
    };
  });

  return {
    lebar: L,
    tinggi: T,
    langit: [
      henti(0, kanvas.atas ?? antaraWarna(LANGIT.atas, t)),
      henti(0.42, antaraWarna(LANGIT.tengah, t)),
      henti(0.78, antaraWarna(LANGIT.bawah, t)),
      henti(1, antaraWarna(LANGIT.ufuk, t)),
    ],
    bintang: s.bintang ? bintang(L, T, t) : [],
    cahayaUfuk: {
      cx: sunX,
      cy: ufukY,
      rx: L * 0.75,
      ry: T * 0.34,
      henti: [henti(0, "#FFE0A0", sinar * 0.55), henti(1, "#FFE0A0", 0)],
    },
    awan: {
      kabur: Math.max(2, T * 0.012),
      elips: s.awan ? awan(L, T, ufukY, t) : [],
    },
    matahari: s.matahari
      ? {
          cx: sunX,
          cy: sunY,
          r: sunR,
          warna: "#FFF1C4",
          opasitas: Math.max(0, Math.min(1, sinar + 0.1)),
          pendar: {
            r: sunR * 6,
            henti: [
              henti(0, "#FFF4CF", sinar),
              henti(0.25, "#FFD98C", sinar * 0.55),
              henti(1, "#FFB66B", 0),
            ],
          },
        }
      : null,
    punggung: lapisan,
    kabut: {
      y: T * s.kabut,
      tinggi: T * (1 - s.kabut) + 1,
      henti: [henti(0, kanvas.kabutKe, 0), henti(1, kanvas.kabutKe)],
    },
    butir: s.butir,
  };
}

/** Dua warna teks di atas langit kartu senja (DESIGN.md "Pemandangan senja"). */
export const WARNA_TEKS_LANGIT = { gelap: "#2A1F4D", putih: "#FFFFFF" };

/** Luminans relatif sebuah warna hex menurut WCAG. */
function luminans(hex: string) {
  const [r, g, b] = keRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rasio kontras dua warna hex menurut WCAG, misalnya 4,5 untuk 4,5:1. */
function kontras(a: string, b: string) {
  const [terang, gelap] = [luminans(a), luminans(b)].sort((x, y) => y - x);
  return (terang + 0.05) / (gelap + 0.05);
}

/**
 * Warna angka waktu dan Total bayar yang ditulis di atas langit kartu senja (DESIGN.md "Pemandangan
 * senja"): #2A1F4D atau putih, mengikuti luminans langit di belakang teks, yaitu kunci atas dan tengah
 * langit pada waktu t. Yang dipilih adalah warna dengan kontras terendah yang lebih tinggi terhadap kedua
 * kunci itu. Kunci atas bawaannya diinterpolasi terhadap t, seperti di kartu senja.
 */
export function warnaTeksLangit({ t, atas }: { t: number; atas?: string }) {
  const langit = [
    atas ?? antaraWarna(LANGIT.atas, t),
    antaraWarna(LANGIT.tengah, t),
  ];
  const terendah = (teks: string) =>
    Math.min(...langit.map((warna) => kontras(teks, warna)));
  const { gelap, putih } = WARNA_TEKS_LANGIT;
  return terendah(gelap) > terendah(putih) ? gelap : putih;
}
