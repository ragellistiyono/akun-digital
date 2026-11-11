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
  return {
    d: `${d} L${x(n).toFixed(1)} ${y[n].toFixed(1)} L${x(n).toFixed(1)}`,
    // Kurva kuadratik tidak pernah melewati titik kendalinya, jadi titik kendali tertinggi adalah batas
    // atas punggung ini.
    puncak: Math.min(...y),
  };
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
  // Kartu senja Halaman bayar: cakrawala di 62% tinggi kartu seperti prototipe. Letak mendatar matahari
  // ditentukan kotak teks di atas langit (lihat `teks` di Kanvas); 70% lebar hanya dipakai tanpa kotak teks.
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
  /**
   * Kotak teks yang ditulis di atas langit, misalnya angka waktu dan Total bayar di kartu senja. Cakram
   * matahari beserta pendarnya, cahaya ufuk, awan, dan bintang dijauhkan dari kotak ini di sepanjang
   * waktu senja, supaya yang ada di belakang teks hanya gradien langit.
   */
  teks?: Kotak[];
};

/** Kotak di kanvas, dalam piksel dari pojok kiri atas. */
export type Kotak = { x: number; y: number; lebar: number; tinggi: number };

/** Jarak kosong antara kotak teks dan apa pun yang dijauhkan darinya, dalam piksel. */
const JARAK_AMAN = 2;

const bertumpuk = (a1: number, a2: number, b1: number, b2: number) =>
  a1 < b2 && b1 < a2;

/**
 * Jarak terpendek dari lintasan pusat matahari, yaitu garis tegak di x dari y0 sampai y1, ke kotak-kotak
 * teks. Tanpa kotak teks, jaraknya tak terhingga.
 */
function jarakKeTeks(x: number, y0: number, y1: number, teks: Kotak[]) {
  return teks.reduce(
    (terdekat, k) =>
      Math.min(
        terdekat,
        Math.hypot(
          Math.max(k.x - x, 0, x - (k.x + k.lebar)),
          Math.max(k.y - y1, 0, y0 - (k.y + k.tinggi)),
        ),
      ),
    Infinity,
  );
}

/**
 * Letak mendatar matahari yang lintasannya paling jauh dari kotak teks: titik tengah salah satu celah di
 * antara kotak teks dan tepi kanvas. Cakramnya tetap utuh di dalam kanvas.
 */
function letakMatahari(
  L: number,
  r: number,
  y0: number,
  y1: number,
  teks: Kotak[],
) {
  const calon: number[] = [];
  let mulai = r;
  for (const k of [...teks].sort((a, b) => a.x - b.x)) {
    if (k.x > mulai) calon.push((mulai + k.x) / 2);
    mulai = Math.max(mulai, k.x + k.lebar);
  }
  if (L - r > mulai) calon.push((mulai + L - r) / 2);
  if (calon.length === 0) return L / 2;
  return calon.reduce((terbaik, x) =>
    jarakKeTeks(x, y0, y1, teks) > jarakKeTeks(terbaik, y0, y1, teks)
      ? x
      : terbaik,
  );
}

export type Henti = { offset: number; warna: string; opasitas: number };

const henti = (offset: number, warna: string, opasitas = 1): Henti => ({
  offset,
  warna,
  opasitas,
});

const antaraAngka = (kunci: Kunci<number>, t: number) =>
  antara(kunci, t, (a, b, k) => a + (b - a) * k);

/** Simpangan kabur awan, dalam piksel. */
const kaburAwan = (T: number) => Math.max(2, T * 0.012);

