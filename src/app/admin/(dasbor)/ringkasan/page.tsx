import { ChevronRight, TriangleAlert } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";

import { rupiah, rupiahBertanda } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { jumlahPesananBermasalah } from "@/server/daftar-pesanan";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import {
  angkaItemStok,
  angkaMemberAktif,
  angkaRingkasan,
  angkaTotalSaldoMember,
  jumlahPesananMenungguPembayaran,
  jumlahTopUpBermasalah,
} from "@/server/ringkasan";
import { daftarStokMenipis } from "@/server/stok-menipis";

import { ALAMAT_ITEM_STOK } from "../item-stok/alamat";
import { ALAMAT_LAPORAN } from "../laporan/alamat";
import { DaftarStokMenipis } from "./_components/daftar-stok-menipis";

const KELAS_JUDUL_PANEL = "garis-gelombang text-[28px] leading-[1.2]";

const KELAS_KARTU = "kartu flex h-full flex-col gap-2 p-4";

/** Kartu yang bisa diketuk: bayangannya naik saat disorot, seperti kartu Pesanan Bermasalah. */
const KELAS_KARTU_TAUTAN =
  "transition-shadow duration-100 hover:shadow-coret-sedang motion-reduce:transition-none";

/**
 * Grid kartu Ringkasan. Di ponsel satu kolom, mulai 640 px dua kolom, dan mulai 1200 px tiga kolom. Kartu
 * terakhir selebar dua kolom di dua kolom dan selebar tiga kolom di tiga kolom, supaya baris terakhir penuh
 * (13 kartu). Kartu sebaris sama tinggi karena grid meregangkannya. Varian `min-[…px]` dipakai, bukan `sm:`, karena
 * `sm:` (rem) tersusun sesudah `lebar:` (px) di CSS hasil Tailwind dan akan menimpanya.
 */
const KELAS_GRID_KARTU =
  "grid gap-4 min-[640px]:grid-cols-2 min-[1200px]:grid-cols-3";
const KELAS_KARTU_TERAKHIR = "min-[640px]:col-span-2 min-[1200px]:col-span-3";

/** Judul kartu angka (h2): spidol Kalam, lebih kecil daripada judul bagian. */
const KELAS_JUDUL_KARTU = "flex items-center gap-2 text-[20px]";

/** Angka kartu: spidol Kalam besar. */
const KELAS_ANGKA =
  "font-spidol text-[32px] leading-none font-bold tabular-nums break-words";

const KELAS_KETERANGAN = "text-[15px] text-pensil-redup";

/** Daftar Pesanan yang sudah disaring ke status itu (PRD §9.2, §9.5). */
const alamatPesananBerstatus = (status: string) =>
  `/admin/pesanan?${new URLSearchParams({ status })}`;

/** Menu Top up yang sudah disaring ke status Bermasalah (PRD §9.2 ▶ Keputusan 2026-11-20, §15.9). */
const ALAMAT_TOP_UP_BERMASALAH = `/admin/top-up?${new URLSearchParams({ status: "Bermasalah" })}`;

/** Nilai kartu: teks yang tampil dan apakah nilainya negatif, yang ditulis dengan warna `aksi` (DESIGN.md). */
type NilaiKartu = { teks: string; negatif: boolean };

const nilaiJumlah = (jumlah: number): NilaiKartu => ({
  teks: String(jumlah),
  negatif: false,
});

/** Nominal rupiah, dengan tanda minus untuk nilai negatif, misalnya "−Rp 12.500" (PRD §14.5). */
const nilaiRupiah = (nominal: number): NilaiKartu => ({
  teks: rupiahBertanda(nominal),
  negatif: nominal < 0,
});

/** Isi kartu: tautan selebar kartu bila kartunya bisa diketuk, atau kotak biasa. */
function IsiKartu({ href, children }: { href?: string; children: ReactNode }) {
  return href === undefined ? (
    <div className={KELAS_KARTU}>{children}</div>
  ) : (
    <Link href={href} className={cn(KELAS_KARTU, KELAS_KARTU_TAUTAN)}>
      {children}
    </Link>
  );
}

