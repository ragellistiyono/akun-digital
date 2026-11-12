"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  periksaFormatItemStok,
  type KolomFormatBaru,
  type MasalahFormatItemStok,
  type PerubahanFormatItemStok,
} from "@/domain/format-item-stok";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { buatProduk, ubahFormatItemStok, ubahProduk } from "@/server/produk";

type GalatProduk = {
  nama?: string;
  kategoriId?: string;
  deskripsi?: string;
  ketentuanGaransi?: string;
  formatItemStok?: string;
  /** Nomor kolom Format Item stok (dari 1) yang ditolak. */
  kolomDitolak?: number[];
};

/**
 * Isian form Produk yang dikembalikan ke form, beserta pesan galatnya. `formatItemStok` hanya ada
 * saat membuat Produk, karena Format Item stok Produk yang sudah ada diubah lewat form-nya sendiri
 * (aksiUbahFormatItemStok).
 */
export type KeadaanFormProduk = {
  nama: string;
  kategoriId: string;
  deskripsi: string;
  ketentuanGaransi: string;
  unggulan: boolean;
  aktif: boolean;
  formatItemStok?: string[];
  galat?: GalatProduk;
};

const MasukanProduk = z.object({
  nama: z
    .string()
    .trim()
    .min(
      1,
      "Nama Produk belum diisi. Ketik nama Produk, misalnya Netflix Premium.",
    ),
  kategoriId: z.uuid(
    "Kategori belum dipilih. Pilih satu Kategori untuk Produk ini.",
  ),
  deskripsi: z
    .string()
    .trim()
    .min(
      1,
      "Deskripsi belum diisi. Tulis penjelasan Produk ini untuk Pembeli.",
    ),
  ketentuanGaransi: z
    .string()
    .trim()
    .min(
      1,
      "Ketentuan garansi belum diisi. Tulis ketentuan garansi yang berlaku untuk Produk ini.",
    ),
  unggulan: z.boolean(),
  aktif: z.boolean(),
});

/** Isian teks dan tanda dari form Produk, apa adanya, untuk divalidasi dan dikembalikan ke form. */
function bacaIsian(formData: FormData) {
  const teks = (nama: string) => {
    const nilai = formData.get(nama);
    return typeof nilai === "string" ? nilai : "";
  };
  return {
    nama: teks("nama"),
    kategoriId: teks("kategoriId"),
    deskripsi: teks("deskripsi"),
    ketentuanGaransi: teks("ketentuanGaransi"),
    // Kotak centang hanya terkirim bila dicentang.
    unggulan: formData.get("unggulan") === "on",
    aktif: formData.get("aktif") === "on",
  };
}

function galatIsian(galat: z.ZodError<z.infer<typeof MasukanProduk>>) {
  const isian = z.flattenError(galat).fieldErrors;
  return {
    nama: isian.nama?.[0],
    kategoriId: isian.kategoriId?.[0],
    deskripsi: isian.deskripsi?.[0],
    ketentuanGaransi: isian.ketentuanGaransi?.[0],
  };
}

/** "2", "2 dan 3", atau "2, 3, dan 4". */
function sebutNomor(nomor: number[]) {
  if (nomor.length <= 2) return nomor.join(" dan ");
  return `${nomor.slice(0, -1).join(", ")}, dan ${nomor.at(-1)}`;
}

function pesanFormat(masalah: MasalahFormatItemStok) {
  switch (masalah.alasan) {
    case "tanpa-kolom":
      return "Format Item stok belum punya kolom. Pilih Tambah kolom, lalu isi nama kolomnya, misalnya Email.";
    case "kolom-kosong":
      return `Nama kolom ${sebutNomor(masalah.nomorKolom)} belum diisi. Isi namanya, atau hapus kolom itu.`;
    case "kolom-kembar":
      return `Nama kolom ${sebutNomor(masalah.nomorKolom)} sudah dipakai kolom sebelumnya, tanpa membedakan huruf besar dan kecil. Ganti namanya supaya setiap kolom berbeda.`;
  }
}

