"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { angkaRupiah, rupiahBertanda } from "@/lib/rupiah";
import { cn } from "@/lib/utils";

// Grafik per kelompok periode Laporan keuangan (PRD §14.7), digambar sebagai SVG tanpa pustaka grafik, mengikuti
// DESIGN.md "Grafik Laporan keuangan": garis dan batang lurus, sumbu dan garis bantu dari token `pensil`, catatan
// nilai bergaya Toast saat batang atau titik diketuk, disorot, atau difokus, gulir di dalam kartu bila kelompoknya
// lebih lebar dari layar, dan tabel tersembunyi untuk pembaca layar. Semua warna berupa token, jadi mode gelap
// ikut sendiri.

type Kelompok = { label: string; sumbu: string };

/**
 * Satu seri nilai, satu nilai per kelompok. Gaya "utuh" untuk batang dan garis utuh `pulpen`, "putus" untuk garis
 * putus-putus `pensil`, supaya dua garis terbaca tanpa warna.
 */
type Seri = { nama: string; nilai: number[]; gaya: "utuh" | "putus" };

/** Lebar sumbu tegak yang diam di kiri, dan tinggi bidang gambar beserta ruang di atas dan bawahnya, dalam piksel. */
const LEBAR_SUMBU = 76;
/** Ruang di kiri dan kanan bidang grafik, supaya label sumbu mendatar di ujung tidak terpotong. */
const PINGGIR = 24;
const ATAS = 16;
const TINGGI_BIDANG = 200;
const BAWAH = 36;
const TINGGI = ATAS + TINGGI_BIDANG + BAWAH;
/** Lebar paling sempit satu kelompok, supaya batang tetap mudah diketuk. Di bawahnya grafik bergulir. */
const LEBAR_KELOMPOK_MIN = 28;
/** Ruang satu label sumbu mendatar. Bila kelompoknya lebih sempit, hanya sebagian kelompok yang diberi label. */
const LEBAR_LABEL_SUMBU = 64;
const LEBAR_BATANG_MAKS = 48;
const UKURAN_HURUF = 14;

const formatSingkat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
});

/** Rupiah singkat untuk label sumbu, misalnya "Rp 1,2 jt", "Rp 450 rb", "Rp 0", atau "−Rp 12,5 rb". */
function rupiahSingkat(nilai: number) {
  const mutlak = Math.abs(nilai);
  const tanda = nilai < 0 ? "−" : "";
  const teks =
    mutlak >= 1e9
      ? `${formatSingkat.format(mutlak / 1e9)} M`
      : mutlak >= 1e6
        ? `${formatSingkat.format(mutlak / 1e6)} jt`
        : mutlak >= 1e3
          ? `${formatSingkat.format(mutlak / 1e3)} rb`
          : formatSingkat.format(mutlak);
  return `${tanda}Rp ${teks}`;
}

/**
 * Batas bawah, batas atas, dan garis bantu sumbu tegak dengan langkah 1, 2, 2,5, atau 5 kali pangkat sepuluh.
 * Garis nol selalu ada, nilai negatif mendapat ruang di bawahnya, dan jumlah bulat (Pesanan) melangkah paling
 * sedikit 1.
 */
function skala(semuaNilai: number[], bulat: boolean) {
  const terkecil = Math.min(0, ...semuaNilai);
  const terbesar = Math.max(0, ...semuaNilai);
  const kasar = (terbesar - terkecil) / 4 || 1;
  const pangkat = 10 ** Math.floor(Math.log10(kasar));
  const langkah = Math.max(
    bulat ? 1 : 0,
    ([1, 2, 2.5, 5, 10].find((k) => k * pangkat >= kasar) ?? 10) * pangkat,
  );
  const bawah = Math.floor(terkecil / langkah) * langkah;
  const atas = Math.max(Math.ceil(terbesar / langkah) * langkah, langkah);
  const garis: number[] = [];
  for (let n = bawah; n <= atas + langkah / 2; n += langkah) garis.push(n);
  return { bawah, atas, garis };
}

/** Lebar wadah gulir bidang grafik, supaya grafik mengisi kartu di layar lebar. Nol sebelum terukur. */
function useLebarWadah() {
  const ref = useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = useState(0);
  useEffect(() => {
    const wadah = ref.current;
    if (wadah === null) return;
    const amati = new ResizeObserver(([isi]) =>
      setLebar(Math.floor(isi.contentRect.width)),
    );
    amati.observe(wadah);
    return () => amati.disconnect();
  }, []);
  return [ref, lebar] as const;
}

/**
 * Grafik batang (satu seri) atau garis (satu atau lebih seri) per kelompok periode. Nilai rupiah ditulis
 * "Rp 65.000" atau "−Rp 10.000", dan jumlah ditulis sebagai angka.
 *
 * Sumbu tegak diam di kiri, sedangkan bidang grafik bergulir ke samping di dalam kartu bila kelompoknya tidak muat.
 * Catatan nilai tampil di baris tetap di atas bidang grafik, supaya tidak terpotong tepi kartu di ponsel.
 */
