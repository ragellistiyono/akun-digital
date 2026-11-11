"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { cn } from "@/lib/utils";

import {
  IsianTeks,
  KELAS_ISIAN,
  KELAS_TOMBOL_GARIS,
  KotakCentang,
} from "../../_components/isian-form";
import { Keterangan } from "../../_components/keterangan-isian";
import {
  aksiBuatProduk,
  aksiUbahProduk,
  type KeadaanFormProduk,
} from "../aksi";

type ProdukAda = {
  id: string;
  nama: string;
  kategoriId: string;
  deskripsi: string;
  ketentuanGaransi: string;
  unggulan: boolean;
  aktif: boolean;
  formatItemStok: string[];
};

/**
 * Daftar nama kolom Format Item stok saat membuat Produk (PRD §4.1). Admin bisa menambah dan
 * menghapus kolom. Kolom yang ditolak server ditandai menurut urutannya saat dikirim.
 */
function EditorFormatItemStok({
  kolomAwal,
  kolomDitolak = [],
  galat,
}: {
  kolomAwal: string[];
  kolomDitolak?: number[];
  galat?: string;
}) {
  const [baris, setBaris] = useState(() =>
    kolomAwal.map((nilaiAwal, indeks) => ({
      kunci: indeks,
      nilaiAwal,
      ditolak: kolomDitolak.includes(indeks + 1),
    })),
  );
  const [kunciBerikut, setKunciBerikut] = useState(kolomAwal.length);
  const [kunciDifokus, setKunciDifokus] = useState<number | null>(null);

  function tambahKolom() {
    setBaris((sebelumnya) => [
      ...sebelumnya,
      { kunci: kunciBerikut, nilaiAwal: "", ditolak: false },
    ]);
    setKunciDifokus(kunciBerikut);
    setKunciBerikut(kunciBerikut + 1);
  }

  function hapusKolom(kunci: number) {
    setBaris((sebelumnya) => sebelumnya.filter((b) => b.kunci !== kunci));
  }

  return (
    <fieldset
      aria-describedby="format-keterangan"
      className="flex flex-col gap-4"
    >
      <legend className="mb-2 text-sm font-bold">Format Item stok</legend>
      {baris.length === 0 ? (
        <p className="text-tinta-redup">Belum ada kolom.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {baris.map((b, indeks) => {
            const id = `kolom-${b.kunci}`;
            return (
              <li key={b.kunci} className="flex flex-col gap-2">
                <label htmlFor={id} className="text-sm font-bold">
                  Nama kolom {indeks + 1}
                </label>
                <div className="flex gap-2">
                  <input
                    id={id}
                    name="kolom"
                    autoComplete="off"
                    defaultValue={b.nilaiAwal}
                    // Hanya kolom yang baru ditambah Admin yang langsung difokuskan.
                    autoFocus={b.kunci === kunciDifokus}
                    aria-invalid={b.ditolak ? true : undefined}
                    aria-describedby={
                      b.ditolak ? "format-keterangan" : undefined
                    }
                    className={cn(KELAS_ISIAN, "h-[52px] min-w-0 flex-1")}
                  />
                  <button
                    type="button"
                    onClick={() => hapusKolom(b.kunci)}
                    aria-label={`Hapus kolom ${indeks + 1}`}
                    className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-garis bg-permukaan text-tinta hover:border-monogram"
                  >
                    <X aria-hidden="true" className="size-6" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div>
        <button
          type="button"
          onClick={tambahKolom}
          className={KELAS_TOMBOL_GARIS}
        >
          <Plus aria-hidden="true" className="size-6" />
          Tambah kolom
        </button>
      </div>
      <Keterangan
        id="format-keterangan"
        galat={galat}
        bantuan="Nama kolom untuk mengisi Item stok, misalnya Email, Password, Profil. Semua Varian Produk ini memakai format yang sama. Format Item stok belum bisa diubah setelah Produk dibuat."
      />
    </fieldset>
  );
}

/** Format Item stok Produk yang sudah ada, hanya untuk dilihat. Aturan mengubahnya dibuat di T28. */
function FormatItemStokTetap({ kolom }: { kolom: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p id="format-judul" className="text-sm font-bold">
        Format Item stok
      </p>
      <ol aria-labelledby="format-judul" className="flex flex-wrap gap-2">
        {kolom.map((nama) => (
          <li
            key={nama}
            className="inline-flex h-9 items-center rounded-[10px] bg-permukaan-2 px-3 text-sm font-bold break-all"
          >
            {nama}
          </li>
        ))}
      </ol>
      <Keterangan
        id="format-keterangan"
        bantuan="Format Item stok belum bisa diubah."
      />
    </div>
  );
}

/**
 * Form Produk untuk membuat (tanpa `produk`) atau mengubah Produk yang sudah ada. Format Item stok
 * hanya diisi saat membuat Produk.
 */
export function FormProduk({
  semuaKategori,
  produk,
}: {
  semuaKategori: { id: string; nama: string }[];
  produk?: ProdukAda;
}) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState<
    KeadaanFormProduk,
    FormData
  >(
    produk ? aksiUbahProduk : aksiBuatProduk,
    produk
      ? {
          nama: produk.nama,
          kategoriId: produk.kategoriId,
          deskripsi: produk.deskripsi,
          ketentuanGaransi: produk.ketentuanGaransi,
          unggulan: produk.unggulan,
          aktif: produk.aktif,
        }
      : {
          nama: "",
          kategoriId: "",
          deskripsi: "",
          ketentuanGaransi: "",
          unggulan: false,
          aktif: true,
          formatItemStok: [""],
        },
  );

  // Daftar kolom dipasang ulang dengan isian yang dikirim setiap kali server menjawab, supaya
  // pengaturan ulang form setelah aksi tidak mengembalikan kolom ke isi awalnya.
  const [keadaanTerakhir, setKeadaanTerakhir] = useState(keadaan);
  const [versi, setVersi] = useState(0);
  if (keadaan !== keadaanTerakhir) {
    setKeadaanTerakhir(keadaan);
    setVersi(versi + 1);
  }

  const galat = keadaan.galat;

  return (
    <form
      action={aksi}
      noValidate
      className="mt-6 flex max-w-[560px] flex-col gap-6 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      {produk && <input type="hidden" name="id" value={produk.id} />}

      <IsianTeks
        nama="nama"
        label="Nama"
        nilaiAwal={keadaan.nama}
        galat={galat?.nama}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="kategoriId" className="text-sm font-bold">
          Kategori
        </label>
        {/* Dipasang ulang setiap kali server menjawab, karena select tidak mengikuti defaultValue
            yang berubah setelah dipasang, sehingga pengaturan ulang form setelah aksi akan
            mengosongkan Kategori yang sudah dipilih. */}
        <select
          key={versi}
          id="kategoriId"
          name="kategoriId"
          defaultValue={keadaan.kategoriId}
          aria-invalid={galat?.kategoriId ? true : undefined}
          aria-describedby="kategoriId-keterangan"
          className={cn(KELAS_ISIAN, "h-[52px]")}
        >
          <option value="">Pilih Kategori</option>
          {semuaKategori.map((kategori) => (
            <option key={kategori.id} value={kategori.id}>
              {kategori.nama}
            </option>
          ))}
        </select>
        <Keterangan
          id="kategoriId-keterangan"
          galat={galat?.kategoriId}
          bantuan={
            semuaKategori.length === 0
              ? "Belum ada Kategori. Buat Kategori dulu lewat menu Kategori."
              : "Setiap Produk masuk tepat satu Kategori."
          }
        />
      </div>

      <IsianTeks
        nama="deskripsi"
        label="Deskripsi"
        nilaiAwal={keadaan.deskripsi}
        galat={galat?.deskripsi}
        banyakBaris
      />

      <IsianTeks
        nama="ketentuanGaransi"
        label="Ketentuan garansi"
        nilaiAwal={keadaan.ketentuanGaransi}
        galat={galat?.ketentuanGaransi}
        bantuan="Tampil di Halaman Produk."
        banyakBaris
      />

      <KotakCentang
        nama="unggulan"
        label="Produk Unggulan"
        bantuan="Produk Unggulan tampil di bagian atas beranda."
        dicentang={keadaan.unggulan}
      />

      <KotakCentang
        nama="aktif"
        label="Aktif"
        bantuan="Produk nonaktif hilang dari katalog dan tidak bisa dibeli."
        dicentang={keadaan.aktif}
      />

      {produk ? (
        <FormatItemStokTetap kolom={produk.formatItemStok} />
      ) : (
        <EditorFormatItemStok
          key={versi}
          kolomAwal={keadaan.formatItemStok ?? []}
          kolomDitolak={galat?.kolomDitolak}
          galat={galat?.formatItemStok}
        />
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={sedangMenyimpan}
          className="inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98] disabled:bg-permukaan-2 disabled:text-tinta-redup"
        >
          {sedangMenyimpan ? "Menyimpan…" : "Simpan"}
        </button>
        <Link href="/admin/produk" className={KELAS_TOMBOL_GARIS}>
          Batal
        </Link>
      </div>
    </form>
  );
}
