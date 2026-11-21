import { ReceiptText, TriangleAlert } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { z } from "zod";

import { METODE, type Metode } from "@/domain/bayar-saldo";
import {
  PERIODE_LAPORAN,
  rentangAwalLaporan,
  type PeriodeLaporan,
} from "@/domain/rentang-awal-laporan";
import { rupiah, rupiahBertanda } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import {
  grafikLaporan,
  pilihanSaringanLaporan,
  rincianLaporan,
  tabelPesananLaporan,
  waktuBayarPesananSelesaiPertama,
} from "@/server/laporan-keuangan";
import { tanggalWibDariIsian, waktuWib } from "@/server/zona-waktu-toko";

import { BarisTautan } from "./_components/baris-tautan";
import { FormSaringanLaporan } from "./_components/form-saringan-laporan";
import { GrafikBatangMendatar } from "./_components/grafik-batang-mendatar";
import { GrafikPeriode } from "./_components/grafik-periode";
import { labelKelompok } from "./_components/label-kelompok";
import { ALAMAT_LAPORAN } from "./alamat";
import { ALAMAT_BIAYA_OPERASIONAL } from "./biaya-operasional/alamat";

// Saringan dari alamat. Nilai yang tidak sah, termasuk isian yang dikosongkan, diabaikan.
const SaringanAlamat = z.object({
  periode: z.enum(PERIODE_LAPORAN).optional().catch(undefined),
  dari: z.iso.date().optional().catch(undefined),
  sampai: z.iso.date().optional().catch(undefined),
  kategori: z.uuid().optional().catch(undefined),
  produk: z.uuid().optional().catch(undefined),
  metode: z.enum(METODE).optional().catch(undefined),
  cari: z.string().trim().min(1).optional().catch(undefined),
  halaman: z.coerce.number().int().min(1).optional().catch(undefined),
});

/** Saringan yang dipakai halaman: periode dan kedua tanggal selalu ada. */
type Saringan = {
  periode: PeriodeLaporan;
  dari: string;
  sampai: string;
  kategori?: string;
  produk?: string;
  metode?: Metode;
  cari?: string;
};

/**
 * Alamat Laporan keuangan dengan parameter itu. Parameter yang tidak diberikan tidak ditulis, jadi alamat periode
 * tanpa tanggal kembali ke rentang awal periode itu (PRD §14.6).
 */
function alamatLaporan(
  parameter: Partial<Saringan> & { halaman?: number },
): string {
  const kueri = new URLSearchParams();
  for (const kunci of [
    "periode",
    "dari",
    "sampai",
    "kategori",
    "produk",
    "metode",
    "cari",
  ] as const) {
    const nilai = parameter[kunci];
    if (nilai !== undefined) kueri.set(kunci, nilai);
  }
  if (parameter.halaman !== undefined && parameter.halaman > 1) {
    kueri.set("halaman", String(parameter.halaman));
  }
  const teks = kueri.toString();
  return teks === "" ? ALAMAT_LAPORAN : `${ALAMAT_LAPORAN}?${teks}`;
}

const KELAS_TOMBOL_KECIL_GARIS = "tombol tombol-kecil tombol-kedua";
const KELAS_JUDUL_BAGIAN = "garis-gelombang text-[28px] leading-[1.2]";
const PESAN = "max-w-[65ch] text-pensil-redup";

/**
 * Pilihan periode (PRD §14.6) sebagai chip. Memilih periode membuka rentang awal periode itu, sedangkan Kategori,
 * Produk, Metode, dan kata cari tetap.
 */
function PilihanPeriode({ saringan }: { saringan: Saringan }) {
  return (
    <div
      role="group"
      aria-label="Periode"
      className="flex flex-wrap items-center gap-2"
    >
      {PERIODE_LAPORAN.map((periode) => (
        <Link
          key={periode}
          href={alamatLaporan({
            periode,
            kategori: saringan.kategori,
            produk: saringan.produk,
            metode: saringan.metode,
            cari: saringan.cari,
          })}
          aria-current={periode === saringan.periode ? "true" : undefined}
          className="chip"
        >
          {periode}
        </Link>
      ))}
    </div>
  );
}

