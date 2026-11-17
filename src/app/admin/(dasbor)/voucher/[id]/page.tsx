import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { angkaRupiah } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarKategori } from "@/server/kategori";
import { daftarProduk } from "@/server/produk";
import { bacaVoucher } from "@/server/voucher";
import { isianWib } from "@/server/zona-waktu-toko";

import { FormVoucher } from "../_components/form-voucher";

/** Angka sebagai isian form, atau isian kosong untuk syarat tanpa batas atau yang tidak diisi. */
const teksAngka = (nilai: number | null, rupiah = false) =>
  nilai === null ? "" : rupiah ? angkaRupiah(nilai) : String(nilai);

// Mengubah syarat sebuah Voucher (PRD §8.4 ▶ Keputusan 2026-11-17, §8.8). Kodenya hanya ditampilkan, karena
// kode tidak bisa diubah setelah Voucher dibuat. Cakupan voucher yang tersimpan tampil sebagai pilihan
// yang tercentang.
export default async function HalamanUbahVoucher({
  params,
}: PageProps<"/admin/voucher/[id]">) {
  await wajibSesiAdmin(await headers());

  const id = z.uuid().safeParse((await params).id);
  const voucher = id.success ? await bacaVoucher(id.data) : null;
  if (!voucher) notFound();
  const [semuaProduk, semuaKategori] = await Promise.all([
    daftarProduk(),
    daftarKategori(),
  ]);
  const { cakupan } = voucher;

  const nominal = voucher.jenisPotongan === "nominal";
  return (
    <>
      <h1>Ubah Voucher</h1>
      <FormVoucher
        idVoucher={voucher.id}
        awal={{
          isian: {
            kode: voucher.kode,
            jenisPotongan: voucher.jenisPotongan,
            nilai: teksAngka(voucher.nilai, nominal),
            batasMaksimum: teksAngka(voucher.batasMaksimum, true),
            mulai: voucher.mulai ? isianWib(voucher.mulai) : "",
            berakhir: voucher.berakhir ? isianWib(voucher.berakhir) : "",
            kuotaVoucher: teksAngka(voucher.kuotaVoucher),
            batasPerEmail: teksAngka(voucher.batasPerEmail),
            minimalHargaJual: teksAngka(voucher.minimalHargaJual, true),
            khususMember: voucher.khususMember,
            aktif: voucher.aktif,
            cakupan: cakupan.jenis,
            produkId: cakupan.jenis === "produk" ? [...cakupan.daftar] : [],
            kategoriId: cakupan.jenis === "kategori" ? [...cakupan.daftar] : [],
          },
        }}
        pilihanProduk={semuaProduk}
        pilihanKategori={semuaKategori}
      />
    </>
  );
}
