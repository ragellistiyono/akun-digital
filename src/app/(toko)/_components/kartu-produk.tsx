import Image from "next/image";
import Link from "next/link";

import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import type { KartuProduk as IsiKartuProduk } from "@/server/katalog";

import { teksHarga } from "./teks-harga";

/** Alamat Halaman Produk (T13). */
const alamatHalamanProduk = (id: string) => `/produk/${id}`;

// Kartu terangkat seperti kertas yang diangkat saat di-hover: bergeser 2 px ke kiri atas dan bayangannya
// memanjang. Varian hover Tailwind 4 hanya berlaku di perangkat hover:hover, dan transisinya mati saat gerak
// dikurangi (DESIGN.md Elevation).
const GERAK_KARTU =
  "transition-[translate,box-shadow] duration-100 ease-out hover:-translate-x-0.5 hover:-translate-y-0.5 motion-reduce:transition-none";

/**
 * Foto sampul dalam bingkai coretan bergaris pensil 2 px. Produk tanpa foto mendapat petak `kertas-lama`
 * berisi huruf awal namanya. Fotonya hiasan, karena nama Produk tertulis di sebelahnya.
 */
function FotoSampul({
  kartu,
  className,
}: {
  kartu: IsiKartuProduk;
  className: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-coret-alt border-2 border-pensil bg-kertas-lama",
        kartu.habis && "opacity-55 grayscale-85",
        className,
      )}
    >
      {kartu.fotoSampul ? (
        <Image
          unoptimized
          src={kartu.fotoSampul}
          alt=""
          width={240}
          height={180}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center font-spidol text-[40px] leading-none font-bold text-pensil-redup"
        >
          {kartu.nama.slice(0, 1)}
        </span>
      )}
    </div>
  );
}

/**
 * Harga jual di kartu: "Mulai Rp X" atau "Rp X" (PRD §3.8), ditulis spidol tebal. Produk gratis menampilkan "Gratis"
 * tanpa kata "Mulai" (PRD §16.4).
 */
function Harga({
  kartu,
  className,
}: {
  kartu: IsiKartuProduk;
  className: string;
}) {
  return (
    <p
      className={cn(
        "font-spidol font-bold",
        kartu.habis && "text-pensil-redup",
        className,
      )}
    >
      {kartu.mulai && (
        <span className="font-tangan text-[16px] font-normal">Mulai </span>
      )}
      <span className="whitespace-nowrap">
        {teksHarga({ hargaJual: kartu.harga, gratis: kartu.gratis })}
      </span>
    </p>
  );
}

// Harga normal tidak dibatasi maksimum (PRD §3.2), jadi angkanya boleh patah baris supaya kartu tidak
// melebar melewati layar 360 px. Ketiga label ini dipakai juga di Halaman Produk.
export function HargaNormal({
  nilai,
  className,
}: {
  nilai: number;
  className?: string;
}) {
  return (
    <s
      className={cn(
        "min-w-0 text-[15px] decoration-spidol decoration-2 [overflow-wrap:anywhere] text-pensil-redup",
        className,
      )}
    >
      <span className="sr-only">Harga normal </span>
      {rupiah(nilai)}
    </s>
  );
}

// Catatan post-it kecil yang sedikit miring (1°, 2° di layar lebar). Garisnya `teks-postit`, yang sama
// dengan `pensil` di mode terang dan tetap terbaca saat label ini menempel di kartu Varian terpilih yang
// juga post-it.
export function LabelHemat({ persen }: { persen: number }) {
  return (
    <span className="inline-block -rotate-1 rounded-coret border-2 border-teks-postit bg-postit px-2 py-0.5 font-spidol text-[15px] leading-[1.3] font-bold whitespace-nowrap text-teks-postit shadow-coret-kecil lebar:-rotate-2">
      Hemat {persen}%
    </span>
  );
}

// Cap "Habis": garis putus `pensil-redup` dan huruf spidol, miring seperti stempel (1°, 2° di layar lebar).
export function LabelHabis() {
  return (
    <span className="inline-block rotate-1 rounded-coret border-2 border-dashed border-pensil-redup px-2 py-0.5 font-spidol text-[15px] leading-[1.3] font-bold text-pensil-redup lebar:rotate-2">
      Habis
    </span>
  );
}

