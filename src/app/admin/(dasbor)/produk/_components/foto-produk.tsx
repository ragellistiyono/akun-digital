"use client";

import {
  ArrowDown,
  ArrowUp,
  ImageIcon,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Keterangan } from "../../_components/keterangan-isian";
import {
  aksiHapusFotoProduk,
  aksiPindahkanFotoProduk,
  aksiUnggahFotoProduk,
  type KeadaanFotoProduk,
} from "../aksi-foto";

type Foto = { nama: string; alamat: string; sampul: boolean };

/** Tombol ikon 40 px di baris foto, nonaktif selama form-nya sedang dikirim. */
function TombolIkon({
  ikon: Ikon,
  label,
  nonaktif = false,
}: {
  ikon: LucideIcon;
  label: string;
  nonaktif?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={nonaktif || pending}
      aria-label={label}
      title={label}
      className="inline-flex size-10 items-center justify-center rounded-[12px] border-[1.5px] border-garis bg-permukaan text-tinta hover:border-monogram disabled:bg-permukaan-2 disabled:text-tinta-redup disabled:hover:border-garis"
    >
      <Ikon aria-hidden="true" className="size-6" />
    </button>
  );
}

/** Satu foto di daftar: gambar, urutan, tanda sampul, serta tombol pindah dan hapus. */
function BarisFoto({
  produkId,
  foto,
  urutan,
  jumlah,
}: {
  produkId: string;
  foto: Foto;
  urutan: number;
  jumlah: number;
}) {
  const kirimanTetap = (
    <>
      <input type="hidden" name="id" value={produkId} />
      <input type="hidden" name="foto" value={foto.nama} />
    </>
  );
  return (
    <li className="flex gap-4">
      <Image
        unoptimized
        src={foto.alamat}
        alt=""
        width={96}
        height={96}
        className="size-24 shrink-0 rounded-[16px] bg-permukaan-2 object-cover"
      />
      <div className="flex min-w-0 flex-col justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
          Foto {urutan}
          {foto.sampul && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-permukaan-2 pr-3 pl-2 text-[13px] font-bold text-tinta">
              <ImageIcon
                aria-hidden="true"
                className="size-4"
                strokeWidth={2.4}
              />
              Sampul
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <form action={aksiPindahkanFotoProduk}>
            {kirimanTetap}
            <input type="hidden" name="urutan" value={urutan - 1} />
            <TombolIkon
              ikon={ArrowUp}
              label={`Naikkan foto ${urutan}`}
              nonaktif={urutan === 1}
            />
          </form>
          <form action={aksiPindahkanFotoProduk}>
            {kirimanTetap}
            <input type="hidden" name="urutan" value={urutan + 1} />
            <TombolIkon
              ikon={ArrowDown}
              label={`Turunkan foto ${urutan}`}
              nonaktif={urutan === jumlah}
            />
          </form>
          <form action={aksiHapusFotoProduk}>
            {kirimanTetap}
            <TombolIkon ikon={Trash2} label={`Hapus foto ${urutan}`} />
          </form>
        </div>
      </div>
    </li>
  );
}

/** Form unggah satu foto, dengan pesan galat bila foto ditolak. */
function FormUnggahFoto({
  produkId,
  jumlah,
  batas,
  batasUkuranMb,
}: {
  produkId: string;
  jumlah: number;
  batas: number;
  batasUkuranMb: number;
}) {
  const [keadaan, aksi, sedangMengunggah] = useActionState<
    KeadaanFotoProduk,
    FormData
  >(aksiUnggahFotoProduk, {});
  const galat = keadaan.galat;

  return (
    <form action={aksi} noValidate className="flex flex-col gap-2">
      <input type="hidden" name="id" value={produkId} />
      <label htmlFor="foto" className="text-sm font-bold">
        Tambah foto
      </label>
      <input
        id="foto"
        name="foto"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-invalid={galat ? true : undefined}
        aria-describedby="foto-keterangan"
        className="rounded-[14px] border-[1.5px] border-garis bg-permukaan p-2 text-sm text-tinta-redup file:mr-3 file:h-9 file:rounded-[10px] file:border-[1.5px] file:border-solid file:border-garis file:bg-permukaan-2 file:px-3 file:text-sm file:font-bold file:text-tinta hover:file:border-monogram aria-invalid:border-st-masalah"
      />
      <Keterangan
        id="foto-keterangan"
        galat={galat}
        bantuan={`${jumlah} dari ${batas} foto. PNG, JPEG, atau WebP, paling besar ${batasUkuranMb} MB.`}
      />
      <div className="mt-2">
        <button
          type="submit"
          disabled={sedangMengunggah}
          className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-garis bg-permukaan px-6 text-base font-extrabold text-tinta hover:border-monogram disabled:bg-permukaan-2 disabled:text-tinta-redup"
        >
          <Upload aria-hidden="true" className="size-6" />
          {sedangMengunggah ? "Mengunggah…" : "Unggah foto"}
        </button>
      </div>
    </form>
  );
}

/**
 * Foto Produk di halaman Ubah Produk (PRD §3.3): daftar foto menurut urutannya, dengan tanda sampul
 * dari server, serta form unggah. Setiap perubahan foto langsung tersimpan, terpisah dari tombol
 * Simpan di form Produk.
 */
export function FotoProduk({
  produkId,
  foto,
  batas,
  batasUkuranMb,
}: {
  produkId: string;
  foto: Foto[];
  batas: number;
  batasUkuranMb: number;
}) {
  return (
    <section
      aria-labelledby="foto-judul"
      className="mt-4 flex max-w-[560px] flex-col gap-6 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <div className="flex flex-col gap-2">
        <h2
          id="foto-judul"
          className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]"
        >
          Foto
        </h2>
        <p className="text-[13px] text-tinta-redup">
          Foto pertama menjadi sampul di katalog. Foto langsung tersimpan saat
          diunggah, dipindah, atau dihapus.
        </p>
      </div>

      {foto.length === 0 ? (
        <p className="text-tinta-redup">Belum ada foto.</p>
      ) : (
        <ol aria-labelledby="foto-judul" className="flex flex-col gap-4">
          {foto.map((satu, indeks) => (
            <BarisFoto
              key={satu.nama}
              produkId={produkId}
              foto={satu}
              urutan={indeks + 1}
              jumlah={foto.length}
            />
          ))}
        </ol>
      )}

      {/* Form unggah dipasang ulang setiap kali daftar foto berubah, supaya pesan galat lama, misalnya
          batas 5 foto, hilang setelah Admin menghapus atau memindah foto. */}
      <FormUnggahFoto
        key={foto.map((satu) => satu.nama).join(" ")}
        produkId={produkId}
        jumlah={foto.length}
        batas={batas}
        batasUkuranMb={batasUkuranMb}
      />
    </section>
  );
}
