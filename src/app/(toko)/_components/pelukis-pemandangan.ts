// Pelukis pemandangan coretan tangan (docs/design/acuan-coretan-tangan.md): punggung gunung, matahari atau
// bulan, awan, burung, bintang, dan arsiran digambar seperti sketsa pensil di atas kertas. Bentuknya
// berasal dari pembangkit acak berbenih tetap, jadi ukuran dan waktu yang sama selalu menghasilkan lukisan
// yang sama. Modul ini tidak memegang nilai warna. Isi lapis ditulis sebagai `var(--token)`, dan warna
// garis dipilih komponen dari token, sehingga mode gelap ikut otomatis.
// t: waktu senja, 0 = sore, 1 = malam. Di atas 0,6 bintang mulai muncul. Di kartu bayar, t digerakkan
// hitung mundur QRIS dan matahari tenggelam di balik punggung gunung saat t = 1.

/** Kotak di kanvas, dalam piksel dari pojok kiri atas. */
export type Kotak = { x: number; y: number; lebar: number; tinggi: number };

type Rentang = readonly [number, number];

type SusunanLapis = {
  /** Warna isi lapis, selalu token. */
  isi: string;
  /** Letak puncak di zona gunung: 0 = batas atas zona, 1 = garis cakrawala. */
  puncak: Rentang;
  /** Kemiringan lereng (naik per piksel mendatar). */
  lereng: Rentang;
  /** Jarak antarpuncak, dalam kelipatan tinggi zona gunung. */
  jarak: Rentang;
  /** Topi salju bergaris putus-putus di puncak yang cukup tinggi. */
  salju: boolean;
};

type Susunan = {
  /** Jarak garis cakrawala dari tepi bawah kanvas, dalam piksel. */
  dasar: number;
  /** Batas atas zona gunung, pecahan tinggi kanvas. */
  zonaAtas: number;
  /** Tebal garis luar pensil, dalam piksel. */
  tebal: number;
  /** Simpangan getaran tangan pada garis, dalam piksel. */
  getar: number;
  lapis: SusunanLapis[];
  /**
   * Benda langit. "tetap": matahari di mode terang dan bulan sabit di mode gelap (t di atas 0,6), di
   * tempat yang tetap. "tenggelam": matahari yang turun mengikuti t. null: tanpa benda langit.
   */
  benda: "tetap" | "tenggelam" | null;
  awan: number;
  burung: number;
  bintang: number;
  /** Arsiran langit pulpen yang bertambah mengikuti t. */
  arsiranLangit: boolean;
};

const JAUH = "var(--kertas-lama)";
const TENGAH = "var(--kertas)";
const DEKAT = "var(--permukaan)";

const SUSUNAN = {
  // Pita Beranda: pemandangan penuh tiga lapis. Kotak cari ditaruh pemakainya di bagian atas pita, jadi
  // gunung berada di separuh bawah dan matahari di kanan.
  pita: {
    dasar: 6,
    zonaAtas: 0.5,
    tebal: 2.5,
    getar: 1.6,
    lapis: [
      {
        isi: JAUH,
        puncak: [0, 0.3],
        lereng: [0.6, 0.95],
        jarak: [0.7, 1.2],
        salju: true,
      },
      {
        isi: TENGAH,
        puncak: [0.3, 0.55],
        lereng: [0.45, 0.75],
        jarak: [0.9, 1.5],
        salju: false,
      },
      {
        isi: DEKAT,
        puncak: [0.58, 0.8],
        lereng: [0.25, 0.45],
        jarak: [1.3, 2.2],
        salju: false,
      },
    ],
    benda: "tetap",
    awan: 3,
    burung: 3,
    bintang: 10,
    arsiranLangit: false,
  },
  // Strip tepi halaman dalam: punggung rendah dua lapis, tanpa benda langit, awan, burung, dan bintang.
  tepi: {
    dasar: 3,
    zonaAtas: 0.2,
    tebal: 2,
    getar: 1,
    lapis: [
      {
        isi: JAUH,
        puncak: [0, 0.35],
        lereng: [0.3, 0.5],
        jarak: [1.8, 3],
        salju: false,
      },
      {
        isi: DEKAT,
        puncak: [0.4, 0.65],
        lereng: [0.2, 0.35],
        jarak: [2.5, 4],
        salju: false,
      },
    ],
    benda: null,
    awan: 0,
    burung: 0,
    bintang: 0,
    arsiranLangit: false,
  },
  // Kartu senja Halaman bayar: tiga lapis, matahari yang tenggelam, dua awan, bintang, dan arsiran langit.
  bayar: {
    dasar: 6,
    zonaAtas: 0.56,
    tebal: 2.5,
    getar: 1.4,
    lapis: [
      {
        isi: JAUH,
        puncak: [0, 0.3],
        lereng: [0.55, 0.9],
        jarak: [0.9, 1.5],
        salju: true,
      },
      {
        isi: TENGAH,
        puncak: [0.3, 0.55],
        lereng: [0.45, 0.75],
        jarak: [1.1, 1.8],
        salju: false,
      },
      {
        isi: DEKAT,
        puncak: [0.58, 0.8],
        lereng: [0.25, 0.45],
        jarak: [1.5, 2.5],
        salju: false,
      },
    ],
    benda: "tenggelam",
    awan: 2,
    burung: 0,
    bintang: 8,
    arsiranLangit: true,
  },
} satisfies Record<string, Susunan>;