const PESAN_KATEGORI_TIDAK_ADA =
  "Kategori yang dipilih sudah tidak ada. Pilih Kategori lain dari daftar.";

export async function aksiBuatProduk(
  _sebelumnya: KeadaanFormProduk,
  formData: FormData,
): Promise<KeadaanFormProduk> {
  await wajibSesiAdmin(await headers());

  const isian = bacaIsian(formData);
  // Isian kolom selain teks (misalnya berkas) tidak berisi nama kolom, jadi dibaca sebagai nama
  // kosong pada urutannya. Nomor kolom di pesan galat tetap sama dengan urutan isian di form.
  const formatItemStok = z
    .array(z.string().catch(""))
    .parse(formData.getAll("kolom"));
  const masukan = MasukanProduk.safeParse(isian);
  const format = periksaFormatItemStok(formatItemStok);
  if (!masukan.success || !format.sah) {
    return {
      ...isian,
      formatItemStok,
      galat: {
        ...(masukan.success ? {} : galatIsian(masukan.error)),
        ...(format.sah
          ? {}
          : {
              formatItemStok: format.masalah.map(pesanFormat).join(" "),
              kolomDitolak: format.masalah.flatMap((m) =>
                m.alasan === "tanpa-kolom" ? [] : m.nomorKolom,
              ),
            }),
      },
    };
  }

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk membuat.
  const hasil = await buatProduk({
    ...masukan.data,
    formatItemStok: format.kolom,
  });
  if (hasil.hasil === "kategori-tidak-ada") {
    return {
      ...isian,
      formatItemStok,
      galat: { kategoriId: PESAN_KATEGORI_TIDAK_ADA },
    };
  }
  redirect("/admin/produk");
}

export async function aksiUbahProduk(
  _sebelumnya: KeadaanFormProduk,
  formData: FormData,
): Promise<KeadaanFormProduk> {
  await wajibSesiAdmin(await headers());

  // Produk dengan id yang tidak sah pasti tidak ada.
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) notFound();

  // Format Item stok diubah lewat aksiUbahFormatItemStok, jadi isian kolom tidak dibaca di sini.
  const isian = bacaIsian(formData);
  const masukan = MasukanProduk.safeParse(isian);
  if (!masukan.success) return { ...isian, galat: galatIsian(masukan.error) };

  const hasil = await ubahProduk({ id: id.data, ...masukan.data });
  if (hasil.hasil === "tidak-ada") notFound();
  if (hasil.hasil === "kategori-tidak-ada") {
    return { ...isian, galat: { kategoriId: PESAN_KATEGORI_TIDAK_ADA } };
  }
  redirect("/admin/produk");
}

/**
 * Isian form Format Item stok yang dikembalikan ke form, apa adanya, beserta pesan galatnya. Setiap kolom
 * membawa nomor kolom lamanya, atau null bila kolom itu baru ditambah. `galat.kolomDitolak` berisi nomor
 * kolom (dari 1, menurut urutan isian) yang ditolak. `tersimpan` menandai Format yang berhasil disimpan.
 */
export type KeadaanFormatItemStok = {
  kolom: KolomFormatBaru[];
  galat?: { pesan: string; kolomDitolak: number[] };
  tersimpan?: true;
};

// Isian kolom selain teks (misalnya berkas) tidak berisi nama kolom, jadi dibaca sebagai nama kosong.
const NamaKolom = z.string().catch("");

// Kolom lama dikirim dengan nomor kolom lamanya di nama isiannya, misalnya kolom-lama-3.
const POLA_KOLOM_LAMA = /^kolom-lama-([1-9][0-9]{0,3})$/;

