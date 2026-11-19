"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import {
  lukisPemandangan,
  type JenisPemandangan,
  type Kotak,
} from "./pelukis-pemandangan";

/** Waktu senja: satu angka, atau satu angka per mode tampilan. */
type WaktuSenja = number | { terang: number; gelap: number };

type Wadah = { lebar: number; tinggi: number; gelap: boolean };

/** Teks di atas pemandangan selalu pensil di atas kertas (kontras 13:1 terang, 12:1 gelap). */
const WARNA_TEKS = "var(--pensil)";

/** Garis pensil tidak ikut melar bila viewBox sempat diskalakan sebelum dilukis ulang. */
const GARIS = {
  vectorEffect: "non-scaling-stroke",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * Pemandangan gunung coretan tangan yang dilukis dengan kode sebagai SVG
 * (docs/design/acuan-coretan-tangan.md): punggung gunung bergaris pensil dengan arsiran, matahari atau
 * bulan sabit, awan, burung, dan bintang di atas kertas. Mengisi wadah induknya, yang harus `relative`
 * dan menentukan tingginya sendiri. Langitnya transparan, jadi titik kertas halaman tetap terlihat.
 * Semua warna berasal dari token, sehingga mode gelap ikut otomatis. Dilukis ulang saat ukuran wadah
 * atau mode tampilan berubah; mode menentukan waktu senja bila `t` diberikan per mode.
 *
 * Teks yang ditulis di atas langit dikirim sebagai `teks`, yaitu kotak-kotaknya di dalam wadah. Matahari,
 * bintang, awan, dan arsiran langit dijauhkan dari kotak itu, lalu `children` dipanggil dengan warna
 * teksnya. Selama `teks` masih null (belum diukur), pemandangan belum dilukis.
 */
export function PemandanganSenja({
  jenis,
  t,
  teks,
  children,
}: {
  jenis: JenisPemandangan;
  t: WaktuSenja;
  teks?: Kotak[] | null;
  children?: (warnaTeks: string) => ReactNode;
}) {
  const id = useId();
  const elemen = useRef<HTMLDivElement>(null);
  const [wadah, setWadah] = useState<Wadah | null>(null);

  useEffect(() => {
    const el = elemen.current;
    if (!el) return;
    const ukur = () =>
      setWadah({
        lebar: el.clientWidth,
        tinggi: el.clientHeight,
        gelap:
          getComputedStyle(document.documentElement).colorScheme === "dark",
      });

    // ResizeObserver juga memanggil ukur() sekali begitu wadah mulai diamati.
    const pengamatUkuran = new ResizeObserver(ukur);
    pengamatUkuran.observe(el);
    const pengamatMode = new MutationObserver(ukur);
    pengamatMode.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mode"],
    });
    const skemaPerangkat = matchMedia("(prefers-color-scheme: dark)");
    skemaPerangkat.addEventListener("change", ukur);

    return () => {
      pengamatUkuran.disconnect();
      pengamatMode.disconnect();
      skemaPerangkat.removeEventListener("change", ukur);
    };
  }, []);

  const lukisan =
    wadah && wadah.lebar > 0 && wadah.tinggi > 0 && teks !== null
      ? lukisPemandangan(jenis, {
          lebar: wadah.lebar,
          tinggi: wadah.tinggi,
          t: typeof t === "number" ? t : wadah.gelap ? t.gelap : t.terang,
          teks,
        })
      : null;

  return (
    <>
      <div
        ref={elemen}
        aria-hidden="true"
        data-pemandangan={jenis}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {lukisan && (
          <svg
            viewBox={`0 0 ${lukisan.lebar} ${lukisan.tinggi}`}
            preserveAspectRatio="none"
            fill="none"
            className="absolute inset-0 block size-full"
          >
            <defs>
              <clipPath id={`${id}langit`}>
                <rect width={lukisan.lebar} height={lukisan.dasar} />
              </clipPath>
              {lukisan.punggung.map((lapis, k) => (
                <clipPath key={k} id={`${id}lapis${k}`}>
                  <path d={lapis.d} />
                </clipPath>
              ))}
            </defs>

            {/* Langit: semua isinya dipotong di garis cakrawala, jadi matahari tenggelam di baliknya. */}
            <g clipPath={`url(#${id}langit)`}>
              {lukisan.arsiranLangit && (
                <path
                  data-arsiran-langit=""
                  d={lukisan.arsiranLangit}
                  stroke="var(--pulpen)"
                  strokeWidth={1.5}
                  opacity={0.32}
                  {...GARIS}
                />
              )}
              {lukisan.bintang.map((b, i) => (
                <path
                  key={i}
                  data-bintang=""
                  d={b.d}
                  stroke="var(--pensil)"
                  strokeWidth={1.6}
                  {...GARIS}
                />
              ))}
              {lukisan.matahari && (
                <g
                  data-matahari=""
                  transform={`translate(${lukisan.matahari.cx} ${lukisan.matahari.cy})`}
                >
                  {/* Sinar berputar pelan di sekitar pusat matahari, kecuali gerak dikurangi. */}
                  <g
                    className="motion-safe:animate-spin"
                    style={{ animationDuration: "48s" }}
                  >
                    <path
                      d={lukisan.matahari.sinar}
                      stroke="var(--pensil)"
                      strokeWidth={lukisan.tebal}
                      {...GARIS}
                    />
                  </g>
                  <path
                    d={lukisan.matahari.tubuh}
                    fill="var(--matahari)"
                    stroke="var(--pensil)"
                    strokeWidth={lukisan.tebal}
                    {...GARIS}
                  />
                </g>
              )}
              {lukisan.bulan && (
                <path
                  data-bulan=""
                  transform={`translate(${lukisan.bulan.cx} ${lukisan.bulan.cy})`}
                  d={lukisan.bulan.tubuh}
                  fill="var(--matahari)"
                  stroke="var(--pensil)"
                  strokeWidth={lukisan.tebal}
                  {...GARIS}
                />
              )}
              {lukisan.awan.map((a, i) => (
                <path
                  key={i}
                  data-awan=""
                  d={a.d}
                  fill="var(--permukaan)"
                  stroke="var(--pensil)"
                  strokeWidth={2}
                  {...GARIS}
                />
              ))}
              {lukisan.burung.map((d, i) => (
                <path
                  key={i}
                  data-burung=""
                  d={d}
                  stroke="var(--pulpen)"
                  strokeWidth={2}
                  {...GARIS}
                />
              ))}
            </g>

            {/* Punggung gunung dari lapis terjauh ke terdekat. */}
            {lukisan.punggung.map((lapis, k) => (
              <g key={k} data-lapis="">
                <path d={lapis.d} fill={lapis.isi} />
                <path
                  d={lapis.arsiran}
                  clipPath={`url(#${id}lapis${k})`}
                  stroke="var(--pensil)"
                  strokeWidth={1.2}
                  opacity={0.3}
                  {...GARIS}
                />
                {lapis.salju && (
                  <path
                    d={lapis.salju}
                    stroke="var(--pensil)"
                    strokeWidth={1.5}
                    strokeDasharray="3 4"
                    {...GARIS}
                  />
                )}
                <path
                  d={lapis.garisTipis}
                  stroke="var(--pensil)"
                  strokeWidth={1}
                  strokeDasharray="28 14"
                  strokeDashoffset={k * 11}
                  opacity={0.5}
                  {...GARIS}
                />
                <path
                  d={lapis.garis}
                  stroke="var(--pensil)"
                  strokeWidth={lukisan.tebal}
                  {...GARIS}
                />
              </g>
            ))}
            <path
              data-cakrawala=""
              d={lukisan.cakrawala}
              stroke="var(--pensil)"
              strokeWidth={lukisan.tebal}
              {...GARIS}
            />
          </svg>
        )}
      </div>
      {children?.(WARNA_TEKS)}
    </>
  );
}