/** Judul kartu, dengan panah kecil bila kartunya bisa diketuk. */
function JudulKartu({
  id,
  judul,
  bisaDiketuk,
}: {
  id: string;
  judul: string;
  bisaDiketuk: boolean;
}) {
  return (
    <h2 id={id} className={KELAS_JUDUL_KARTU}>
      {judul}
      {bisaDiketuk && (
        <ChevronRight
          aria-hidden="true"
          className="ml-auto size-5 shrink-0"
          strokeWidth={2.5}
        />
      )}
    </h2>
  );
}

/**
 * Kartu dengan tiga angka (DESIGN.md "Rincian angka Laporan keuangan dan kartu Ringkasan"): angka hari ini
 * paling besar, lalu bulan ini dan sepanjang waktu di bawahnya sebagai baris kecil berlabel.
 */
function KartuTigaAngka({
  id,
  judul,
  hariIni,
  bulanIni,
  sepanjangWaktu,
  keterangan,
  href,
}: {
  id: string;
  judul: string;
  hariIni: NilaiKartu;
  bulanIni: NilaiKartu;
  sepanjangWaktu: NilaiKartu;
  keterangan: ReactNode;
  href?: string;
}) {
  const warna = ({ negatif }: NilaiKartu) => (negatif ? "text-aksi" : "");
  return (
    <article aria-labelledby={id}>
      <IsiKartu href={href}>
        <JudulKartu id={id} judul={judul} bisaDiketuk={href !== undefined} />
        <dl className="flex flex-col gap-1">
          <div className="flex min-w-0 flex-col-reverse gap-2 pb-1">
            <dt className={KELAS_KETERANGAN}>Hari ini</dt>
            <dd className={cn(KELAS_ANGKA, warna(hariIni))}>{hariIni.teks}</dd>
          </div>
          {[
            { label: "Bulan ini", nilai: bulanIni },
            { label: "Sepanjang waktu", nilai: sepanjangWaktu },
          ].map(({ label, nilai }) => (
            <div
              key={label}
              className="flex min-w-0 items-baseline justify-between gap-4 border-t border-dashed border-pensil-redup pt-1 text-[17px]"
            >
              <dt>{label}</dt>
              <dd
                className={cn(
                  "text-right tabular-nums break-words",
                  warna(nilai),
                )}
              >
                {nilai.teks}
              </dd>
            </div>
          ))}
        </dl>
        <p className={KELAS_KETERANGAN}>{keterangan}</p>
      </IsiKartu>
    </article>
  );
}

/**
 * Kartu dengan satu angka, beserta keterangan asal angkanya. Angkanya jumlah, atau nominal rupiah yang sudah
 * ditulis.
 */
function KartuSatuAngka({
  id,
  judul,
  angka,
  tambahan,
  keterangan,
  href,
  className,
}: {
  id: string;
  judul: string;
  angka: number | string;
  tambahan?: ReactNode;
  keterangan: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <article aria-labelledby={id} className={className}>
      <IsiKartu href={href}>
        <JudulKartu id={id} judul={judul} bisaDiketuk={href !== undefined} />
        <p className={KELAS_ANGKA}>{angka}</p>
        {tambahan}
        <p className={KELAS_KETERANGAN}>{keterangan}</p>
      </IsiKartu>
    </article>
  );
}

/**
 * Kartu yang perlu tindakan (Pesanan Bermasalah dan Top up Bermasalah): berwarna `st-masalah`, berbayangan tegas,
 * dengan ikon `TriangleAlert` dan ajakan "Perlu tindakan. Buka daftar …" (PRD §9.2, DESIGN.md). Kartu ini tegak
 * tanpa paku payung, karena dasbor admin tidak memakai hiasan dan rotasi (DESIGN.md Navigation).
 */
