import { ChevronRight, TriangleAlert } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";

import { rupiah } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { jumlahPesananBermasalah } from "@/server/daftar-pesanan";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { angkaRingkasan } from "@/server/ringkasan";
import { daftarStokMenipis } from "@/server/stok-menipis";

import { DaftarStokMenipis } from "./_components/daftar-stok-menipis";

const KELAS_JUDUL_PANEL =
  "text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]";

const KELAS_KARTU =
  "flex flex-col gap-2 rounded-[20px] bg-permukaan p-4 shadow-bayang";

const KELAS_ANGKA =
  "text-[28px] leading-none font-extrabold tracking-[-0.02em] tabular-nums";

const KELAS_KETERANGAN = "text-[13px] text-tinta-redup";

/** Daftar Pesanan yang sudah disaring ke status Bermasalah (PRD §9.2 ▶ Keputusan 2026-11-17, §9.5). */
const ALAMAT_PESANAN_BERMASALAH = "/admin/pesanan?status=Bermasalah";

/** Kartu angka dengan dua nilai, hari ini dan bulan ini, beserta keterangan asal angkanya. */
function KartuHariIniBulanIni({
  id,
  judul,
  hariIni,
  bulanIni,
  keterangan,
}: {
  id: string;
  judul: string;
  hariIni: string;
  bulanIni: string;
  keterangan: ReactNode;
}) {
  return (
    <article aria-labelledby={id} className={KELAS_KARTU}>
      <h2 id={id} className="text-sm font-bold">
        {judul}
      </h2>
      <dl className="grid grid-cols-2 gap-4">
        {[
          ["Hari ini", hariIni],
          ["Bulan ini", bulanIni],
        ].map(([label, nilai]) => (
          <div key={label} className="flex min-w-0 flex-col-reverse gap-2">
            <dt className={KELAS_KETERANGAN}>{label}</dt>
            <dd className={`${KELAS_ANGKA} break-words`}>{nilai}</dd>
          </div>
        ))}
      </dl>
      <p className={KELAS_KETERANGAN}>{keterangan}</p>
    </article>
  );
}

// Halaman depan dasbor admin (PRD §9.2): kartu angka, lalu daftar Stok menipis di bawahnya (PRD §9.4). Kartu
// Member aktif ditambahkan oleh tiketnya sendiri. Ringkasan hanya berupa angka, tanpa grafik.
export default async function HalamanRingkasan() {
  await wajibSesiAdmin(await headers());
  const { ambangStokMenipis } = await bacaPengaturanToko();
  const [angka, bermasalah, stokMenipis] = await Promise.all([
    angkaRingkasan(),
    jumlahPesananBermasalah(),
    daftarStokMenipis({ ambang: ambangStokMenipis }),
  ]);

  return (
    <>
      <h1>Ringkasan</h1>

      <div className="mt-6 grid max-w-[1120px] gap-4 sm:grid-cols-2 lebar:grid-cols-3">
        <KartuHariIniBulanIni
          id="kartu-pendapatan"
          judul="Pendapatan"
          hariIni={rupiah(angka.hariIni.pendapatan.pendapatan)}
          bulanIni={rupiah(angka.bulanIni.pendapatan.pendapatan)}
          keterangan="Jumlah Total bayar Pesanan Selesai menurut waktu pembayaran (WIB), termasuk Kode unik. Pesanan Bermasalah dan Dana Dikembalikan tidak dihitung."
        />

        <KartuHariIniBulanIni
          id="kartu-pesanan-selesai"
          judul="Pesanan Selesai"
          hariIni={String(angka.hariIni.pesananSelesai.jumlah)}
          bulanIni={String(angka.bulanIni.pesananSelesai.jumlah)}
          keterangan="Dihitung menurut waktu pembayaran (WIB), bukan waktu Pesanan dibuat."
        />

        <article aria-labelledby="kartu-pesanan-bermasalah">
          <Link
            href={ALAMAT_PESANAN_BERMASALAH}
            className="flex h-full flex-col gap-2 rounded-[20px] border-[1.5px] border-transparent bg-st-masalah-bg p-4 text-st-masalah shadow-bayang hover:border-monogram"
          >
            <h2
              id="kartu-pesanan-bermasalah"
              className="flex items-center gap-2 text-sm font-bold"
            >
              <TriangleAlert aria-hidden="true" className="size-6 shrink-0" />
              Pesanan Bermasalah
            </h2>
            <p className={KELAS_ANGKA}>{bermasalah}</p>
            <p className="mt-auto flex items-center gap-1 text-[13px] font-bold">
              Perlu tindakan. Buka daftar Pesanan Bermasalah
              <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
            </p>
          </Link>
        </article>

        <article aria-labelledby="kartu-stok-menipis" className={KELAS_KARTU}>
          <h2 id="kartu-stok-menipis" className="text-sm font-bold">
            Varian stok menipis
          </h2>
          <p className={KELAS_ANGKA}>{stokMenipis.varian.length}</p>
          <p className={KELAS_KETERANGAN}>
            Varian aktif dengan Stok Varian {stokMenipis.ambang} atau kurang,
            sesuai Ambang stok menipis di Pengaturan toko.
          </p>
        </article>
      </div>

      <section
        aria-labelledby="judul-stok-menipis"
        className="mt-8 max-w-[720px]"
      >
        <h2 id="judul-stok-menipis" className={KELAS_JUDUL_PANEL}>
          Stok menipis
        </h2>
        <DaftarStokMenipis varian={stokMenipis.varian} />
      </section>
    </>
  );
}
