import { ChevronRight, TriangleAlert } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";

import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { jumlahPesananBermasalah } from "@/server/daftar-pesanan";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { angkaMemberAktif, angkaRingkasan } from "@/server/ringkasan";
import { daftarStokMenipis } from "@/server/stok-menipis";

import { DaftarStokMenipis } from "./_components/daftar-stok-menipis";

const KELAS_JUDUL_PANEL = "garis-gelombang text-[28px] leading-[1.2]";

const KELAS_KARTU = "kartu flex flex-col gap-2 p-4";

/**
 * Lebar kartu di grid Ringkasan. Di ponsel satu kolom. Mulai 640 px dua kolom, dengan kartu terakhir selebar
 * dua kolom supaya tidak ada lubang. Mulai 1200 px grid enam lajur: dua kartu hari ini dan bulan ini masing-masing
 * setengah baris, lalu tiga kartu satu angka masing-masing sepertiga baris. Kartu sebaris sama tinggi karena
 * grid meregangkannya. Varian `min-[…px]` dipakai, bukan `sm:`, karena `sm:` (rem) tersusun sesudah `lebar:`
 * (px) di CSS hasil Tailwind dan akan menimpanya.
 */
const KELAS_GRID_KARTU =
  "grid gap-4 min-[640px]:grid-cols-2 min-[1200px]:grid-cols-6";
const KELAS_SETENGAH_BARIS = "min-[1200px]:col-span-3";
const KELAS_SEPERTIGA_BARIS = "min-[1200px]:col-span-2";
const KELAS_KARTU_TERAKHIR = "min-[640px]:col-span-2";

/** Judul kartu angka (h2): spidol Kalam, lebih kecil daripada judul bagian. */
const KELAS_JUDUL_KARTU = "text-[20px]";

/** Angka kartu: spidol Kalam besar. */
const KELAS_ANGKA =
  "font-spidol text-[32px] leading-none font-bold tabular-nums";

const KELAS_KETERANGAN = "text-[15px] text-pensil-redup";

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
    <article
      aria-labelledby={id}
      className={cn(KELAS_KARTU, KELAS_SETENGAH_BARIS)}
    >
      <h2 id={id} className={KELAS_JUDUL_KARTU}>
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

// Halaman depan dasbor admin (PRD §9.2): kartu angka dengan urutan PRD §9.2, lalu daftar Stok menipis di
// bawahnya (PRD §9.4), selebar isi. Ringkasan hanya berupa angka, tanpa grafik.
export default async function HalamanRingkasan() {
  await wajibSesiAdmin(await headers());
  const { ambangStokMenipis } = await bacaPengaturanToko();
  const [angka, memberAktif, bermasalah, stokMenipis] = await Promise.all([
    angkaRingkasan(),
    angkaMemberAktif(),
    jumlahPesananBermasalah(),
    daftarStokMenipis({ ambang: ambangStokMenipis }),
  ]);

  return (
    <>
      <div className="kepala-halaman">
        <h1>Ringkasan</h1>
      </div>

      <div className={KELAS_GRID_KARTU}>
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

        <article
          aria-labelledby="kartu-member-aktif"
          className={cn(KELAS_KARTU, KELAS_SEPERTIGA_BARIS)}
        >
          <h2 id="kartu-member-aktif" className={KELAS_JUDUL_KARTU}>
            Member aktif
          </h2>
          <p className={KELAS_ANGKA}>{memberAktif.jumlah}</p>
          <p className={KELAS_KETERANGAN}>
            Member yang sudah diverifikasi dan tidak nonaktif, sama dengan
            Member berstatus Aktif di daftar Member. Pendaftar tidak dihitung.
          </p>
        </article>

        {/* Satu-satunya kartu yang perlu tindakan: berwarna `st-masalah` dan berbayangan tegas. Kartu ini tegak
            tanpa paku payung, karena dasbor admin tidak memakai hiasan dan rotasi (DESIGN.md Navigation). */}
        <article
          aria-labelledby="kartu-pesanan-bermasalah"
          className={KELAS_SEPERTIGA_BARIS}
        >
          <Link
            href={ALAMAT_PESANAN_BERMASALAH}
            className="kartu flex h-full flex-col gap-2 border-st-masalah bg-st-masalah-bg p-4 text-st-masalah shadow-coret transition-shadow duration-100 hover:shadow-coret-sedang motion-reduce:transition-none"
          >
            <h2
              id="kartu-pesanan-bermasalah"
              className={`flex items-center gap-2 ${KELAS_JUDUL_KARTU}`}
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-coret-bulat border-2 border-current">
                <TriangleAlert
                  aria-hidden="true"
                  className="size-5"
                  strokeWidth={2.5}
                />
              </span>
              Pesanan Bermasalah
            </h2>
            <p className={KELAS_ANGKA}>{bermasalah}</p>
            <p className="mt-auto flex items-center gap-1 text-[16px]">
              Perlu tindakan. Buka daftar Pesanan Bermasalah
              <ChevronRight
                aria-hidden="true"
                className="size-5 shrink-0"
                strokeWidth={2.5}
              />
            </p>
          </Link>
        </article>

        <article
          aria-labelledby="kartu-stok-menipis"
          className={cn(
            KELAS_KARTU,
            KELAS_SEPERTIGA_BARIS,
            KELAS_KARTU_TERAKHIR,
          )}
        >
          <h2 id="kartu-stok-menipis" className={KELAS_JUDUL_KARTU}>
            Varian stok menipis
          </h2>
          <p className={KELAS_ANGKA}>{stokMenipis.varian.length}</p>
          <p className={KELAS_KETERANGAN}>
            Varian aktif dengan Stok Varian {stokMenipis.ambang} atau kurang,
            sesuai Ambang stok menipis di Pengaturan toko.
          </p>
        </article>
      </div>

      <section aria-labelledby="judul-stok-menipis" className="mt-8">
        <h2 id="judul-stok-menipis" className={KELAS_JUDUL_PANEL}>
          Stok menipis
        </h2>
        <DaftarStokMenipis varian={stokMenipis.varian} />
      </section>
    </>
  );
}
