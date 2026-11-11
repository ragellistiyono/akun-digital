"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  lukisPemandangan,
  type Henti as HentiGradien,
  type JenisPemandangan,
} from "./pelukis-pemandangan";

/** Waktu senja: satu angka, atau satu angka per mode tampilan. */
type WaktuSenja = number | { terang: number; gelap: number };

type Wadah = {
  lebar: number;
  tinggi: number;
  gelap: boolean;
  langit: string;
  tanah: string;
  butir: string;
};

let teksturButir: string | null = null;

// Tekstur derau 96 px. Dibuat di klien supaya hasil SSR dan hidrasi tetap cocok (DESIGN.md).
function buatTeksturButir() {
  if (teksturButir) return teksturButir;
  const kanvas = document.createElement("canvas");
  kanvas.width = kanvas.height = 96;
  const konteks = kanvas.getContext("2d");
  if (!konteks) return "";
  const gambar = konteks.createImageData(96, 96);
  for (let i = 0; i < gambar.data.length; i += 4) {
    const v = 110 + Math.random() * 145;
    gambar.data[i] = gambar.data[i + 1] = gambar.data[i + 2] = v;
    gambar.data[i + 3] = 255;
  }
  konteks.putImageData(gambar, 0, 0);
  return (teksturButir = kanvas.toDataURL());
}

/**
 * Pemandangan senja yang dilukis dengan kode sebagai SVG (DESIGN.md, "Pemandangan senja").
 * Mengisi wadah induknya, yang harus `relative` dan menentukan tingginya sendiri.
 * Dilukis ulang saat ukuran wadah atau mode tampilan berubah.
 */
export function PemandanganSenja({
  jenis,
  t,
}: {
  jenis: JenisPemandangan;
  t: WaktuSenja;
}) {
  const id = useId();
  const elemen = useRef<HTMLDivElement>(null);
  const [wadah, setWadah] = useState<Wadah | null>(null);

  useEffect(() => {
    const el = elemen.current;
    if (!el) return;
    const ukur = () => {
      const gaya = getComputedStyle(document.documentElement);
      setWadah({
        lebar: el.clientWidth,
        tinggi: el.clientHeight,
        gelap: gaya.colorScheme === "dark",
        langit: gaya.getPropertyValue("--langit").trim(),
        tanah: gaya.getPropertyValue("--tanah").trim(),
        butir: buatTeksturButir(),
      });
    };

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
    wadah && wadah.lebar > 0 && wadah.tinggi > 0
      ? lukisPemandangan(jenis, {
          lebar: wadah.lebar,
          tinggi: wadah.tinggi,
          t: typeof t === "number" ? t : wadah.gelap ? t.gelap : t.terang,
          atas: wadah.langit,
          kabutKe: wadah.tanah,
        })
      : null;

  return (
    <div
      ref={elemen}
      aria-hidden="true"
      data-pemandangan={jenis}
      className="absolute inset-0 overflow-hidden"
    >
      {wadah && lukisan && (
        <>
          <svg
            viewBox={`0 0 ${lukisan.lebar} ${lukisan.tinggi}`}
            preserveAspectRatio="none"
            className="absolute inset-0 block size-full"
          >
            <defs>
              <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
                <Henti henti={lukisan.langit} />
              </linearGradient>
              <radialGradient id={`${id}u`} cx=".5" cy=".5" r=".5">
                <Henti henti={lukisan.cahayaUfuk.henti} />
              </radialGradient>
              {lukisan.matahari && (
                <radialGradient id={`${id}g`}>
                  <Henti henti={lukisan.matahari.pendar.henti} />
                </radialGradient>
              )}
              <filter
                id={`${id}a`}
                x="-20%"
                y="-200%"
                width="140%"
                height="500%"
              >
                <feGaussianBlur stdDeviation={lukisan.awan.kabur} />
              </filter>
              {lukisan.punggung.map((lapis, k) => (
                <linearGradient
                  key={k}
                  id={`${id}r${k}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <Henti henti={lapis.henti} />
                </linearGradient>
              ))}
              {lukisan.punggung.map(
                (lapis, k) =>
                  lapis.kabur !== null && (
                    <filter key={k} id={`${id}h${k}`}>
                      <feGaussianBlur stdDeviation={lapis.kabur} />
                    </filter>
                  ),
              )}
              <linearGradient id={`${id}k`} x1="0" y1="0" x2="0" y2="1">
                <Henti henti={lukisan.kabut.henti} />
              </linearGradient>
            </defs>
            <rect
              width={lukisan.lebar}
              height={lukisan.tinggi}
              fill={`url(#${id}l)`}
            />
            {lukisan.bintang.map((b, i) => (
              <circle
                key={i}
                cx={b.cx}
                cy={b.cy}
                r={b.r}
                fill={b.warna}
                opacity={b.opasitas}
              />
            ))}
            <ellipse
              cx={lukisan.cahayaUfuk.cx}
              cy={lukisan.cahayaUfuk.cy}
              rx={lukisan.cahayaUfuk.rx}
              ry={lukisan.cahayaUfuk.ry}
              fill={`url(#${id}u)`}
            />
            {lukisan.awan.elips.map((a, i) => (
              <ellipse
                key={i}
                cx={a.cx}
                cy={a.cy}
                rx={a.rx}
                ry={a.ry}
                fill={a.warna}
                opacity={a.opasitas}
                filter={`url(#${id}a)`}
              />
            ))}
            {lukisan.matahari && (
              <>
                <circle
                  cx={lukisan.matahari.cx}
                  cy={lukisan.matahari.cy}
                  r={lukisan.matahari.pendar.r}
                  fill={`url(#${id}g)`}
                />
                <circle
                  cx={lukisan.matahari.cx}
                  cy={lukisan.matahari.cy}
                  r={lukisan.matahari.r}
                  fill={lukisan.matahari.warna}
                  opacity={lukisan.matahari.opasitas}
                />
              </>
            )}
            {lukisan.punggung.map((lapis, k) => (
              <path
                key={k}
                d={lapis.d}
                fill={`url(#${id}r${k})`}
                filter={lapis.kabur !== null ? `url(#${id}h${k})` : undefined}
              />
            ))}
            <rect
              y={lukisan.kabut.y}
              width={lukisan.lebar}
              height={lukisan.kabut.tinggi}
              fill={`url(#${id}k)`}
            />
          </svg>
          <div
            className="pointer-events-none absolute inset-0 mix-blend-soft-light"
            style={{
              backgroundImage: `url(${wadah.butir})`,
              opacity: lukisan.butir,
            }}
          />
        </>
      )}
    </div>
  );
}

function Henti({ henti }: { henti: HentiGradien[] }) {
  return henti.map((h) => (
    <stop
      key={h.offset}
      offset={h.offset}
      stopColor={h.warna}
      stopOpacity={h.opasitas}
    />
  ));
}
