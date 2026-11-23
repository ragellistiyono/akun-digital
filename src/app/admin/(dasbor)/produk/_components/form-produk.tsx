"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  BATAS_PER_MEMBER_MAKSIMUM,
  BATAS_PER_MEMBER_MINIMUM,
} from "@/domain/produk-gratis";

import { IsianTeks, KotakCentang } from "../../_components/isian-form";
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
  gratis: boolean;
  batasPerMember: number | null;
};

/**
 * Satu kolom di editor Format Item stok: nama awalnya, dan nomor kolom lamanya (dari 1) bila kolom itu
 * kolom Format Item stok Produk yang sudah ada, atau null bila kolom itu baru.
 */
type KolomEditor = { nama: string; nomorLama: number | null };

/**
 * Daftar nama kolom Format Item stok (PRD §4.1), saat membuat Produk maupun mengubah Format Item stok
 * Produk yang sudah ada. Admin bisa mengganti nama, menambah, dan menghapus kolom. Kolom baru selalu
 * ditambah di akhir, dan kolom lama tidak bisa dipindah urutannya. Kolom baru dikirim sebagai `kolom`,
 * sedangkan kolom lama sebagai `kolom-lama-<nomor kolom lamanya>`, supaya server bisa membedakan ganti nama
 * dari tambah dan hapus kolom. Kolom yang ditolak server ditandai menurut urutannya saat dikirim.
 */
export function EditorFormatItemStok({
  kolomAwal,
  kolomDitolak = [],
  galat,
  bantuan,
}: {
  kolomAwal: KolomEditor[];
  kolomDitolak?: number[];
  galat?: string;
  bantuan: string;
}) {
  const [baris, setBaris] = useState(() =>
    kolomAwal.map(({ nama, nomorLama }, indeks) => ({
      kunci: indeks,
      nilaiAwal: nama,
      nomorLama,
      ditolak: kolomDitolak.includes(indeks + 1),
    })),
  );
  const [kunciBerikut, setKunciBerikut] = useState(kolomAwal.length);
  const [kunciDifokus, setKunciDifokus] = useState<number | null>(null);

  function tambahKolom() {
    setBaris((sebelumnya) => [
      ...sebelumnya,
      { kunci: kunciBerikut, nilaiAwal: "", nomorLama: null, ditolak: false },
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
      <legend className="mb-2 text-[17px] leading-tight">
        Format Item stok
      </legend>
      {baris.length === 0 ? (
        <p className="text-pensil-redup">Belum ada kolom.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {baris.map((b, indeks) => {
            const id = `kolom-${b.kunci}`;
            return (
              <li key={b.kunci} className="flex flex-col gap-2">
                <label htmlFor={id} className="text-[17px] leading-tight">
                  Nama kolom {indeks + 1}
                </label>
                <div className="flex gap-2">
                  <input
                    id={id}
                    name={
                      b.nomorLama === null
                        ? "kolom"
                        : `kolom-lama-${b.nomorLama}`
                    }
                    autoComplete="off"
                    defaultValue={b.nilaiAwal}
                    // Hanya kolom yang baru ditambah Admin yang langsung difokuskan.
                    autoFocus={b.kunci === kunciDifokus}
                    aria-invalid={b.ditolak ? true : undefined}
                    aria-describedby={
                      b.ditolak ? "format-keterangan" : undefined
                    }
                    className="isian min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => hapusKolom(b.kunci)}
                    aria-label={`Hapus kolom ${indeks + 1}`}
                    className="tombol tombol-kedua size-[52px] shrink-0 px-0"
                  >
                    <X
                      aria-hidden="true"
                      className="size-6"
                      strokeWidth={2.5}
                    />
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
          className="tombol tombol-kedua"
        >
          <Plus aria-hidden="true" className="size-6" strokeWidth={2.5} />
          Tambah kolom
        </button>
      </div>
      <Keterangan id="format-keterangan" galat={galat} bantuan={bantuan} />
    </fieldset>
  );
}

/**
 * Form Produk untuk membuat (tanpa `produk`) atau mengubah Produk yang sudah ada. Format Item stok
 * hanya diisi di form ini saat membuat Produk; Format Item stok Produk yang sudah ada diubah lewat
 * FormatItemStokProduk.
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
          gratis: produk.gratis,
          batasPerMember:
            produk.batasPerMember === null ? "" : String(produk.batasPerMember),
        }
      : {
          nama: "",
          kategoriId: "",
          deskripsi: "",
          ketentuanGaransi: "",
          unggulan: false,
          aktif: true,
          gratis: false,
          batasPerMember: "",
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
      className="kartu @container flex flex-col gap-6 p-4 sm:p-6"
    >
      {produk && <input type="hidden" name="id" value={produk.id} />}

      {/* Nama dan Kategori berdampingan bila form cukup lebar (DESIGN.md Tata letak halaman). */}
      <div className="grid items-start gap-6 @md:grid-cols-2">
        <IsianTeks
          nama="nama"
          label="Nama"
          nilaiAwal={keadaan.nama}
          galat={galat?.nama}
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="kategoriId" className="text-[17px] leading-tight">
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
            className="isian"
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

      {/* Isian Batas per Member tepat di bawah centang "Produk gratis", dan hanya dipakai selama centang itu aktif
          (PRD §16.1). */}
      <div className="flex flex-col gap-4">
        <KotakCentang
          nama="gratis"
          label="Produk gratis"
          bantuan="Semua Varian Produk ini bisa diambil gratis oleh Member yang sedang login, tanpa QRIS. Harga jual dipakai lagi bila centang ini dilepas."
          dicentang={keadaan.gratis}
        />
        <IsianTeks
          nama="batasPerMember"
          label="Batas per Member"
          nilaiAwal={keadaan.batasPerMember}
          galat={galat?.batasPerMember}
          bantuan={`Jumlah Pesanan gratis terbanyak untuk satu Member, dari semua Varian Produk ini. Angka ${BATAS_PER_MEMBER_MINIMUM} sampai ${BATAS_PER_MEMBER_MAKSIMUM}, misalnya 5. Hanya dipakai bila Produk gratis dicentang.`}
          inputMode="numeric"
        />
      </div>

      {!produk && (
        <EditorFormatItemStok
          key={versi}
          kolomAwal={(keadaan.formatItemStok ?? []).map((nama) => ({
            nama,
            nomorLama: null,
          }))}
          kolomDitolak={galat?.kolomDitolak}
          galat={galat?.formatItemStok}
          bantuan="Nama kolom untuk mengisi Item stok, misalnya Email, Password, Profil. Semua Varian Produk ini memakai format yang sama. Setelah Produk dibuat, nama kolom bisa diganti kapan saja, tetapi kolom hanya bisa ditambah atau dihapus bila Produk tidak punya Item stok Tersedia atau Ditahan."
        />
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={sedangMenyimpan} className="tombol">
          {sedangMenyimpan ? "Menyimpan…" : "Simpan"}
        </button>
        <Link href="/admin/produk" className="tombol tombol-kedua">
          Batal
        </Link>
      </div>
    </form>
  );
}