/** Catatan post-it di atas rincian angka (DESIGN.md "Rincian angka Laporan keuangan dan kartu Ringkasan"). */
function Catatan({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="kartu kartu-postit flex items-start gap-2 p-4 text-[17px]"
    >
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0"
        strokeWidth={2.5}
      />
      {children}
    </p>
  );
}

type Rincian = Awaited<ReturnType<typeof rincianLaporan>>;

/** Nominal yang boleh negatif: "−Rp 12.500" berwarna `aksi` (PRD §14.5, DESIGN.md). */
function NominalBertanda({ nominal }: { nominal: number }) {
  return (
    <span className={cn(nominal < 0 && "text-aksi")}>
      {rupiahBertanda(nominal)}
    </span>
  );
}

/**
 * Rincian angka (PRD §14.5, §14.6, §15.8) dengan tata letak Rincian Total bayar (DESIGN.md "Rincian angka Laporan
 * keuangan dan kartu Ringkasan"): label di kiri, nominal rata kanan, dan baris Laba kotor serta Laba bersih
 * ditebalkan dengan garis pemisah 2 px di atasnya. Sesudah Biaya operasional ada baris Kode unik Top up dan Biaya
 * transaksi Top up, dan di bawah Laba bersih baris informasi Top up Berhasil. Keempat baris itu tidak tampil saat
 * saringan Kategori, Produk, atau Metode aktif (nilainya null dari domain); keterangannya tampil sebagai catatan di
 * atas rincian.
 */