/**
 * Baris banding: Harga normal Varian sumber harga yang dicoret, lalu label Hemat, atau label Habis bila
 * semua Varian aktif habis (DESIGN.md, keputusan teknis "Mulai Rp X"). Produk gratis tidak punya Hemat (PRD §16.4).
 */
function Banding({ kartu }: { kartu: IsiKartuProduk }) {
  const hemat = kartu.habis ? null : kartu.persenHemat;
  if (kartu.hargaNormal === null && hemat === null && !kartu.habis) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {kartu.hargaNormal !== null && <HargaNormal nilai={kartu.hargaNormal} />}
      {hemat !== null && <LabelHemat persen={hemat} />}
      {kartu.habis && <LabelHabis />}
    </div>
  );
}

/** Kartu Produk di grid katalog. Seluruh kartu menaut ke Halaman Produk, tanpa angka stok gabungan. */
export function KartuProduk({ kartu }: { kartu: IsiKartuProduk }) {
  return (
    <Link
      href={alamatHalamanProduk(kartu.id)}
      className={cn(
        "kartu flex h-full flex-col p-3 hover:shadow-coret",
        GERAK_KARTU,
      )}
    >
      <FotoSampul kartu={kartu} className="h-28 lebar:h-[148px]" />
      <h3 className="mt-3 text-[19px] leading-[1.2] [overflow-wrap:anywhere] lebar:text-[20px]">
        {kartu.nama}
      </h3>
      <Harga kartu={kartu} className="mt-1 text-[20px] leading-[1.2]" />
      <Banding kartu={kartu} />
    </Link>
  );
}

/**
 * Kartu Produk Unggulan: kartu tegas yang "dipaku" di papan, satu anak tangga lebih besar dari kartu Produk,
 * tanpa lencana tambahan. Di layar lebar kartu ini menampilkan daftar Varian aktif beserta Harga normal yang
 * dicoret dan label "Hemat N%", atau label Habis (DESIGN.md "Cards / Containers", ▶ Keputusan 2026-11-11
 * #53 dan 2026-11-12 #87). Varian Produk gratis menampilkan Harga normal yang dicoret lalu "Gratis", tanpa Hemat
 * (DESIGN.md ▶ Keputusan 2026-11-22).
 */
export function KartuProdukUnggulan({ kartu }: { kartu: IsiKartuProduk }) {
  return (
    <Link
      href={alamatHalamanProduk(kartu.id)}
      className={cn(
        "kartu kartu-tegas paku relative grid grid-cols-[112px_minmax(0,1fr)] gap-4 p-4 hover:shadow-coret-sedang lebar:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)] lebar:items-center lebar:gap-6 lebar:p-6",
        GERAK_KARTU,
      )}
    >
      <FotoSampul
        kartu={kartu}
        className="min-h-[120px] self-stretch lebar:min-h-[180px]"
      />
      <div className="min-w-0">
        <h3 className="text-[22px] leading-[1.2] [overflow-wrap:anywhere] lebar:text-[26px]">
          {kartu.nama}
        </h3>
        <Harga kartu={kartu} className="mt-2 text-[24px] leading-[1.2]" />
        <Banding kartu={kartu} />
      </div>
      <ul
        aria-label={`Varian ${kartu.nama}`}
        className="hidden min-w-0 content-center divide-y-2 divide-dashed divide-pensil self-stretch border-l-2 border-dashed border-pensil pl-6 lebar:grid"
      >
        {kartu.varian.map((v) => (
          // Bila kolomnya sempit (mulai 900 px), harga turun ke baris berikutnya dan tetap rata kanan,
          // supaya nama Varian tidak terpotong per huruf.
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 text-[17px] first:pt-0 last:pb-0"
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">{v.nama}</span>
            <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              {v.habis ? (
                <LabelHabis />
              ) : (
                <>
                  {v.hargaNormal !== null && (
                    <HargaNormal nilai={v.hargaNormal} />
                  )}
                  {v.persenHemat !== null && (
                    <LabelHemat persen={v.persenHemat} />
                  )}
                  <span className="font-spidol text-[19px] font-bold whitespace-nowrap">
                    {teksHarga({
                      hargaJual: v.hargaJual,
                      gratis: kartu.gratis,
                    })}
                  </span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
