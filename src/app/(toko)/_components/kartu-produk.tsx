import Image from "next/image";
import Link from "next/link";

import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import type { KartuProduk as IsiKartuProduk } from "@/server/katalog";

/** Alamat Halaman Produk (T13). */
const alamatHalamanProduk = (id: string) => `/produk/${id}`;

// Kartu terangkat 2 px dengan Bayang naik saat di-hover. Varian hover Tailwind 4 hanya berlaku di
// perangkat hover:hover, dan transisinya dimatikan saat gerak dikurangi (DESIGN.md Elevation & Depth).
const GERAK_KARTU =
  "transition-[translate,box-shadow] duration-200 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5 hover:shadow-bayang-naik motion-reduce:transition-none";

/**
 * Foto sampul dalam bingkai radius 16 px. Produk tanpa foto mendapat petak pengganti berisi huruf awal
 * namanya. Fotonya hiasan, karena nama Produk tertulis di sebelahnya.
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
        "relative overflow-hidden rounded-[16px] bg-permukaan-2",
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
          className="absolute bottom-3 left-3 text-[32px] leading-none font-extrabold tracking-[-0.04em] text-tinta-redup"
        >
          {kartu.nama.slice(0, 1)}
        </span>
      )}
    </div>
  );
}

/** Harga jual di kartu: "Mulai Rp X" atau "Rp X" (PRD §3.8). */
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
        "font-extrabold tracking-[-0.02em]",
        kartu.habis && "text-tinta-redup",
        className,
      )}
    >
      {kartu.mulai && "Mulai "}
      <span className="whitespace-nowrap">{rupiah(kartu.harga)}</span>
    </p>
  );
}

// Harga normal tidak dibatasi maksimum (PRD §3.2), jadi angkanya boleh patah baris supaya kartu tidak
// melebar melewati layar 360 px.
function HargaNormal({ nilai }: { nilai: number }) {
  return (
    <s className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere] text-tinta-redup">
      <span className="sr-only">Harga normal </span>
      {rupiah(nilai)}
    </s>
  );
}

function LabelHemat({ persen }: { persen: number }) {
  return (
    <span className="rounded-full bg-persik px-2 py-1 text-xs font-extrabold whitespace-nowrap text-persik-teks">
      Hemat {persen}%
    </span>
  );
}

function LabelHabis() {
  return (
    <span className="rounded-full bg-permukaan-2 px-2 py-1 text-xs font-extrabold text-tinta-redup">
      Habis
    </span>
  );
}

/**
 * Baris banding: Harga normal Varian sumber harga yang dicoret, lalu label Hemat, atau label Habis bila
 * semua Varian aktif habis (DESIGN.md, keputusan teknis "Mulai Rp X").
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
        "flex h-full flex-col rounded-[20px] bg-permukaan p-3 shadow-bayang",
        GERAK_KARTU,
      )}
    >
      <FotoSampul kartu={kartu} className="h-28 lebar:h-[148px]" />
      <h3 className="mt-3 text-base leading-[1.25] font-extrabold tracking-[-0.01em] [overflow-wrap:anywhere]">
        {kartu.nama}
      </h3>
      <Harga kartu={kartu} className="mt-1 text-lg" />
      <Banding kartu={kartu} />
    </Link>
  );
}

/**
 * Kartu Produk Unggulan: satu anak tangga lebih besar dari kartu Produk, tanpa lencana tambahan. Di
 * layar lebar kartu ini menampilkan daftar Varian aktif beserta Harga normal yang dicoret dan label
 * "Hemat N%", atau label Habis (DESIGN.md "Cards / Containers", ▶ Keputusan 2026-11-11 #53).
 */
export function KartuProdukUnggulan({ kartu }: { kartu: IsiKartuProduk }) {
  return (
    <Link
      href={alamatHalamanProduk(kartu.id)}
      className={cn(
        "grid grid-cols-[112px_minmax(0,1fr)] gap-4 rounded-[24px] bg-permukaan p-4 shadow-bayang lebar:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)] lebar:items-center lebar:gap-6 lebar:p-6",
        GERAK_KARTU,
      )}
    >
      <FotoSampul
        kartu={kartu}
        className="min-h-[120px] self-stretch lebar:min-h-[180px]"
      />
      <div className="min-w-0">
        <h3 className="text-xl leading-[1.25] font-extrabold tracking-[-0.01em] [overflow-wrap:anywhere]">
          {kartu.nama}
        </h3>
        <Harga kartu={kartu} className="mt-2 text-[22px]" />
        <Banding kartu={kartu} />
      </div>
      <ul
        aria-label={`Varian ${kartu.nama}`}
        className="hidden min-w-0 content-center gap-3 self-stretch border-l border-garis pl-6 lebar:grid"
      >
        {kartu.varian.map((v) => (
          // Bila kolomnya sempit (mulai 900 px), harga turun ke baris berikutnya dan tetap rata kanan,
          // supaya nama Varian tidak terpotong per huruf.
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[15px] font-bold"
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
                  <span className="whitespace-nowrap">
                    {rupiah(v.hargaJual)}
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
