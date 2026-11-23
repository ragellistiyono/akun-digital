"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { labaKotor, periksaHargaModal } from "@/domain/harga-modal";
import {
  HARGA_JUAL_MAKSIMUM,
  HARGA_JUAL_MINIMUM,
} from "@/domain/validasi-harga";
import {
  angkaRupiah,
  rupiah,
  rupiahBertanda,
  rupiahDariTeks,
} from "@/lib/rupiah";

import { IsianTeks, KotakCentang } from "../../_components/isian-form";
import { PenegasanHapus } from "../../_components/penegasan-hapus";
import { PilAktif } from "../../_components/pil";
import {
  aksiHapusVarian,
  aksiTambahVarian,
  aksiUbahVarian,
  type KeadaanFormVarian,
} from "../aksi-varian";

type Varian = {
  id: string;
  nama: string;
  hargaJual: number;
  hargaNormal: number | null;
  hargaModal: number | null;
  aktif: boolean;
};

/** Catatan di form Varian Produk gratis (PRD §16.1). */
const CATATAN_PRODUK_GRATIS =
  "Produk ini gratis. Harga jual dipakai lagi bila centang Produk gratis dilepas.";

/** Tombol kecil 40 px untuk aksi kedua di baris Varian (kelas `tombol-kecil` di globals.css). */
const KELAS_TOMBOL_KECIL = "tombol tombol-kedua tombol-kecil";

/** Laba kotor untuk ditampilkan: "Rp X", "−Rp X" bila negatif, atau "—" bila belum bisa dihitung. */
const teksLabaKotor = (laba: number | null) =>
  laba === null ? "—" : rupiahBertanda(laba);

/**
 * Laba kotor per Pesanan dari teks isian Harga jual dan Harga modal yang sedang diketik (PRD §14.1), menurut
 * periksaHargaModal. Null bila salah satunya belum terbaca sebagai rupiah, atau Harga modal-nya ditolak.
 */
function labaKotorKetikan({
  hargaJual,
  hargaModal,
}: {
  hargaJual: string;
  hargaModal: string;
}) {
  const jual = rupiahDariTeks(hargaJual.trim());
  const modal = rupiahDariTeks(hargaModal.trim());
  if (jual === null || modal === null) return null;
  return periksaHargaModal({ hargaJual: jual, hargaModal: modal })
    .labaKotorPerPesanan;
}

/**
 * Form Varian untuk menambah (tanpa `varian`) atau mengubah Varian yang sudah ada. Setelah Varian
 * tersimpan, atau saat Admin memilih Batal, form ditutup lewat `onSelesai`.
 *
 * Varian Produk gratis tetap wajib punya Harga jual, dengan catatan bahwa Harga jual dipakai lagi bila centang
 * Produk gratis dilepas (PRD §16.1). Catatan ini tetap tampil walaupun Harga jual ditolak.
 *
 * "Laba kotor per Pesanan" di bawah isian Harga modal berubah langsung saat Harga jual atau Harga modal
 * diketik (PRD §14.1). Setelah server menjawab, misalnya dengan pesan penolakan, isian kembali ke nilai
 * jawabannya, jadi Laba kotor-nya ikut dihitung ulang dari nilai itu.
 */