function KartuPerluTindakan({
  id,
  judul,
  angka,
  href,
  ajakan,
}: {
  id: string;
  judul: string;
  angka: number;
  href: string;
  ajakan: string;
}) {
  return (
    <article aria-labelledby={id}>
      <Link
        href={href}
        className="kartu flex h-full flex-col gap-2 border-st-masalah bg-st-masalah-bg p-4 text-st-masalah shadow-coret transition-shadow duration-100 hover:shadow-coret-sedang motion-reduce:transition-none"
      >
        <h2 id={id} className={KELAS_JUDUL_KARTU}>
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-coret-bulat border-2 border-current">
            <TriangleAlert
              aria-hidden="true"
              className="size-5"
              strokeWidth={2.5}
            />
          </span>
          {judul}
        </h2>
        <p className={KELAS_ANGKA}>{angka}</p>
        <p className="mt-auto flex items-center gap-1 text-[16px]">
          {ajakan}
          <ChevronRight
            aria-hidden="true"
            className="size-5 shrink-0"
            strokeWidth={2.5}
          />
        </p>
      </Link>
    </article>
  );
}

// Halaman depan dasbor admin (PRD §9.2 ▶ Keputusan 2026-11-20): 13 kartu angka dengan urutan PRD,
// lalu daftar Stok menipis di bawahnya (PRD §9.4), selebar isi. Ringkasan hanya berupa angka, tanpa grafik. Kartu
// uang membuka Laporan keuangan, kartu Member membuka daftar Member, dan kartu Item stok membuka menu Item stok.
export default async function HalamanRingkasan() {
  await wajibSesiAdmin(await headers());
  const { ambangStokMenipis } = await bacaPengaturanToko();
  const [
    angka,
    menunggu,
    bermasalah,
    member,
    totalSaldo,
    topUpBermasalah,
    itemStok,
    stokMenipis,
  ] = await Promise.all([
    angkaRingkasan(),
    jumlahPesananMenungguPembayaran(),
    jumlahPesananBermasalah(),
    angkaMemberAktif(),
    angkaTotalSaldoMember(),
    jumlahTopUpBermasalah(),
    angkaItemStok(),
    daftarStokMenipis({ ambang: ambangStokMenipis }),
  ]);
  const { hariIni, bulanIni, sepanjangWaktu } = angka;
  // Hari ini dan bulan ini termasuk di dalam sepanjang waktu, jadi N sepanjang waktu mencakup keduanya.
  const tanpaHargaModal = sepanjangWaktu.pesananTanpaHargaModal;
  const uang = (
    ambil: (laba: typeof hariIni) => number,
  ): Pick<
    Parameters<typeof KartuTigaAngka>[0],
    "hariIni" | "bulanIni" | "sepanjangWaktu"
  > => ({
    hariIni: nilaiRupiah(ambil(hariIni)),
    bulanIni: nilaiRupiah(ambil(bulanIni)),
    sepanjangWaktu: nilaiRupiah(ambil(sepanjangWaktu)),
  });

  return (
    <>
      <div className="kepala-halaman">
        <h1>Ringkasan</h1>
      </div>

      {/* Peringatan untuk kartu Total Harga modal, Laba kotor, dan Laba bersih, sekali saja, sebagai catatan
          post-it di atas kartu (DESIGN.md "Rincian angka Laporan keuangan dan kartu Ringkasan"). */}
      {tanpaHargaModal > 0 && (
        <p
          role="note"
          className="kartu kartu-postit mb-4 flex items-start gap-2 p-4 text-[17px]"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
            strokeWidth={2.5}
          />
          {tanpaHargaModal} Pesanan Selesai belum dihitung labanya, karena Harga
          modal Varian-nya belum diisi.
        </p>
      )}

      <div className={KELAS_GRID_KARTU}>
        <KartuTigaAngka
          id="kartu-pendapatan"
          judul="Pendapatan"
          {...uang((laba) => laba.pendapatan)}
          href={ALAMAT_LAPORAN}
          keterangan="Jumlah Total bayar Pesanan Selesai menurut waktu pembayaran (WIB), termasuk Kode unik. Pesanan Bermasalah dan Dana Dikembalikan tidak dihitung."
        />

        <KartuTigaAngka
          id="kartu-total-harga-modal"
          judul="Total Harga modal"
          {...uang((laba) => laba.totalHargaModal)}
          href={ALAMAT_LAPORAN}
          keterangan="Jumlah Harga modal Pesanan Selesai yang punya Harga modal, menurut waktu pembayaran (WIB)."
        />

        <KartuTigaAngka
          id="kartu-laba-kotor"
          judul="Laba kotor"
          {...uang((laba) => laba.labaKotor)}
          href={ALAMAT_LAPORAN}
          keterangan="Harga jual − Harga modal, dari Pesanan Selesai yang punya Harga modal."
        />

        <KartuTigaAngka
          id="kartu-laba-bersih"
          judul="Laba bersih"
          {...uang((laba) => laba.labaBersih)}
          href={ALAMAT_LAPORAN}
          keterangan="Laba kotor − potongan voucher + Kode unik − Biaya transaksi − Biaya operasional + Kode unik Top up − Biaya transaksi Top up, dalam rentang itu. Nominal top up tidak dihitung."
        />

        <KartuTigaAngka
          id="kartu-pesanan-selesai"
          judul="Pesanan Selesai"
          hariIni={nilaiJumlah(hariIni.pesananSelesai)}
          bulanIni={nilaiJumlah(bulanIni.pesananSelesai)}
          sepanjangWaktu={nilaiJumlah(sepanjangWaktu.pesananSelesai)}
          keterangan="Dihitung menurut waktu pembayaran (WIB), bukan waktu Pesanan dibuat."
          href={alamatPesananBerstatus("Selesai")}
        />

        <KartuSatuAngka
          id="kartu-pesanan-menunggu-pembayaran"
          judul="Pesanan Menunggu Pembayaran"
          angka={menunggu.jumlah}
          keterangan="Pesanan yang berstatus Menunggu Pembayaran saat ini."
          href={alamatPesananBerstatus("Menunggu Pembayaran")}
        />

        <KartuPerluTindakan
          id="kartu-pesanan-bermasalah"
          judul="Pesanan Bermasalah"
          angka={bermasalah}
          href={alamatPesananBerstatus("Bermasalah")}
          ajakan="Perlu tindakan. Buka daftar Pesanan Bermasalah"
        />

        <KartuSatuAngka
          id="kartu-member-aktif"
          judul="Member aktif"
          angka={member.jumlah}
          tambahan={
            <p className="text-[17px]">
              dari {member.terdaftar.jumlah} Member terdaftar
            </p>
          }
          keterangan="Member yang sudah diverifikasi dan tidak nonaktif, sama dengan Member berstatus Aktif di daftar Member. Pendaftar tidak dihitung."
          href="/admin/member"
        />

        <KartuSatuAngka
          id="kartu-total-saldo-member"
          judul="Total saldo Member"
          angka={rupiah(totalSaldo.total)}
          keterangan="Saldo milik Member yang belum dibelanjakan. Ini uang Member, bukan Pendapatan."
          href="/admin/member"
        />

        <KartuPerluTindakan
          id="kartu-top-up-bermasalah"
          judul="Top up Bermasalah"
          angka={topUpBermasalah.jumlah}
          href={ALAMAT_TOP_UP_BERMASALAH}
          ajakan="Perlu tindakan. Buka daftar Top up Bermasalah"
        />

        <KartuSatuAngka
          id="kartu-item-stok-tersedia"
          judul="Item stok Tersedia"
          angka={itemStok.tersedia.jumlah}
          keterangan="Item stok yang bisa dibeli sekarang, di Varian aktif dari Produk aktif. Item stok Ditahan tidak dihitung."
          href={ALAMAT_ITEM_STOK}
        />

        <KartuSatuAngka
          id="kartu-item-stok-terkirim"
          judul="Item stok Terkirim"
          angka={itemStok.terkirim.jumlah}
          keterangan="Semua Item stok yang sudah Terkirim, sepanjang waktu."
          href={ALAMAT_ITEM_STOK}
        />

        <KartuSatuAngka
          id="kartu-stok-menipis"
          judul="Varian stok menipis"
          angka={stokMenipis.varian.length}
          keterangan={`Varian aktif dengan Stok Varian ${stokMenipis.ambang} atau kurang, sesuai Ambang stok menipis di Pengaturan toko.`}
          className={KELAS_KARTU_TERAKHIR}
        />
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