function RincianAngka({
  rincian,
  saringan,
}: {
  rincian: Rincian;
  saringan: Saringan;
}) {
  const baris: { label: string; nilai: ReactNode; tebal?: boolean }[] = [
    { label: "Pendapatan", nilai: rupiah(rincian.pendapatan) },
    { label: "Pesanan Selesai", nilai: rincian.pesananSelesai },
    { label: "Total Harga modal", nilai: rupiah(rincian.totalHargaModal) },
    {
      label: "Laba kotor",
      nilai: <NominalBertanda nominal={rincian.labaKotor} />,
      tebal: true,
    },
    { label: "− Potongan voucher", nilai: rupiah(rincian.potonganVoucher) },
    { label: "+ Kode unik", nilai: rupiah(rincian.kodeUnik) },
    { label: "− Biaya transaksi", nilai: rupiah(rincian.biayaTransaksi) },
    ...(rincian.biayaOperasional === null
      ? []
      : [
          {
            label: "− Biaya operasional",
            nilai: rupiah(rincian.biayaOperasional),
          },
        ]),
    ...(rincian.kodeUnikTopUp === null || rincian.biayaTransaksiTopUp === null
      ? []
      : [
          {
            label: "+ Kode unik Top up",
            nilai: rupiah(rincian.kodeUnikTopUp),
          },
          {
            label: "− Biaya transaksi Top up",
            nilai: rupiah(rincian.biayaTransaksiTopUp),
          },
        ]),
    {
      label: "Laba bersih",
      nilai: <NominalBertanda nominal={rincian.labaBersih} />,
      tebal: true,
    },
  ];

  return (
    <section aria-labelledby="judul-rincian" className="flex flex-col gap-4">
      <div>
        <h2 id="judul-rincian" className={KELAS_JUDUL_BAGIAN}>
          Rincian angka
        </h2>
        <p className="mt-2 text-[15px] text-pensil-redup">
          Pesanan Selesai menurut waktu bayar (WIB),{" "}
          {tanggalWibDariIsian(saringan.dari)} sampai{" "}
          {tanggalWibDariIsian(saringan.sampai)}.
        </p>
      </div>
      {rincian.pesananTanpaHargaModal > 0 && (
        <Catatan>
          {rincian.pesananTanpaHargaModal} Pesanan Selesai belum dihitung
          labanya, karena Harga modal Varian-nya belum diisi.
        </Catatan>
      )}
      {rincian.biayaOperasional === null && (
        <Catatan>
          Laba bersih ini belum dikurangi Biaya operasional dan Top up, karena
          saringan Produk, Kategori, atau Metode sedang aktif.
        </Catatan>
      )}
      <div className="kartu max-w-[560px] p-4 sm:p-6">
        <table className="w-full border-collapse text-[17px] leading-[1.3]">
          <caption className="sr-only">Rincian angka</caption>
          <tbody>
            {baris.map(({ label, nilai, tebal }) => (
              <tr
                key={label}
                className={cn(
                  tebal && "font-spidol text-[22px] leading-[1.2] font-bold",
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "py-1.5 pr-4 text-left",
                    tebal
                      ? "border-t-2 border-dashed border-pensil pt-3"
                      : "font-normal",
                  )}
                >
                  {label}
                </th>
                <td
                  className={cn(
                    "py-1.5 text-right whitespace-nowrap tabular-nums",
                    tebal && "border-t-2 border-dashed border-pensil pt-3",
                  )}
                >
                  {nilai}
                </td>
              </tr>
            ))}
            {/* Baris informasi di bawah Laba bersih, tidak ikut hitungan (PRD §15.8). Teksnya boleh terlipat,
                supaya rincian tidak bergulir ke samping di ponsel. */}
            {rincian.topUpBerhasil !== null && (
              <tr>
                <td
                  colSpan={2}
                  className="pt-3 text-[15px] text-pensil-redup tabular-nums"
                >
                  Top up Berhasil: {rincian.topUpBerhasil.jumlah},{" "}
                  {rupiah(rincian.topUpBerhasil.nominal)} (uang Member, bukan
                  Pendapatan)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type Grafik = Awaited<ReturnType<typeof grafikLaporan>>;

/**
 * Lima grafik Laporan keuangan (PRD §14.7): Pendapatan dan jumlah Pesanan Selesai per kelompok periode berupa
 * batang, Laba kotor (garis utuh) dan Laba bersih (garis putus-putus), lalu Produk terlaris dan Pendapatan per
 * Kategori berupa batang mendatar. Semuanya mengikuti saringan rentang, Kategori, Produk, dan Metode.
 */
function GrafikLaporan({ grafik }: { grafik: Grafik }) {
  const kelompok = grafik.kelompok.map((k) => labelKelompok(grafik.periode, k));
  const nilai = (ambil: (k: Grafik["kelompok"][number]) => number) =>
    grafik.kelompok.map(ambil);
  return (
    <section aria-labelledby="judul-grafik" className="flex flex-col gap-4">
      <h2 id="judul-grafik" className={KELAS_JUDUL_BAGIAN}>
        Grafik
      </h2>
      <GrafikPeriode
        judul="Pendapatan"
        jenis="batang"
        satuan="rupiah"
        kelompok={kelompok}
        seri={[
          {
            nama: "Pendapatan",
            nilai: nilai((k) => k.pendapatan),
            gaya: "utuh",
          },
        ]}
      />
      <GrafikPeriode
        judul="Laba kotor dan Laba bersih"
        jenis="garis"
        satuan="rupiah"
        kelompok={kelompok}
        seri={[
          {
            nama: "Laba kotor",
            nilai: nilai((k) => k.labaKotor),
            gaya: "utuh",
          },
          {
            nama: "Laba bersih",
            nilai: nilai((k) => k.labaBersih),
            gaya: "putus",
          },
        ]}
      />
      <GrafikPeriode
        judul="Jumlah Pesanan Selesai"
        jenis="batang"
        satuan="jumlah"
        kelompok={kelompok}
        seri={[
          {
            nama: "Pesanan Selesai",
            nilai: nilai((k) => k.pesananSelesai),
            gaya: "utuh",
          },
        ]}
      />
      <GrafikBatangMendatar
        judul="Produk terlaris"
        batang="pesananSelesai"
        baris={grafik.produkTerlaris.map((p) => ({
          kunci: p.produkId,
          nama: p.namaProduk,
          pesananSelesai: p.pesananSelesai,
          pendapatan: p.pendapatan,
        }))}
      />
      <GrafikBatangMendatar
        judul="Pendapatan per Kategori"
        batang="pendapatan"
        baris={grafik.pendapatanPerKategori.map((k) => ({
          kunci: k.kategoriId,
          nama: k.namaKategori,
          pesananSelesai: k.pesananSelesai,
          pendapatan: k.pendapatan,
        }))}
      />
    </section>
  );
}

/** Form cari tabel Pesanan (PRD §14.8). Saringan lain ikut dikirim apa adanya, jadi rincian angka tidak berubah. */
function FormCari({ saringan }: { saringan: Saringan }) {
  return (
    <form
      action={ALAMAT_LAPORAN}
      role="search"
      aria-label="Cari Pesanan"
      className="flex flex-wrap items-end gap-4"
    >
      {(
        ["periode", "dari", "sampai", "kategori", "produk", "metode"] as const
      ).map(
        (kunci) =>
          saringan[kunci] !== undefined && (
            <input
              key={kunci}
              type="hidden"
              name={kunci}
              value={saringan[kunci]}
            />
          ),
      )}
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-2">
        <label htmlFor="cari" className="text-[17px] leading-tight">
          Cari
        </label>
        <input
          id="cari"
          name="cari"
          type="search"
          defaultValue={saringan.cari ?? ""}
          placeholder="Nomor Pesanan atau email"
          autoComplete="off"
          className="isian h-10 min-h-10 w-full min-w-0"
        />
      </div>
      <button type="submit" className="tombol tombol-kecil">
        Cari
      </button>
    </form>
  );
}

type Tabel = Awaited<ReturnType<typeof tabelPesananLaporan>>;

/** Judul kolom PRD §14.8 dan Metode (§14.6 ▶ Keputusan 2026-11-20), dengan nominal rata kanan. */
const KOLOM = [
  { label: "Nomor Pesanan", kanan: false },
  { label: "Waktu bayar (WIB)", kanan: false },
  { label: "Metode", kanan: false },
  { label: "Produk dan Varian", kanan: false },
  { label: "Harga jual", kanan: true },
  { label: "Harga modal", kanan: true },
  { label: "Laba kotor", kanan: true },
  { label: "Potongan voucher", kanan: true },
  { label: "Kode unik", kanan: true },
  { label: "Biaya transaksi", kanan: true },
  { label: "Total bayar", kanan: true },
];

const KELAS_SEL_NOMINAL = "py-3 pr-4 text-right whitespace-nowrap tabular-nums";

/**
 * Tabel Pesanan Selesai (PRD §14.8). Setiap baris membuka detail Pesanan saat diketuk. Tabelnya bergulir ke
 * samping di dalam panelnya sendiri pada layar sempit, supaya halaman tidak ikut bergulir ke samping (PRD §11.1).
 */
function TabelPesanan({ pesanan }: { pesanan: Tabel["pesanan"] }) {
  return (
    <div className="kartu p-4">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left">
          <caption className="sr-only">Pesanan Selesai</caption>
          <thead className="font-spidol text-base font-bold text-pensil-redup">
            <tr className="border-b-2 border-dashed border-pensil">
              {KOLOM.map(({ label, kanan }) => (
                <th
                  key={label}
                  scope="col"
                  className={cn("py-2 pr-4", kanan && "text-right")}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pesanan.map((p) => {
              const alamat = `/admin/pesanan/${p.nomorPesanan}`;
              return (
                <BarisTautan
                  key={p.nomorPesanan}
                  href={alamat}
                  className="group cursor-pointer border-b-2 border-dashed border-pensil align-top last:border-b-0"
                >
                  <th
                    scope="row"
                    className="py-3 pr-4 font-mono text-[15px] font-bold whitespace-nowrap"
                  >
                    <Link
                      href={alamat}
                      className="inline-flex min-h-6 items-center text-pulpen underline-offset-4 group-hover:underline hover:underline"
                    >
                      {p.nomorPesanan}
                    </Link>
                  </th>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {p.waktuBayar ? waktuWib(p.waktuBayar) : "—"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">{p.metode}</td>
                  <td className="min-w-48 py-3 pr-4 [overflow-wrap:anywhere]">
                    <span className="font-spidol font-bold">
                      {p.namaProduk}
                    </span>{" "}
                    <span className="text-pensil-redup">· {p.namaVarian}</span>
                  </td>
                  <td className={KELAS_SEL_NOMINAL}>{rupiah(p.hargaJual)}</td>
                  <td className={KELAS_SEL_NOMINAL}>
                    {p.hargaModal === null ? "—" : rupiah(p.hargaModal)}
                  </td>
                  <td className={KELAS_SEL_NOMINAL}>
                    {p.labaKotor === null ? (
                      "—"
                    ) : (
                      <NominalBertanda nominal={p.labaKotor} />
                    )}
                  </td>
                  <td className={KELAS_SEL_NOMINAL}>
                    {rupiah(p.potonganVoucher)}
                  </td>
                  <td className={KELAS_SEL_NOMINAL}>{rupiah(p.kodeUnik)}</td>
                  <td className={KELAS_SEL_NOMINAL}>
                    {p.biayaTransaksi === null ? "—" : rupiah(p.biayaTransaksi)}
                  </td>
                  <td
                    className={cn(KELAS_SEL_NOMINAL, "font-spidol font-bold")}
                  >
                    {rupiah(p.totalBayar)}
                  </td>
                </BarisTautan>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Tautan ke halaman tabel sebelum dan sesudahnya, bila tabel punya lebih dari satu halaman. */
function NavigasiHalaman({
  saringan,
  tabel,
}: {
  saringan: Saringan;
  tabel: Tabel;
}) {
  const { halaman, jumlahHalaman } = tabel;
  if (jumlahHalaman <= 1) return null;
  return (
    <nav
      aria-label="Halaman tabel Pesanan"
      className="flex flex-wrap items-center gap-2"
    >
      {halaman > 1 && (
        <Link
          href={alamatLaporan({
            ...saringan,
            halaman: Math.min(halaman - 1, jumlahHalaman),
          })}
          className={KELAS_TOMBOL_KECIL_GARIS}
        >
          Sebelumnya
        </Link>
      )}
      <p className="px-2 text-[15px] text-pensil-redup">
        Halaman {halaman} dari {jumlahHalaman}
      </p>
      {halaman < jumlahHalaman && (
        <Link
          href={alamatLaporan({ ...saringan, halaman: halaman + 1 })}
          className={KELAS_TOMBOL_KECIL_GARIS}
        >
          Berikutnya
        </Link>
      )}
    </nav>
  );
}

/** Isi tabel: pesan kosong PRD §14.8 bila tidak ada Pesanan, atau tabel beserta navigasi halamannya. */
function IsiTabel({
  saringan,
  rincian,
  tabel,
}: {
  saringan: Saringan;
  rincian: Rincian;
  tabel: Tabel;
}) {
  if (rincian.pesananSelesai === 0) {
    return (
      <p className={PESAN}>Belum ada Pesanan Selesai dalam rentang ini.</p>
    );
  }
  if (tabel.jumlah === 0) {
    return (
      <p className={PESAN}>
        Tidak ada Pesanan yang cocok dengan pencarian ini.
      </p>
    );
  }
  return (
    <>
      <p className="text-[15px] text-pensil-redup">
        {tabel.jumlah.toLocaleString("id-ID")} Pesanan Selesai
      </p>
      {tabel.pesanan.length === 0 ? (
        <p className={PESAN}>
          Halaman {tabel.halaman} kosong, karena tabel ini hanya punya{" "}
          {tabel.jumlahHalaman} halaman. Pilih Sebelumnya untuk kembali.
        </p>
      ) : (
        <TabelPesanan pesanan={tabel.pesanan} />
      )}
      <NavigasiHalaman saringan={saringan} tabel={tabel} />
    </>
  );
}

// Laporan keuangan (PRD §14.5, §14.6, §14.8): saringan rentang tanggal WIB, Kategori, Produk, Metode, dan periode, rincian
// angka sampai Laba bersih, lima grafik (§14.7), lalu tabel Pesanan Selesai. Halaman dibuka dengan periode Harian
// dan rentang awalnya, dan dibuka dari menu samping serta kartu uang Ringkasan (PRD §11.1, §9.2).
export default async function HalamanLaporanKeuangan({
  searchParams,
}: PageProps<"/admin/laporan">) {
  await wajibSesiAdmin(await headers());
  const alamat = SaringanAlamat.parse(await searchParams);
  const periode = alamat.periode ?? "Harian";
  const awal = rentangAwalLaporan({
    sekarang: new Date(),
    periode,
    pesananSelesaiPertamaDibayarPada:
      periode === "Tahunan" ? await waktuBayarPesananSelesaiPertama() : null,
  });
  const saringan: Saringan = {
    periode,
    dari: alamat.dari ?? awal.mulai,
    sampai: alamat.sampai ?? awal.akhir,
    kategori: alamat.kategori,
    produk: alamat.produk,
    metode: alamat.metode,
    cari: alamat.cari,
  };
  const tanggalTerbalik = saringan.sampai < saringan.dari;
  const saringanData = {
    dari: saringan.dari,
    sampai: saringan.sampai,
    kategoriId: saringan.kategori,
    produkId: saringan.produk,
    metode: saringan.metode,
  };

  const [pilihan, data] = await Promise.all([
    pilihanSaringanLaporan(),
    tanggalTerbalik
      ? null
      : Promise.all([
          rincianLaporan(saringanData),
          tabelPesananLaporan({
            ...saringanData,
            cari: saringan.cari,
            halaman: alamat.halaman,
          }),
          grafikLaporan({ ...saringanData, periode: saringan.periode }),
        ]),
  ]);

  return (
    <>
      <div className="kepala-halaman">
        <h1>Laporan keuangan</h1>
        <Link
          href={ALAMAT_BIAYA_OPERASIONAL}
          className={KELAS_TOMBOL_KECIL_GARIS}
        >
          <ReceiptText
            aria-hidden="true"
            className="size-6"
            strokeWidth={2.5}
          />
          Biaya operasional
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        <PilihanPeriode saringan={saringan} />
        {/* Form dipasang ulang setiap saringan di alamat berubah, supaya isiannya ikut berganti saat Admin memilih
            periode, yang berpindah tanpa memuat ulang halaman. */}
        <FormSaringanLaporan
          key={alamatLaporan(saringan)}
          periode={saringan.periode}
          dari={saringan.dari}
          sampai={saringan.sampai}
          kategoriId={saringan.kategori}
          produkId={saringan.produk}
          metode={saringan.metode}
          cari={saringan.cari}
          semuaKategori={pilihan.kategori}
          semuaProduk={pilihan.produk}
        />
      </div>

      {data === null ? (
        <p
          role="alert"
          className="mt-6 flex max-w-[65ch] items-start gap-2 text-base text-aksi"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
            strokeWidth={2.5}
          />
          <span>
            Tanggal akhir tidak boleh sebelum tanggal mulai. Ubah salah satu
            tanggal, lalu tekan Tampilkan lagi.
          </span>
        </p>
      ) : (
        <>
          <div className="mt-8">
            <RincianAngka rincian={data[0]} saringan={saringan} />
          </div>
          <div className="mt-8">
            <GrafikLaporan grafik={data[2]} />
          </div>
          <section
            aria-labelledby="judul-tabel"
            className="mt-8 flex flex-col gap-4"
          >
            <h2 id="judul-tabel" className={KELAS_JUDUL_BAGIAN}>
              Pesanan Selesai
            </h2>
            <FormCari key={saringan.cari ?? ""} saringan={saringan} />
            <IsiTabel saringan={saringan} rincian={data[0]} tabel={data[1]} />
          </section>
        </>
      )}
    </>
  );
}