// Guratan awan tipis: elips kabur yang menyala hangat dekat matahari. Awan yang kaburnya (sampai tiga kali
// simpangan) mengenai kotak teks digeser turun ke bawah kotak itu.
function awan(L: number, T: number, ufukY: number, t: number, teks: Kotak[]) {
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
  const pinggir = 3 * kaburAwan(T);
  return Array.from({ length: 6 }, () => {
    let cy = ufukY - T * (0.06 + r() * 0.32);
    const lebar = L * (0.18 + r() * 0.32);
    const cx = r() * L;
    const ry = T * (0.006 + r() * 0.012);
    for (let geser = true; geser;) {
      geser = false;
      for (const k of teks) {
        if (
          bertumpuk(
            cx - lebar / 2 - pinggir,
            cx + lebar / 2 + pinggir,
            k.x,
            k.x + k.lebar,
          ) &&
          bertumpuk(cy - ry - pinggir, cy + ry + pinggir, k.y, k.y + k.tinggi)
        ) {
          cy = k.y + k.tinggi + ry + pinggir;
          geser = true;
        }
      }
    }
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

// 46 titik putih yang memudar masuk saat t di atas 0,6. Bintang yang jatuh di kotak teks dipindah ke tempat
// acak lain.
function bintang(L: number, T: number, t: number, teks: Kotak[]) {
  if (t <= 0.6) return [];
  const r = acak(91);
  const a = Math.min(1, (t - 0.6) / 0.3);
  const diTeks = (x: number, y: number) =>
    teks.some(
      (k) =>
        bertumpuk(x - JARAK_AMAN, x + JARAK_AMAN, k.x, k.x + k.lebar) &&
        bertumpuk(y - JARAK_AMAN, y + JARAK_AMAN, k.y, k.y + k.tinggi),
    );
  return Array.from({ length: 46 }, () => {
    let cx = r() * L;
    let cy = r() * T * 0.45;
    for (let coba = 0; coba < 50 && diTeks(cx, cy); coba++) {
      cx = r() * L;
      cy = r() * T * 0.45;
    }
    return {
      cx,
      cy,
      r: r() * 0.9 + 0.35,
      warna: "#FFFFFF",
      opasitas: a * (r() * 0.6 + 0.25),
    };
  });
}

// Posisi vertikal pusat matahari terhadap t, dalam pecahan tinggi kanvas (DESIGN.md: 30% → 60% → 110%).
const LINTASAN_MATAHARI: Kunci<number> = [
  [0, 0.3],
  [0.5, 0.6],
  [0.78, 0.9],
  [1, 1.1],
];

export function lukisPemandangan(jenis: JenisPemandangan, kanvas: Kanvas) {
  const s: Susunan = SUSUNAN[jenis];
  const { lebar: L, tinggi: T, t } = kanvas;
  const ufukY = T * s.ufuk;
  const kabut = antaraWarna(KABUT, t);
  const mulai = PUNGGUNG.length - s.lapis;
  const teks = kanvas.teks ?? [];
  const sunY = T * antaraAngka(LINTASAN_MATAHARI, t);
  let sunX = L * s.mx;
  let sunR = Math.max(12, Math.min(T * 0.085, 34));
  let pendarR = sunR * 6;
  let ufukRy = T * 0.34;
  if (teks.length > 0) {
    // Lintasan matahari diletakkan di celah antarkotak teks. Cakram dan pendarnya diperkecil bila perlu,
    // supaya tidak pernah menyentuh kotak teks di sepanjang lintasannya.
    const y0 = T * LINTASAN_MATAHARI[0][1];
    const y1 = T * LINTASAN_MATAHARI[LINTASAN_MATAHARI.length - 1][1];
    sunX = letakMatahari(L, sunR, y0, y1, teks);
    const ruang = jarakKeTeks(sunX, y0, y1, teks) - JARAK_AMAN;
    sunR = Math.min(sunR, Math.max(4, ruang));
    pendarR = Math.min(pendarR, Math.max(sunR, ruang));
    // Cahaya ufuk tidak naik sampai kotak teks di atas cakrawala.
    const bawahTeks = Math.max(
      0,
      ...teks.filter((k) => k.y < ufukY).map((k) => k.y + k.tinggi),
    );
    ufukRy = Math.max(1, Math.min(ufukRy, ufukY - bawahTeks - JARAK_AMAN));
  }
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
    const { d, puncak } = punggung(L, dasar, amp, kasar, 7 + j * 13);
    return {
      d: `${d} ${T} L${-L * 0.05} ${T}Z`,
      puncak,
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
    bintang: s.bintang ? bintang(L, T, t, teks) : [],
    cahayaUfuk: {
      cx: sunX,
      cy: ufukY,
      rx: L * 0.75,
      ry: ufukRy,
      henti: [henti(0, "#FFE0A0", sinar * 0.55), henti(1, "#FFE0A0", 0)],
    },
    awan: {
      kabur: kaburAwan(T),
      elips: s.awan ? awan(L, T, ufukY, t, teks) : [],
    },
    matahari: s.matahari
      ? {
          cx: sunX,
          cy: sunY,
          r: sunR,
          warna: "#FFF1C4",
          opasitas: Math.max(0, Math.min(1, sinar + 0.1)),
          pendar: {
            r: pendarR,
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

type Lukisan = ReturnType<typeof lukisPemandangan>;

/** Dua warna teks di atas langit kartu senja (DESIGN.md "Pemandangan senja"). */
export const WARNA_TEKS_LANGIT = { gelap: "#2A1F4D", putih: "#FFFFFF" };

/** Luminans relatif sebuah warna RGB 0–255 menurut WCAG. */
function luminans(rgb: number[]) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rasio kontras dua luminans relatif menurut WCAG, misalnya 4,5 untuk 4,5:1. */
function rasioKontras(a: number, b: number) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Warna dan opasitas gradien dengan henti itu di posisi k (0–1), diinterpolasi lurus seperti di SVG. */
function diGradien(semua: Henti[], k: number) {
  for (let i = 1; i < semua.length; i++) {
    const [a, b] = [semua[i - 1], semua[i]];
    if (k <= b.offset) {
      const f = Math.max(0, (k - a.offset) / (b.offset - a.offset || 1));
      return {
        warna: campur(a.warna, b.warna, f),
        opasitas: a.opasitas + (b.opasitas - a.opasitas) * f,
      };
    }
  }
  return semua[semua.length - 1];
}

/**
 * Warna lukisan di titik (x, y), dalam RGB 0–255: langit, bintang, cahaya ufuk, awan, lalu pendar dan
 * cakram matahari, ditumpuk dengan urutan dan opasitas yang sama seperti di SVG. Awan dihitung pekat
 * sampai tiga kali simpangan kaburnya. Punggung gunung, kabut lembah, dan butiran tidak dihitung, karena
 * teks hanya ditulis di langit di atas punggung gunung.
 */
function warnaDi(l: Lukisan, x: number, y: number) {
  let rgb = keRgb(diGradien(l.langit, y / l.tinggi).warna);
  const tumpuk = (warna: string, a: number) => {
    const atas = keRgb(warna);
    const k = Math.max(0, Math.min(1, a));
    rgb = rgb.map((v, i) => v + (atas[i] - v) * k);
  };
  for (const b of l.bintang) {
    if (Math.hypot(x - b.cx, y - b.cy) <= b.r) tumpuk(b.warna, b.opasitas);
  }
  const u = l.cahayaUfuk;
  const jarakUfuk = Math.hypot((x - u.cx) / u.rx, (y - u.cy) / u.ry);
  if (jarakUfuk < 1) {
    const h = diGradien(u.henti, jarakUfuk);
    tumpuk(h.warna, h.opasitas);
  }
  const pinggir = 3 * l.awan.kabur;
  for (const a of l.awan.elips) {
    if (
      Math.hypot(
        (x - a.cx) / (a.rx + pinggir),
        (y - a.cy) / (a.ry + pinggir),
      ) <= 1
    ) {
      tumpuk(a.warna, a.opasitas);
    }
  }
  const m = l.matahari;
  if (m) {
    const jarak = Math.hypot(x - m.cx, y - m.cy);
    if (jarak < m.pendar.r) {
      const h = diGradien(m.pendar.henti, jarak / m.pendar.r);
      tumpuk(h.warna, h.opasitas);
    }
    if (jarak <= m.r) tumpuk(m.warna, m.opasitas);
  }
  return rgb;
}

/** Jarak antartitik contoh di dalam kotak teks, dalam piksel. */
const LANGKAH_CONTOH = 2;

/**
 * Warna teks yang ditulis di atas langit sebuah lukisan (DESIGN.md "Pemandangan senja"): #2A1F4D atau
 * putih, mengikuti luminans yang benar-benar dilukis di belakang teks. Warna lukisan dicontoh setiap 2 px
 * di dalam kotak-kotak teks, termasuk tepinya, lalu dipilih warna yang kontras terendahnya terhadap
 * semua titik contoh lebih tinggi. Hasilnya membawa kontras terendah itu sebagai bahan hitungnya.
 */
export function warnaTeksLangit(lukisan: Lukisan, teks: Kotak[]) {
  const latar: number[] = [];
  const langkah = (awal: number, panjang: number) => {
    const titik: number[] = [];
    for (let v = awal; v < awal + panjang; v += LANGKAH_CONTOH) titik.push(v);
    titik.push(awal + panjang);
    return titik;
  };
  for (const k of teks) {
    for (const y of langkah(k.y, k.tinggi)) {
      for (const x of langkah(k.x, k.lebar)) {
        latar.push(luminans(warnaDi(lukisan, x, y)));
      }
    }
  }
  // Putih didahulukan, jadi putih yang dipilih bila kontras keduanya sama.
  const { putih, gelap } = WARNA_TEKS_LANGIT;
  const pilihan = [putih, gelap].map((warna) => {
    const terang = luminans(keRgb(warna));
    return {
      warna,
      kontras: latar.reduce(
        (terendah, l) => Math.min(terendah, rasioKontras(terang, l)),
        Infinity,
      ),
    };
  });
  return pilihan.reduce((terbaik, p) =>
    p.kontras > terbaik.kontras ? p : terbaik,
  );
}