export function GrafikPeriode({
  judul,
  jenis,
  satuan,
  kelompok,
  seri,
}: {
  judul: string;
  jenis: "batang" | "garis";
  satuan: "rupiah" | "jumlah";
  kelompok: Kelompok[];
  seri: Seri[];
}) {
  const idJudul = useId();
  const [refWadah, lebarWadah] = useLebarWadah();
  const [aktif, setAktif] = useState<{ kelompok: number; seri: number } | null>(
    null,
  );

  const n = kelompok.length;
  const lebarKelompok = Math.max(
    LEBAR_KELOMPOK_MIN,
    (lebarWadah - 2 * PINGGIR) / Math.max(n, 1),
  );
  const lebar = 2 * PINGGIR + n * lebarKelompok;
  // Label sumbu mendatar setiap `jarakLabel` kelompok, dihitung dari kelompok terakhir supaya yang terbaru berlabel.
  const jarakLabel = Math.ceil(LEBAR_LABEL_SUMBU / lebarKelompok);
  const { bawah, atas, garis } = skala(
    seri.flatMap((s) => s.nilai),
    satuan === "jumlah",
  );
  const y = (nilai: number) =>
    ATAS + ((atas - nilai) / (atas - bawah)) * TINGGI_BIDANG;
  const tengah = (i: number) => PINGGIR + (i + 0.5) * lebarKelompok;

  const nilaiTeks = (nilai: number) =>
    satuan === "rupiah" ? rupiahBertanda(nilai) : angkaRupiah(nilai);
  const labelSumbuTegak = (nilai: number) =>
    satuan === "rupiah" ? rupiahSingkat(nilai) : angkaRupiah(nilai);
  /** Isi catatan nilai: label kelompok, nama seri bila lebih dari satu, lalu nilainya. */
  const catatan = (k: number, s: number) =>
    seri.length > 1
      ? `${kelompok[k].label} · ${seri[s].nama} ${nilaiTeks(seri[s].nilai[k])}`
      : `${kelompok[k].label} · ${nilaiTeks(seri[s].nilai[k])}`;

  /** Perilaku sasaran ketuk: sorot dengan tetikus, ketuk di layar sentuh, atau fokus dengan papan ketik. */
  const sasaran = (k: number, s: number) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": catatan(k, s),
    className: "cursor-pointer",
    onPointerEnter: () => setAktif({ kelompok: k, seri: s }),
    onPointerLeave: (e: PointerEvent) => {
      // Di layar sentuh, pointerleave datang tepat sesudah ketukan, jadi catatan hanya ditutup untuk tetikus.
      if (e.pointerType === "mouse") setAktif(null);
    },
    onClick: () => setAktif({ kelompok: k, seri: s }),
    onFocus: () => setAktif({ kelompok: k, seri: s }),
    onBlur: () => setAktif(null),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape") setAktif(null);
    },
  });

  return (
    <figure aria-labelledby={idJudul} className="kartu min-w-0 p-4 sm:p-6">
      <h3 id={idJudul} className="text-[24px] leading-[1.2]">
        {judul}
      </h3>
      <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[15px] text-pensil-redup">
        {seri.map((s) => (
          <li key={s.nama} className="flex items-center gap-2">
            <svg aria-hidden="true" width="28" height="14" className="shrink-0">
              {jenis === "batang" ? (
                <rect
                  x="7"
                  y="1"
                  width="14"
                  height="12"
                  strokeWidth="2"
                  className="fill-pulpen stroke-pensil"
                />
              ) : (
                <line
                  x1="0"
                  y1="7"
                  x2="28"
                  y2="7"
                  strokeWidth="3"
                  strokeDasharray={s.gaya === "putus" ? "6 4" : undefined}
                  className={
                    s.gaya === "putus" ? "stroke-pensil" : "stroke-pulpen"
                  }
                />
              )}
            </svg>
            {s.nama}
          </li>
        ))}
      </ul>

      {/* Catatan nilai bergaya Toast: latar post-it, garis 2 px pensil, tanpa rotasi. Barisnya selalu disediakan,
          supaya grafik tidak bergeser saat catatan muncul. */}
      <div role="status" aria-live="polite" className="mt-3 min-h-10">
        {aktif !== null && (
          <p className="inline-block max-w-full rounded-coret border-2 border-pensil bg-postit px-3 py-1 text-[15px] text-teks-postit tabular-nums">
            {catatan(aktif.kelompok, aktif.seri)}
          </p>
        )}
      </div>

      <div className="mt-2 flex">
        {/* Sumbu tegak yang diam saat bidang grafik digulir. */}
        <svg
          aria-hidden="true"
          width={LEBAR_SUMBU}
          height={TINGGI}
          className="block shrink-0"
        >
          {garis.map((nilai) => (
            <text
              key={nilai}
              x={LEBAR_SUMBU - 8}
              y={y(nilai)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={UKURAN_HURUF}
              className="fill-pensil-redup tabular-nums"
            >
              {labelSumbuTegak(nilai)}
            </text>
          ))}
        </svg>

        <div ref={refWadah} className="min-w-0 flex-1 overflow-x-auto">
          <svg
            role="group"
            aria-label={`Grafik ${judul}`}
            width={lebar}
            height={TINGGI}
            viewBox={`0 0 ${lebar} ${TINGGI}`}
            className="block"
          >
            {/* Garis bantu mendatar 1 px putus-putus. Garis nol menjadi garis dasar 2 px. */}
            {garis.map((nilai) => (
              <line
                key={nilai}
                aria-hidden="true"
                x1={0}
                x2={lebar}
                y1={y(nilai)}
                y2={y(nilai)}
                strokeWidth={nilai === 0 ? 2 : 1}
                strokeDasharray={nilai === 0 ? undefined : "4 4"}
                className={
                  nilai === 0 ? "stroke-pensil" : "stroke-pensil-redup"
                }
              />
            ))}

            {/* Label sumbu mendatar. Setiap kelompok tetap punya tempat, juga yang bernilai 0. */}
            {kelompok.map(
              (k, i) =>
                (n - 1 - i) % jarakLabel === 0 && (
                  <text
                    key={k.label}
                    aria-hidden="true"
                    x={tengah(i)}
                    y={ATAS + TINGGI_BIDANG + 24}
                    textAnchor="middle"
                    fontSize={UKURAN_HURUF}
                    className="fill-pensil-redup"
                  >
                    {k.sumbu}
                  </text>
                ),
            )}

            {jenis === "batang"
              ? kelompok.map((k, i) => {
                  const nilai = seri[0].nilai[i];
                  const lebarBatang = Math.min(
                    LEBAR_BATANG_MAKS,
                    lebarKelompok * 0.6,
                  );
                  return (
                    <g key={k.label}>
                      {/* Batang bernilai 0 tidak digambar. */}
                      {nilai !== 0 && (
                        <rect
                          aria-hidden="true"
                          x={tengah(i) - lebarBatang / 2}
                          y={Math.min(y(nilai), y(0))}
                          width={lebarBatang}
                          height={Math.abs(y(0) - y(nilai))}
                          strokeWidth={2}
                          className={cn(
                            "stroke-pensil",
                            aktif?.kelompok === i
                              ? "fill-postit"
                              : "fill-pulpen",
                          )}
                        />
                      )}
                      {/* Sasaran ketuk selebar dan setinggi kelompoknya. */}
                      <rect
                        {...sasaran(i, 0)}
                        x={PINGGIR + i * lebarKelompok}
                        y={ATAS}
                        width={lebarKelompok}
                        height={TINGGI_BIDANG}
                        fill="transparent"
                      />
                    </g>
                  );
                })
              : seri.map((s, j) => {
                  const putus = s.gaya === "putus";
                  return (
                    <g key={s.nama}>
                      <polyline
                        aria-hidden="true"
                        points={s.nilai
                          .map((nilai, i) => `${tengah(i)},${y(nilai)}`)
                          .join(" ")}
                        fill="none"
                        strokeWidth={3}
                        strokeLinejoin="round"
                        strokeDasharray={putus ? "8 6" : undefined}
                        className={putus ? "stroke-pensil" : "stroke-pulpen"}
                      />
                      {s.nilai.map((nilai, i) => (
                        <g key={kelompok[i].label}>
                          {/* Penanda bulat 6 px, membesar saat titiknya aktif. */}
                          <circle
                            aria-hidden="true"
                            cx={tengah(i)}
                            cy={y(nilai)}
                            r={
                              aktif?.kelompok === i && aktif.seri === j ? 5 : 3
                            }
                            className={putus ? "fill-pensil" : "fill-pulpen"}
                          />
                          <circle
                            {...sasaran(i, j)}
                            cx={tengah(i)}
                            cy={y(nilai)}
                            r={12}
                            fill="transparent"
                          />
                        </g>
                      ))}
                    </g>
                  );
                })}
          </svg>
        </div>
      </div>

      {/* Ringkasan untuk pembaca layar: semua kelompok dan nilainya. */}
      <table className="sr-only">
        <caption>Nilai grafik {judul}</caption>
        <thead>
          <tr>
            <th scope="col">Kelompok</th>
            {seri.map((s) => (
              <th key={s.nama} scope="col">
                {s.nama}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kelompok.map((k, i) => (
            <tr key={k.label}>
              <th scope="row">{k.label}</th>
              {seri.map((s) => (
                <td key={s.nama}>{nilaiTeks(s.nilai[i])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
