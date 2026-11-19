import { headers } from "next/headers";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarKategori } from "@/server/kategori";
import { daftarProduk } from "@/server/produk";

import { FormVoucher } from "../_components/form-voucher";

// Membuat Voucher baru (PRD §8.2, §8.4 ▶ Keputusan 2026-11-17). Saat form dibuka, jenis potongan Nominal
// tetap terpilih, Batas per email sudah terisi 1, Voucher aktif, dan berlaku untuk semua Produk.
export default async function HalamanTambahVoucher() {
  await wajibSesiAdmin(await headers());
  const [semuaProduk, semuaKategori] = await Promise.all([
    daftarProduk(),
    daftarKategori(),
  ]);

  return (
    <div className="tata-baca">
      <h1 className="mb-6">Tambah Voucher</h1>
      <FormVoucher
        awal={{
          isian: {
            kode: "",
            jenisPotongan: "nominal",
            nilai: "",
            batasMaksimum: "",
            mulai: "",
            berakhir: "",
            kuotaVoucher: "",
            batasPerEmail: "1",
            minimalHargaJual: "",
            khususMember: false,
            aktif: true,
            cakupan: "semua",
            produkId: [],
            kategoriId: [],
          },
        }}
        pilihanProduk={semuaProduk}
        pilihanKategori={semuaKategori}
      />
    </div>
  );
}