export type JenisPemandangan = keyof typeof SUSUNAN;

type Kanvas = {
  lebar: number;
  tinggi: number;
  t: number;
  /**
   * Kotak teks yang ditulis di atas langit, misalnya angka waktu dan Total bayar di kartu senja.
   * Matahari, bintang, awan, dan arsiran langit dijauhkan dari kotak ini di sepanjang waktu senja, dan
   * puncak gunung tetap di bawahnya, supaya yang ada di belakang teks hanya kertas.
   */
  teks?: Kotak[];
};

/** Jarak kosong antara kotak teks dan apa pun yang dijauhkan darinya, dalam piksel. */
const JARAK_AMAN = 2;

/** Waktu senja saat bintang mulai muncul, dan saat semuanya sudah tampak. */
const BINTANG_MULAI = 0.6;
const BINTANG_PENUH = 0.8;

// Pembangkit acak LCG dengan benih tetap, supaya lukisan yang sama selalu menghasilkan bentuk yang sama.
function acak(benih: number) {
  let s = benih >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

type Acak = ReturnType<typeof acak>;

const dalam = (r: Acak, [a, b]: Rentang) => a + r() * (b - a);

const batasi = (v: number, bawah: number, atas: number) =>
  Math.min(atas, Math.max(bawah, v));

/** Angka di path SVG: satu desimal, tanpa "-0". */
const n = (v: number) => String(Math.round(v * 10) / 10 || 0);

type Titik = [number, number];

const garisPatah = (titik: Titik[]) =>
  titik.map(([x, y], i) => `${i === 0 ? "M" : "L"}${n(x)} ${n(y)}`).join(" ");

const ruas = ([x1, y1]: Titik, [x2, y2]: Titik) =>
  `M${n(x1)} ${n(y1)} L${n(x2)} ${n(y2)}`;

/** Kurva tertutup yang halus melewati titik tengah antartitik, seperti lingkaran yang digambar tangan. */
function kurvaTertutup(titik: Titik[]) {
  const tengah = (a: Titik, b: Titik): Titik => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  const awal = tengah(titik[titik.length - 1], titik[0]);
  let d = `M${n(awal[0])} ${n(awal[1])}`;
  titik.forEach((p, i) => {
    const m = tengah(p, titik[(i + 1) % titik.length]);
    d += ` Q${n(p[0])} ${n(p[1])} ${n(m[0])} ${n(m[1])}`;
  });
  return `${d}Z`;
}

const bertumpuk = (a: Kotak, b: Kotak) =>
  a.x < b.x + b.lebar &&
  b.x < a.x + a.lebar &&
  a.y < b.y + b.tinggi &&
  b.y < a.y + a.tinggi;

const perbesar = (k: Kotak, p: number): Kotak => ({
  x: k.x - p,
  y: k.y - p,
  lebar: k.lebar + 2 * p,
  tinggi: k.tinggi + 2 * p,
});

const kenaTeks = (k: Kotak, teks: Kotak[]) =>
  teks.some((t) => bertumpuk(perbesar(k, JARAK_AMAN), t));

/** Kotak pembatas sekumpulan titik, diperlebar setengah tebal garis. */
function kotakTitik(titik: Titik[], tebal: number): Kotak {
  const xs = titik.map(([x]) => x);
  const ys = titik.map(([, y]) => y);
  const x = Math.min(...xs) - tebal / 2;
  const y = Math.min(...ys) - tebal / 2;
  return {
    x,
    y,
    lebar: Math.max(...xs) + tebal / 2 - x,
    tinggi: Math.max(...ys) + tebal / 2 - y,
  };
}

// ---------------------------------------------------------------------------------------------------
// Punggung gunung: setiap puncak adalah tenda dua lereng, dan punggung adalah sisi atas gabungan tenda itu.
// Garisnya dicontoh tiap beberapa piksel lalu digetarkan sedikit, supaya terasa digambar tangan.

type Puncak = { x: number; y: number; kiri: number; kanan: number };

const tenda = (p: Puncak, x: number) =>
  p.y + (x < p.x ? (p.x - x) * p.kiri : (x - p.x) * p.kanan);

function punggungDi(puncak: Puncak[], dasar: number, x: number) {
  let y = dasar;
  for (const p of puncak) y = Math.min(y, tenda(p, x));
  return y;
}

type Zona = { atas: number; dasar: number };

type Lapis = {
  /** Isi lapis, token `var(--…)`. */
  isi: string;
  /** Bentuk tertutup lapis, dari punggung sampai garis cakrawala. */
  d: string;
  /** Garis luar punggung. */
  garis: string;
  /** Garis kedua yang tipis dan sedikit bergeser, seperti pensil yang diulang. */
  garisTipis: string;
  /** Arsiran garis miring di lereng kiri setiap puncak, dipotong ke bentuk lapis. */
  arsiran: string;
  /** Topi salju bergaris putus-putus, atau null. */
  salju: string | null;
  /** Titik tertinggi punggung (y terkecil). */
  puncak: number;
};

function lukisLapis(
  L: number,
  zona: Zona,
  s: Susunan,
  ls: SusunanLapis,
  benih: number,
): { lapis: Lapis; di: (x: number) => number } {
  const r = acak(benih);
  const Z = zona.dasar - zona.atas;
  const pinggir = Z * ls.jarak[1];

  const puncak: Puncak[] = [];
  for (let x = -pinggir * r(); x < L + pinggir; x += Z * dalam(r, ls.jarak)) {
    const lereng = dalam(r, ls.lereng);
    puncak.push({
      x,
      y: zona.atas + Z * dalam(r, ls.puncak),
      kiri: lereng * (0.8 + r() * 0.4),
      kanan: lereng * (0.8 + r() * 0.4),
    });
  }
  const di = (x: number) => punggungDi(puncak, zona.dasar, x);
  const terlihat = (p: Puncak, x: number) =>
    tenda(p, x) < zona.dasar && di(x) >= tenda(p, x) - 0.01;

  // Titik contoh: tiap beberapa piksel, ditambah setiap puncak supaya puncaknya tetap runcing.
  const langkah = Math.max(5, L / 110);
  const xs = new Set<number>();
  for (let x = -4; x < L + 4; x += langkah) xs.add(x);
  xs.add(L + 4);
  for (const p of puncak) if (p.x > -4 && p.x < L + 4) xs.add(p.x);
  const contoh = [...xs].sort((a, b) => a - b);

  const titik: Titik[] = contoh.map((x) => [
    x,
    Math.min(zona.dasar, di(x) + (r() - 0.5) * s.getar),
  ]);
  const tipis: Titik[] = titik.map(([x, y]) => [
    x + (r() - 0.5) * 1.2,
    Math.min(zona.dasar, y + 0.9 + (r() - 0.5) * s.getar),
  ]);
  const [x0] = titik[0];
  const [xn] = titik[titik.length - 1];

  // Arsiran: garis miring "\" dari lereng kiri ke dalam badan gunung, menjauhi matahari di kanan.
  const sela = batasi(Z * 0.09, 4.5, 9);
  const sudut = Math.tan((58 * Math.PI) / 180);
  const arsiran: string[] = [];
  const salju: string[] = [];
  for (const p of puncak) {
    if (p.x < -pinggir || p.x > L + pinggir || !terlihat(p, p.x)) continue;
    let awal = p.x;
    while (awal > -pinggir && terlihat(p, awal - 1)) awal -= 1;
    for (
      let x = p.x - sela * 0.6;
      x > awal + sela * 0.3;
      x -= sela * (0.85 + r() * 0.3)
    ) {
      const y = tenda(p, x) + 1.2;
      const turun =
        Math.min((zona.dasar - y) * 0.85, Z * 0.45) * (0.5 + r() * 0.4);
      if (turun < 3) continue;
      arsiran.push(ruas([x, y], [x + turun / sudut, y + turun]));
    }

    const tinggi = zona.dasar - p.y;
    if (!ls.salju || tinggi < Z * 0.6) continue;
    const dalamTopi = tinggi * 0.2;
    const xl = p.x - dalamTopi / p.kiri;
    const xr = p.x + dalamTopi / p.kanan;
    if (!terlihat(p, xl) || !terlihat(p, xr)) continue;
    const yc = p.y + dalamTopi;
    const z = dalamTopi * 0.4;
    const w = xr - xl;
    salju.push(
      garisPatah([
        [xl, yc],
        [xl + w * 0.25, yc + z],
        [xl + w * 0.5, yc - z * 0.3],
        [xl + w * 0.75, yc + z],
        [xr, yc],
      ]),
    );
  }

  const lapis = {
    isi: ls.isi,
    d: `M${n(x0)} ${n(zona.dasar)} ${garisPatah(titik).replace(/^M/, "L")} L${n(xn)} ${n(zona.dasar)}Z`,
    garis: garisPatah(titik),
    garisTipis: garisPatah(tipis),
    arsiran: arsiran.join(" "),
    salju: salju.length > 0 ? salju.join(" ") : null,
    puncak: Math.min(...titik.map(([, y]) => y)),
  };
  return { lapis, di };
}

// ---------------------------------------------------------------------------------------------------
// Benda langit.

type Matahari = {
  cx: number;
  cy: number;
  r: number;
  /** Jari-jari terluar, termasuk sinar dan setengah tebal garis. */
  rLuar: number;
  /** Lingkaran goyah, dalam koordinat lokal berpusat di (0, 0). */
  tubuh: string;
  /** Sinar garis pendek, dalam koordinat lokal berpusat di (0, 0). */
  sinar: string;
};

type Bulan = {
  cx: number;
  cy: number;
  rLuar: number;
  /** Bulan sabit, dalam koordinat lokal berpusat di (0, 0). */
  tubuh: string;
};

/** Ujung terluar sinar, kelipatan jari-jari matahari. */
const SINAR_LUAR = 1.72;

const rLuarMatahari = (r: number, tebal: number) => r * SINAR_LUAR + tebal / 2;

function lukisMatahari(
  cx: number,
  cy: number,
  r: number,
  tebal: number,
  benih: number,
): Matahari {
  const acakan = acak(benih);
  const awal = acakan() * Math.PI * 2;
  const tubuh: Titik[] = Array.from({ length: 12 }, (_, i) => {
    const a = awal + (i * Math.PI * 2) / 12;
    const jari = r * (1 + (acakan() - 0.5) * 0.1);
    return [Math.cos(a) * jari, Math.sin(a) * jari];
  });
  const jumlahSinar = 10;
  const sinar = Array.from({ length: jumlahSinar }, (_, i) => {
    const a = awal + (i * Math.PI * 2) / jumlahSinar + (acakan() - 0.5) * 0.15;
    const luar = r * (1.58 + acakan() * (SINAR_LUAR - 1.58));
    const [c, s] = [Math.cos(a), Math.sin(a)];
    return ruas([c * r * 1.32, s * r * 1.32], [c * luar, s * luar]);
  });
  return {
    cx,
    cy,
    r,
    rLuar: rLuarMatahari(r, tebal),
    tubuh: kurvaTertutup(tubuh),
    sinar: sinar.join(" "),
  };
}

const selisihSudut = (a: number, b: number) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// Bulan sabit: busur luar lingkaran besar, lalu busur dalam lingkaran yang digeser ke kanan atas.
function lukisBulan(
  cx: number,
  cy: number,
  R: number,
  tebal: number,
  benih: number,
): Bulan {
  const acakan = acak(benih);
  const miring = -0.55;
  const geser = R * 0.4;
  const R1 = R * 0.9;
  const pusat1: Titik = [Math.cos(miring) * geser, Math.sin(miring) * geser];
  const buka = Math.acos((geser * geser + R * R - R1 * R1) / (2 * geser * R));
  const goyah = (j: number) => j * (1 + (acakan() - 0.5) * 0.05);

  const luar: Titik[] = Array.from({ length: 17 }, (_, i) => {
    const a = miring + buka + (i / 16) * (Math.PI * 2 - 2 * buka);
    const j = i === 0 || i === 16 ? R : goyah(R);
    return [Math.cos(a) * j, Math.sin(a) * j];
  });
  const sudutDi = ([x, y]: Titik) => Math.atan2(y - pusat1[1], x - pusat1[0]);
  const dari = sudutDi(luar[16]);
  const naik =
    (((sudutDi(luar[0]) - dari) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const turun = naik - Math.PI * 2;
  const arah =
    selisihSudut(dari + naik / 2, miring + Math.PI) <
    selisihSudut(dari + turun / 2, miring + Math.PI)
      ? naik
      : turun;
  const dalamBusur: Titik[] = Array.from({ length: 11 }, (_, i) => {
    const a = dari + (arah * (i + 1)) / 12;
    const j = goyah(R1);
    return [pusat1[0] + Math.cos(a) * j, pusat1[1] + Math.sin(a) * j];
  });
  return {
    cx,
    cy,
    rLuar: R * 1.03 + tebal / 2,
    tubuh: `${garisPatah([...luar, ...dalamBusur])}Z`,
  };
}

/** Tanda bintang pensil: silang dua garis atau bintang tiga garis. */
type Bintang = { x: number; y: number; r: number; d: string };

function lukisBintang(x: number, y: number, r: Acak): Bintang {
  const ukuran = 2.5 + r() * 2;
  const garis = r() < 0.4 ? 2 : 3;
  const putar = r() * Math.PI;
  const d = Array.from({ length: garis }, (_, i) => {
    const a = putar + (i * Math.PI) / garis;
    const [dx, dy] = [Math.cos(a) * ukuran, Math.sin(a) * ukuran];
    return ruas([x - dx, y - dy], [x + dx, y + dy]);
  }).join(" ");
  // Setengah tebal garis bintang (1,6 px) ikut dihitung.
  return { x, y, r: ukuran + 0.8, d };
}

type Awan = { d: string; kotak: Kotak };

// Awan coretan: alas yang hampir datar dan tiga atau empat gundukan di atasnya.
function lukisAwan(cx: number, cy: number, w: number, r: Acak): Awan {
  const h = w * 0.42;
  const alas = cy + h / 2;
  const gundukan = w > 70 ? 4 : 3;
  const sambung = (i: number): Titik => [
    cx + w / 2 - (i * w) / gundukan,
    i === 0 || i === gundukan ? alas : cy + h * 0.05 + (r() - 0.5) * h * 0.1,
  ];
  const ujung = Array.from({ length: gundukan + 1 }, (_, i) => sambung(i));
  let d = `M${n(ujung[0][0])} ${n(ujung[0][1])}`;
  const contoh: Titik[] = [];
  for (let i = 0; i < gundukan; i++) {
    const [a, b] = [ujung[i], ujung[i + 1]];
    const tengahan = i > 0 && i < gundukan - 1;
    const naik = h * (tengahan ? 0.62 + r() * 0.1 : 0.45 + r() * 0.1);
    const k1: Titik = [a[0], a[1] - naik];
    const k2: Titik = [b[0], b[1] - naik];
    d += ` C${n(k1[0])} ${n(k1[1])} ${n(k2[0])} ${n(k2[1])} ${n(b[0])} ${n(b[1])}`;
    for (let u = 0; u <= 1; u += 0.0625) {
      const v = 1 - u;
      contoh.push([
        v * v * v * a[0] +
          3 * v * v * u * k1[0] +
          3 * v * u * u * k2[0] +
          u * u * u * b[0],
        v * v * v * a[1] +
          3 * v * v * u * k1[1] +
          3 * v * u * u * k2[1] +
          u * u * u * b[1],
      ]);
    }
  }
  const lengkung = alas + 1.5;
  d += ` Q${n(cx)} ${n(lengkung)} ${n(ujung[0][0])} ${n(ujung[0][1])}Z`;
  contoh.push([cx, lengkung]);
  // Tebal garis awan 2 px.
  return { d, kotak: kotakTitik(contoh, 2) };
}

// Burung "v": dua sayap melengkung yang bertemu di badan.
function lukisBurung(x: number, y: number, w: number) {
  const ujungKiri: Titik = [x - w, y - w * 0.5];
  const ujungKanan: Titik = [x + w, y - w * 0.5];
  return (
    `M${n(ujungKiri[0])} ${n(ujungKiri[1])} Q${n(x - w * 0.45)} ${n(y - w * 0.8)} ${n(x)} ${n(y)}` +
    ` Q${n(x + w * 0.45)} ${n(y - w * 0.8)} ${n(ujungKanan[0])} ${n(ujungKanan[1])}`
  );
}

/** Jarak mendatar terpendek dari garis tegak di x ke kotak-kotak teks. Tanpa kotak teks, tak terhingga. */
const jarakMendatar = (x: number, teks: Kotak[]) =>
  teks.reduce(
    (terdekat, k) =>
      Math.min(terdekat, Math.max(k.x - x, 0, x - (k.x + k.lebar))),
    Infinity,
  );

/**
 * Letak mendatar matahari yang lintasan tegaknya paling jauh dari kotak teks: titik tengah salah satu celah
 * di antara kotak teks dan tepi kanvas. Cakramnya tetap utuh di dalam kanvas.
 */
function letakMatahari(L: number, rLuar: number, teks: Kotak[]) {
  const calon: number[] = [];
  let mulai = rLuar;
  for (const k of [...teks].sort((a, b) => a.x - b.x)) {
    if (k.x > mulai) calon.push((mulai + k.x) / 2);
    mulai = Math.max(mulai, k.x + k.lebar);
  }
  if (L - rLuar > mulai) calon.push((mulai + L - rLuar) / 2);
  if (calon.length === 0) return L / 2;
  return calon.reduce((terbaik, x) =>
    jarakMendatar(x, teks) > jarakMendatar(terbaik, teks) ? x : terbaik,
  );
}

/**
 * Mencari tempat dengan mencoba titik acak. Syarat wajib selalu dipenuhi; syarat lunak dilepas bila
 * tidak ada tempat yang memenuhinya. Bila syarat wajib pun tidak bisa dipenuhi, hasilnya null.
 */
function cariTempat<T>(
  r: Acak,
  buat: () => T,
  wajib: (calon: T) => boolean,
  lunak: (calon: T) => boolean,
) {
  for (const pakaiLunak of [true, false]) {
    for (let coba = 0; coba < 40; coba++) {
      const calon = buat();
      if (wajib(calon) && (!pakaiLunak || lunak(calon))) return calon;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------

export function lukisPemandangan(jenis: JenisPemandangan, kanvas: Kanvas) {
  const s: Susunan = SUSUNAN[jenis];
  const { lebar: L, tinggi: T, t } = kanvas;
  const teks = kanvas.teks ?? [];
  const malam = t > BINTANG_MULAI;
  const dasar = T - s.dasar;

  // Puncak gunung selalu di bawah kotak teks, dengan sisa zona minimal 12 px.
  const bawahTeks = Math.max(0, ...teks.map((k) => k.y + k.tinggi));
  const atas = Math.min(
    dasar - 12,
    Math.max(T * s.zonaAtas, bawahTeks + JARAK_AMAN + s.getar + s.tebal),
  );
  const zona = { atas, dasar };
  const Z = dasar - atas;

  const punggung = s.lapis.map((ls, k) =>
    lukisLapis(L, zona, s, ls, 7 + k * 13),
  );
  const atasGunung = (x: number) => Math.min(...punggung.map((p) => p.di(x)));
  const diAtasGunung = (k: Kotak) =>
    [k.x, k.x + k.lebar / 2, k.x + k.lebar].every(
      (x) => k.y + k.tinggi < atasGunung(x) - 3,
    );

  // Benda langit.
  let matahari: Matahari | null = null;
  let bulan: Bulan | null = null;
  // Daerah tegak yang dilalui benda langit, untuk dijauhi awan, bintang, dan burung.
  let jalurBenda: {
    x: number;
    rLuar: number;
    atas: number;
    bawah: number;
  } | null = null;
  if (s.benda === "tetap") {
    const cx = L * 0.76;
    const cy = T * 0.44;
    const r = batasi(T * 0.075, 13, 24);
    if (malam) bulan = lukisBulan(cx, cy, r * 1.15, s.tebal, 53);
    else matahari = lukisMatahari(cx, cy, r, s.tebal, 41);
    const rLuar = (bulan ?? matahari)!.rLuar;
    jalurBenda = { x: cx, rLuar, atas: cy, bawah: cy };
  } else if (s.benda === "tenggelam") {
    // Matahari turun di celah antarkotak teks. Sinar dan cakramnya diperkecil bila celahnya sempit, supaya
    // tidak pernah menyentuh teks.
    let r = batasi(T * 0.1, 11, 24);
    const cx =
      teks.length > 0
        ? letakMatahari(L, rLuarMatahari(r, s.tebal), teks)
        : L * 0.7;
    const ruang = jarakMendatar(cx, teks) - JARAK_AMAN;
    r = Math.max(4, Math.min(r, (ruang - s.tebal / 2) / SINAR_LUAR));
    const rLuar = rLuarMatahari(r, s.tebal);
    // Punggung di bawah matahari: titik tertinggi dan terendahnya selebar matahari beserta sinarnya.
    const punggungDiBawah = Array.from({ length: 9 }, (_, i) =>
      atasGunung(cx - rLuar + (i * rLuar) / 4),
    );
    // Lintasan: dari tepi atas kanvas, cakram menyentuh punggung saat t = 0,5 (07:30), lalu tenggelam
    // pelan sampai seluruh matahari dan sinarnya berada di balik punggung saat t = 1.
    const awal = rLuar + 4;
    const sentuh = Math.max(awal, Math.min(...punggungDiBawah) - r);
    const tenggelam = Math.max(sentuh, Math.max(...punggungDiBawah) + rLuar);
    const tAman = batasi(t, 0, 1);
    const cy =
      tAman <= 0.5
        ? awal + (sentuh - awal) * (tAman / 0.5)
        : sentuh + (tenggelam - sentuh) * ((tAman - 0.5) / 0.5);
    if (t < 1) matahari = lukisMatahari(cx, cy, r, s.tebal, 41);
    jalurBenda = { x: cx, rLuar, atas: awal, bawah: tenggelam };
  }
  const kenaJalurBenda = (k: Kotak) =>
    jalurBenda !== null &&
    bertumpuk(perbesar(k, 6), {
      x: jalurBenda.x - jalurBenda.rLuar,
      y: jalurBenda.atas - jalurBenda.rLuar,
      lebar: jalurBenda.rLuar * 2,
      tinggi: jalurBenda.bawah - jalurBenda.atas + jalurBenda.rLuar * 2,
    });

  // Awan. Letaknya tidak bergantung pada t, supaya awan diam selama hitung mundur.
  const rAwan = acak(37);
  const lebarAwan =
    jenis === "pita" ? batasi(L * 0.14, 52, 130) : batasi(L * 0.12, 34, 76);
  const tinggiAwan = lebarAwan * 0.42;
  const yAwan: Rentang =
    jenis === "pita"
      ? [T * 0.32, T * 0.44]
      : [
          tinggiAwan / 2 + 4,
          Math.max(tinggiAwan / 2 + 4, atas - tinggiAwan * 0.2),
        ];
  const jumlahAwan = jenis === "pita" && L < 700 ? s.awan - 1 : s.awan;
  const awan: Awan[] = [];
  for (let i = 0; i < jumlahAwan; i++) {
    const a = cariTempat(
      rAwan,
      () =>
        lukisAwan(
          dalam(rAwan, [lebarAwan / 2 + 2, L - lebarAwan / 2 - 2]),
          dalam(rAwan, yAwan),
          lebarAwan * (0.85 + rAwan() * 0.3),
          rAwan,
        ),
      // Awan tidak pernah menutupi teks, benda langit, atau awan lain. Awan yang tidak kebagian tempat
      // tidak digambar.
      (c) =>
        !kenaTeks(c.kotak, teks) &&
        !kenaJalurBenda(c.kotak) &&
        !awan.some((b) => bertumpuk(perbesar(c.kotak, 8), b.kotak)),
      () => true,
    );
    if (a) awan.push(a);
  }
  const kenaAwan = (k: Kotak) =>
    awan.some((a) => bertumpuk(perbesar(k, 3), a.kotak));

  // Burung "v" pulpen, hanya di pita saat siang: satu kawanan kecil di kiri matahari.
  const burung: string[] = [];
  if (s.burung > 0 && !malam) {
    const rBurung = acak(71);
    const w = batasi(T * 0.03, 6, 10);
    const kawananPenuh: Titik[] = [
      [0, 0],
      [w * 2.6, -w * 0.9],
      [w * 1.4, w * 1.3],
    ];
    const susunan = kawananPenuh.slice(0, s.burung);
    const kawanan = cariTempat(
      rBurung,
      () => {
        const x = dalam(rBurung, [L * 0.08, L * 0.6]);
        const y = dalam(rBurung, [T * 0.3, T * 0.44]);
        const ukuran = susunan.map(() => w * (0.8 + rBurung() * 0.4));
        return {
          d: susunan.map(([dx, dy], i) =>
            lukisBurung(x + dx, y + dy, ukuran[i]),
          ),
          kotak: {
            x: x - w * 1.3,
            y: y - w * 1.9,
            lebar: w * 5.2,
            tinggi: w * 3.6,
          },
        };
      },
      (c) => !kenaTeks(c.kotak, teks),
      (c) =>
        !kenaJalurBenda(c.kotak) && !kenaAwan(c.kotak) && diAtasGunung(c.kotak),
    );
    if (kawanan) burung.push(...kawanan.d);
  }

  // Bintang: tanda bintang pensil yang bertambah satu per satu dari t 0,6 sampai 0,8. Letaknya tetap.
  const semuaBintang: Bintang[] = [];
  if (s.bintang > 0) {
    const rBintang = acak(91);
    const yBintang: Rentang =
      jenis === "pita" ? [T * 0.3, T * 0.54] : [6, Math.max(6, atas)];
    for (let i = 0; i < s.bintang; i++) {
      const b = cariTempat(
        rBintang,
        () =>
          lukisBintang(
            dalam(rBintang, [10, L - 10]),
            dalam(rBintang, yBintang),
            rBintang,
          ),
        (c) => !kenaTeks(kotakBintang(c), teks),
        (c) =>
          !kenaTeks(perbesar(kotakBintang(c), 4), teks) &&
          !kenaJalurBenda(kotakBintang(c)) &&
          !kenaAwan(kotakBintang(c)) &&
          diAtasGunung(kotakBintang(c)) &&
          semuaBintang.every((b) => Math.hypot(b.x - c.x, b.y - c.y) > 14),
      );
      if (b) semuaBintang.push(b);
    }
  }
  const bagianBintang = batasi(
    (t - BINTANG_MULAI) / (BINTANG_PENUH - BINTANG_MULAI),
    0,
    1,
  );
  const bintang = malam
    ? semuaBintang.slice(0, Math.ceil(semuaBintang.length * bagianBintang))
    : [];

  // Arsiran langit pulpen: petak-petak garis miring landai yang bertambah dari atas ke bawah mengikuti
  // t, seperti langit yang digelapkan pelan-pelan dengan pulpen. Letak petaknya tetap.
  let arsiranLangit: string | null = null;
  if (s.arsiranLangit) {
    const rArsir = acak(113);
    const lebarPetak = batasi(L / 7, 40, 56);
    const tinggiPetak = 22;
    // Arah garis 32° dari mendatar, dan geser antargaris tegak lurus arah itu.
    const [ax, ay] = [Math.cos(0.56), Math.sin(0.56)];
    const sela = 3.6;
    const petak: { urut: number; d: string }[] = [];
    for (let y = 0; y < atas + Z * 0.3; y += tinggiPetak) {
      for (let x = -lebarPetak * 0.3; x < L; x += lebarPetak) {
        const px = x + rArsir() * lebarPetak * 0.3;
        const py = y + rArsir() * tinggiPetak * 0.3;
        const jumlah = 4 + Math.floor(rArsir() * 3);
        const panjang = 16 + rArsir() * 10;
        const garis: [Titik, Titik][] = Array.from(
          { length: jumlah },
          (_, k) => {
            const p = panjang * (0.75 + rArsir() * 0.4);
            const mulai: Titik = [
              px + k * sela * ay + (rArsir() - 0.5) * 2,
              py + k * sela * ax + p * ay,
            ];
            return [mulai, [mulai[0] + p * ax, mulai[1] - p * ay]];
          },
        );
        const urut = py + rArsir() * tinggiPetak * 2.5;
        // Tebal garis arsiran 1,5 px.
        if (kenaTeks(kotakTitik(garis.flat(), 1.5), teks)) continue;
        petak.push({ urut, d: garis.map(([a, b]) => ruas(a, b)).join(" ") });
      }
    }
    petak.sort((a, b) => a.urut - b.urut);
    arsiranLangit = petak
      .slice(0, Math.round(petak.length * batasi(t, 0, 1)))
      .map((p) => p.d)
      .join(" ");
  }

  // Cakrawala: garis coretan tempat pemandangan menapak di kertas.
  const rCakrawala = acak(131);
  const cakrawala: Titik[] = [];
  for (let x = -4; x < L + 4; x += Math.max(8, L / 60)) {
    cakrawala.push([x, dasar + (rCakrawala() - 0.5) * s.getar * 0.8]);
  }
  cakrawala.push([L + 4, dasar]);

  return {
    lebar: L,
    tinggi: T,
    /** Letak garis cakrawala. Langit dan isinya dipotong di garis ini. */
    dasar,
    /** Tebal garis luar pensil. */
    tebal: s.tebal,
    punggung: punggung.map((p) => p.lapis),
    cakrawala: garisPatah(cakrawala),
    matahari,
    bulan,
    bintang,
    awan,
    burung,
    arsiranLangit,
  };
}

const kotakBintang = (b: Bintang): Kotak => ({
  x: b.x - b.r,
  y: b.y - b.r,
  lebar: b.r * 2,
  tinggi: b.r * 2,
});