/**
 * Format Item stok baru dari form: kolom lama yang masih ada menurut nomor kolom lamanya, lalu kolom baru
 * menurut urutannya. Kolom lama tidak bisa dipindah urutannya di form, jadi urutan ini sama dengan urutan
 * isian yang dilihat Admin. Nomor kolom lama yang terkirim dua kali hanya dibaca yang pertama.
 */
function bacaFormatBaru(formData: FormData): KolomFormatBaru[] {
  const lama = new Map<number, string>();
  for (const [nama, nilai] of formData) {
    const cocok = POLA_KOLOM_LAMA.exec(nama);
    if (!cocok) continue;
    const nomorLama = Number(cocok[1]);
    if (!lama.has(nomorLama)) lama.set(nomorLama, NamaKolom.parse(nilai));
  }
  return [
    ...[...lama]
      .sort(([a], [b]) => a - b)
      .map(([nomorLama, nama]) => ({ nama, nomorLama })),
    ...formData
      .getAll("kolom")
      .map((nilai) => ({ nama: NamaKolom.parse(nilai), nomorLama: null })),
  ];
}

const PERBUATAN_DITOLAK = {
  "tambah-kolom": "ditambah",
  "hapus-kolom": "dihapus",
} as const;

/** Pesan bila kolom tidak boleh ditambah atau dihapus, dengan jumlah Item stok sebagai sebabnya (PRD §4.1). */
function pesanTidakBoleh({
  ditolak,
  jumlahTersedia,
  jumlahDitahan,
}: {
  ditolak: readonly PerubahanFormatItemStok[];
  jumlahTersedia: number;
  jumlahDitahan: number;
}) {
  const perbuatan = ditolak
    .flatMap((p) => (p === "ganti-nama" ? [] : [PERBUATAN_DITOLAK[p]]))
    .join(" atau ");
  return `Kolom tidak bisa ${perbuatan}, karena Produk ini masih punya Item stok Tersedia atau Ditahan: ${jumlahTersedia} Tersedia dan ${jumlahDitahan} Ditahan. Kolom bisa ditambah atau dihapus setelah semua Item stok Produk ini Terkirim, atau setelah Item stok Tersedia-nya dihapus di halaman Varian. Nama kolom tetap bisa diganti kapan saja.`;
}

/**
 * Mengubah Format Item stok Produk yang sudah ada (PRD §4.1): mengganti nama kolom, menambah kolom, atau
 * menghapus kolom. Nama kolom diperiksa seperti saat membuat Produk, lalu server menolak tambah atau hapus
 * kolom selama Produk punya Item stok Tersedia atau Ditahan.
 */
export async function aksiUbahFormatItemStok(
  _sebelumnya: KeadaanFormatItemStok,
  formData: FormData,
): Promise<KeadaanFormatItemStok> {
  await wajibSesiAdmin(await headers());

  // Produk dengan id yang tidak sah pasti tidak ada.
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) notFound();

  const kolom = bacaFormatBaru(formData);
  const format = periksaFormatItemStok(kolom.map((k) => k.nama));
  if (!format.sah) {
    return {
      kolom,
      galat: {
        pesan: format.masalah.map(pesanFormat).join(" "),
        kolomDitolak: format.masalah.flatMap((m) =>
          m.alasan === "tanpa-kolom" ? [] : m.nomorKolom,
        ),
      },
    };
  }

  // Semua Admin punya hak yang sama (PRD §2.1), jadi sesi Admin yang berlaku cukup untuk mengubah.
  const formatBaru = kolom.map((k, i) => ({ ...k, nama: format.kolom[i] }));
  const hasil = await ubahFormatItemStok({ produkId: id.data, formatBaru });
  switch (hasil.hasil) {
    case "tidak-ada":
      notFound();
    case "tidak-boleh":
      return {
        kolom,
        galat: { pesan: pesanTidakBoleh(hasil), kolomDitolak: [] },
      };
    case "diubah":
      refresh();
      return { kolom: formatBaru, tersimpan: true };
  }
}