function FormVarian({
  produkId,
  gratis,
  varian,
  onSelesai,
}: {
  produkId: string;
  gratis: boolean;
  varian?: Varian;
  onSelesai: () => void;
}) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState<
    KeadaanFormVarian,
    FormData
  >(
    async (sebelumnya, formData) => {
      const hasil = await (varian ? aksiUbahVarian : aksiTambahVarian)(
        sebelumnya,
        formData,
      );
      if (hasil.tersimpan) onSelesai();
      return hasil;
    },
    varian
      ? {
          nama: varian.nama,
          hargaJual: angkaRupiah(varian.hargaJual),
          hargaNormal:
            varian.hargaNormal === null ? "" : angkaRupiah(varian.hargaNormal),
          hargaModal:
            varian.hargaModal === null ? "" : angkaRupiah(varian.hargaModal),
          aktif: varian.aktif,
        }
      : {
          nama: "",
          hargaJual: "",
          hargaNormal: "",
          hargaModal: "",
          aktif: true,
        },
  );
  const galat = keadaan.galat;
  const [ketikan, setKetikan] = useState({
    keadaan,
    hargaJual: keadaan.hargaJual,
    hargaModal: keadaan.hargaModal,
  });
  if (ketikan.keadaan !== keadaan) {
    setKetikan({
      keadaan,
      hargaJual: keadaan.hargaJual,
      hargaModal: keadaan.hargaModal,
    });
  }
  // Halaman bisa memuat beberapa form Varian sekaligus, jadi setiap isian diberi id sendiri.
  const awalan = varian ? `varian-${varian.id}` : "varian-baru";

  return (
    <form
      action={aksi}
      noValidate
      aria-labelledby={`${awalan}-judul`}
      className="flex flex-col gap-6"
      onChange={(peristiwa) => {
        const isian = peristiwa.target;
        if (
          isian instanceof HTMLInputElement &&
          (isian.name === "hargaJual" || isian.name === "hargaModal")
        ) {
          setKetikan((sebelumnya) => ({
            ...sebelumnya,
            [isian.name]: isian.value,
          }));
        }
      }}
    >
      <input type="hidden" name="produkId" value={produkId} />
      {varian && <input type="hidden" name="id" value={varian.id} />}

      <h3 id={`${awalan}-judul`} className="text-[22px] break-words">
        {varian ? `Ubah Varian ${varian.nama}` : "Tambah Varian"}
      </h3>

      <IsianTeks
        nama="nama"
        id={`${awalan}-nama`}
        label="Nama"
        nilaiAwal={keadaan.nama}
        galat={galat?.nama}
        bantuan="Misalnya 1 Bulan atau 3 Bulan."
        autoFocus
      />

      {/* Harga jual dan Harga modal berdampingan bila panel Varian cukup lebar, lalu Harga normal. */}
      <div className="grid items-start gap-6 @md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <IsianTeks
            nama="hargaJual"
            id={`${awalan}-harga-jual`}
            label="Harga jual"
            nilaiAwal={keadaan.hargaJual}
            galat={galat?.hargaJual}
            bantuan={`Rupiah bulat dari ${rupiah(HARGA_JUAL_MINIMUM)} sampai ${rupiah(HARGA_JUAL_MAKSIMUM)}, misalnya 50.000.`}
            inputMode="numeric"
          />
          {gratis && (
            <p className="text-[15px] text-pensil-redup">
              {CATATAN_PRODUK_GRATIS}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <IsianTeks
            nama="hargaModal"
            id={`${awalan}-harga-modal`}
            label="Harga modal"
            nilaiAwal={keadaan.hargaModal}
            galat={galat?.hargaModal}
            bantuan="Biaya toko untuk mendapat satu Item stok. Rupiah bulat, minimal 0, misalnya 35.000. Tidak tampil ke Pembeli."
            inputMode="numeric"
          />
          <p aria-live="polite" className="font-spidol text-[17px] font-bold">
            Laba kotor per Pesanan: {teksLabaKotor(labaKotorKetikan(ketikan))}
          </p>
        </div>

        <IsianTeks
          nama="hargaNormal"
          id={`${awalan}-harga-normal`}
          label="Harga normal (opsional)"
          nilaiAwal={keadaan.hargaNormal}
          galat={galat?.hargaNormal}
          bantuan="Harga pembanding yang tampil dicoret di samping Harga jual. Harus lebih besar dari Harga jual. Kosongkan bila tidak ada."
          inputMode="numeric"
        />
      </div>

      <KotakCentang
        nama="aktif"
        id={`${awalan}-aktif`}
        label="Aktif"
        bantuan="Varian nonaktif hilang dari katalog dan tidak bisa dibeli."
        dicentang={keadaan.aktif}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={sedangMenyimpan} className="tombol">
          {sedangMenyimpan ? "Menyimpan…" : "Simpan Varian"}
        </button>
        <button
          type="button"
          onClick={onSelesai}
          className="tombol tombol-kedua"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

/**
 * Satu Varian di daftar: nama, harga, dan keadaannya, atau form ubahnya saat Admin memilih Ubah. Hapus
 * meminta persetujuan lewat Modal penegasan lebih dulu (PRD §9.10), dan server menolak Varian yang sudah pernah
 * dipesan (PRD §3.7).
 */
function BarisVarian({
  produkId,
  gratis,
  varian,
}: {
  produkId: string;
  gratis: boolean;
  varian: Varian;
}) {
  const [diubah, setDiubah] = useState(false);

  if (diubah) {
    return (
      <li className="py-4">
        <FormVarian
          produkId={produkId}
          gratis={gratis}
          varian={varian}
          onSelesai={() => setDiubah(false)}
        />
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="font-spidol font-bold break-words">{varian.nama}</span>
        <span className="font-spidol text-xl font-bold">
          {rupiah(varian.hargaJual)}
        </span>
        {varian.hargaNormal !== null && (
          <span className="text-[15px] text-pensil-redup">
            Harga normal {rupiah(varian.hargaNormal)}
          </span>
        )}
        <span className="text-[15px] text-pensil-redup">
          Harga modal{" "}
          {varian.hargaModal === null ? "—" : rupiah(varian.hargaModal)}
        </span>
        <span className="text-[15px] text-pensil-redup">
          Laba kotor per Pesanan {teksLabaKotor(labaKotor(varian).labaKotor)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PilAktif aktif={varian.aktif} />
        <Link
          href={`/admin/produk/${produkId}/varian/${varian.id}`}
          className={KELAS_TOMBOL_KECIL}
        >
          Item stok<span className="sr-only"> Varian {varian.nama}</span>
        </Link>
        <button
          type="button"
          onClick={() => setDiubah(true)}
          className={KELAS_TOMBOL_KECIL}
        >
          Ubah<span className="sr-only"> Varian {varian.nama}</span>
        </button>
        <PenegasanHapus
          aksi={aksiHapusVarian}
          isian={{ produkId, id: varian.id }}
          judul="Hapus Varian?"
          nama={`Varian ${varian.nama}`}
          akibat="Item stok Varian ini ikut terhapus dan tidak bisa dikembalikan."
          tombol={
            <>
              Hapus<span className="sr-only"> Varian {varian.nama}</span>
            </>
          }
          idGalat={`varian-${varian.id}-galat-hapus`}
        />
      </div>
    </li>
  );
}

/**
 * Varian di halaman Ubah Produk (PRD §3.2, §3.5, §3.7, §14.1): daftar Varian beserta Harga jual, Harga
 * normal, Harga modal, Laba kotor per Pesanan, dan keadaannya ("—" untuk Varian tanpa Harga modal), form
 * tambah dan ubah, serta tautan ke halaman Varian untuk mengisi Item stok. Setiap Varian langsung tersimpan,
 * terpisah dari tombol Simpan di form Produk. `gratis` menandai Produk gratis (PRD §16.1).
 */
export function VarianProduk({
  produkId,
  gratis,
  varian,
}: {
  produkId: string;
  gratis: boolean;
  varian: Varian[];
}) {
  const [menambah, setMenambah] = useState(false);

  return (
    <section
      aria-labelledby="varian-judul"
      className="kartu @container flex flex-col gap-6 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 id="varian-judul" className="text-[26px]">
          Varian
        </h2>
        <p className="text-base text-pensil-redup">
          Pilihan di dalam Produk ini, misalnya 1 Bulan atau 3 Bulan. Varian
          langsung tersimpan saat Simpan Varian dipilih, terpisah dari tombol
          Simpan di form Produk.
        </p>
      </div>

      {varian.length === 0 ? (
        <p className="text-pensil-redup">Belum ada Varian.</p>
      ) : (
        <ul
          aria-labelledby="varian-judul"
          className="flex flex-col divide-y-2 divide-dashed divide-pensil"
        >
          {varian.map((satu) => (
            <BarisVarian
              key={satu.id}
              produkId={produkId}
              gratis={gratis}
              varian={satu}
            />
          ))}
        </ul>
      )}

      {menambah ? (
        <FormVarian
          produkId={produkId}
          gratis={gratis}
          onSelesai={() => setMenambah(false)}
        />
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setMenambah(true)}
            className="tombol tombol-kedua"
          >
            <Plus aria-hidden="true" className="size-6" strokeWidth={2.5} />
            Tambah Varian
          </button>
        </div>
      )}
    </section>
  );
}
