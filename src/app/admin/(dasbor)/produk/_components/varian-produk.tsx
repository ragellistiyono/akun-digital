"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";

import {
  HARGA_JUAL_MAKSIMUM,
  HARGA_JUAL_MINIMUM,
} from "@/domain/validasi-harga";
import { angkaRupiah, rupiah } from "@/lib/rupiah";

import {
  IsianTeks,
  KELAS_TOMBOL_GARIS,
  KotakCentang,
} from "../../_components/isian-form";
import { PilAktif } from "../../_components/pil";
import {
  aksiTambahVarian,
  aksiUbahVarian,
  type KeadaanFormVarian,
} from "../aksi-varian";

type Varian = {
  id: string;
  nama: string;
  hargaJual: number;
  hargaNormal: number | null;
  aktif: boolean;
};

const KELAS_TOMBOL_SIMPAN = `${KELAS_TOMBOL_GARIS} disabled:bg-permukaan-2 disabled:text-tinta-redup`;

/**
 * Form Varian untuk menambah (tanpa `varian`) atau mengubah Varian yang sudah ada. Setelah Varian
 * tersimpan, atau saat Admin memilih Batal, form ditutup lewat `onSelesai`.
 */
function FormVarian({
  produkId,
  varian,
  onSelesai,
}: {
  produkId: string;
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
          aktif: varian.aktif,
        }
      : { nama: "", hargaJual: "", hargaNormal: "", aktif: true },
  );
  const galat = keadaan.galat;
  // Halaman bisa memuat beberapa form Varian sekaligus, jadi setiap isian diberi id sendiri.
  const awalan = varian ? `varian-${varian.id}` : "varian-baru";

  return (
    <form
      action={aksi}
      noValidate
      aria-labelledby={`${awalan}-judul`}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="produkId" value={produkId} />
      {varian && <input type="hidden" name="id" value={varian.id} />}

      <h3 id={`${awalan}-judul`} className="font-extrabold break-words">
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

      <IsianTeks
        nama="hargaJual"
        id={`${awalan}-harga-jual`}
        label="Harga jual"
        nilaiAwal={keadaan.hargaJual}
        galat={galat?.hargaJual}
        bantuan={`Rupiah bulat dari ${rupiah(HARGA_JUAL_MINIMUM)} sampai ${rupiah(HARGA_JUAL_MAKSIMUM)}, misalnya 50.000.`}
        inputMode="numeric"
      />

      <IsianTeks
        nama="hargaNormal"
        id={`${awalan}-harga-normal`}
        label="Harga normal (opsional)"
        nilaiAwal={keadaan.hargaNormal}
        galat={galat?.hargaNormal}
        bantuan="Harga pembanding yang tampil dicoret di samping Harga jual. Harus lebih besar dari Harga jual. Kosongkan bila tidak ada."
        inputMode="numeric"
      />

      <KotakCentang
        nama="aktif"
        id={`${awalan}-aktif`}
        label="Aktif"
        bantuan="Varian nonaktif hilang dari katalog dan tidak bisa dibeli."
        dicentang={keadaan.aktif}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={sedangMenyimpan}
          className={KELAS_TOMBOL_SIMPAN}
        >
          {sedangMenyimpan ? "Menyimpan…" : "Simpan Varian"}
        </button>
        <button
          type="button"
          onClick={onSelesai}
          className={KELAS_TOMBOL_GARIS}
        >
          Batal
        </button>
      </div>
    </form>
  );
}

/** Satu Varian di daftar: nama, harga, dan keadaannya, atau form ubahnya saat Admin memilih Ubah. */
function BarisVarian({
  produkId,
  varian,
}: {
  produkId: string;
  varian: Varian;
}) {
  const [diubah, setDiubah] = useState(false);

  if (diubah) {
    return (
      <li className="py-4">
        <FormVarian
          produkId={produkId}
          varian={varian}
          onSelesai={() => setDiubah(false)}
        />
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="font-extrabold break-words">{varian.nama}</span>
        <span className="text-lg font-extrabold tracking-[-0.02em]">
          {rupiah(varian.hargaJual)}
        </span>
        {varian.hargaNormal !== null && (
          <span className="text-[13px] text-tinta-redup">
            Harga normal {rupiah(varian.hargaNormal)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <PilAktif aktif={varian.aktif} />
        <button
          type="button"
          onClick={() => setDiubah(true)}
          className="inline-flex h-9 items-center rounded-[10px] border-[1.5px] border-garis bg-permukaan px-3 text-sm font-bold hover:border-monogram"
        >
          Ubah<span className="sr-only"> Varian {varian.nama}</span>
        </button>
      </div>
    </li>
  );
}

/**
 * Varian di halaman Ubah Produk (PRD §3.2, §3.5, §3.7): daftar Varian beserta Harga jual, Harga
 * normal, dan keadaannya, serta form tambah dan ubah. Setiap Varian langsung tersimpan, terpisah dari
 * tombol Simpan di form Produk.
 */
export function VarianProduk({
  produkId,
  varian,
}: {
  produkId: string;
  varian: Varian[];
}) {
  const [menambah, setMenambah] = useState(false);

  return (
    <section
      aria-labelledby="varian-judul"
      className="mt-4 flex max-w-[560px] flex-col gap-6 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <div className="flex flex-col gap-2">
        <h2
          id="varian-judul"
          className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]"
        >
          Varian
        </h2>
        <p className="text-[13px] text-tinta-redup">
          Pilihan di dalam Produk ini, misalnya 1 Bulan atau 3 Bulan. Varian
          langsung tersimpan saat Simpan Varian dipilih, terpisah dari tombol
          Simpan di form Produk.
        </p>
      </div>

      {varian.length === 0 ? (
        <p className="text-tinta-redup">Belum ada Varian.</p>
      ) : (
        <ul
          aria-labelledby="varian-judul"
          className="flex flex-col divide-y divide-garis"
        >
          {varian.map((satu) => (
            <BarisVarian key={satu.id} produkId={produkId} varian={satu} />
          ))}
        </ul>
      )}

      {menambah ? (
        <FormVarian produkId={produkId} onSelesai={() => setMenambah(false)} />
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setMenambah(true)}
            className={KELAS_TOMBOL_GARIS}
          >
            <Plus aria-hidden="true" className="size-6" />
            Tambah Varian
          </button>
        </div>
      )}
    </section>
  );
}
